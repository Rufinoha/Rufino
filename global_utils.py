# ────────────────────────────────────────────────
# DECLARAÇÔES E IMPORTAÇÕES
# ────────────────────────────────────────────────
import os, hmac, hashlib
import psycopg2
import re
import requests
import locale
import logging
from datetime import datetime, timedelta, timezone
from flask import Blueprint, request, jsonify, session, redirect, url_for, render_template
from functools import wraps
from psycopg2 import OperationalError
from typing import Callable, Optional


mod_util = Blueprint("global_util", __name__)

global_bp = Blueprint(
    'global',
    __name__,
    template_folder='templates', 
    static_folder='static',
    static_url_path='/static'
)

def init_app(app):
    app.register_blueprint(global_bp)

# ────────────────────────────────────────────────
# OUTRAS FUNÇÕES ÚTEIS
# ────────────────────────────────────────────────
def configurar_tempo_sessao(id_empresa):
    """
    Retorna o tempo de sessão configurado para a empresa em formato timedelta.
    Caso não encontre ou ocorra erro, retorna 30 minutos como padrão.
    """
    try:
        with Var_ConectarBanco() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT valor
                    FROM tbl_config
                    WHERE chave = 'tempo_sessao_minutos' AND id_empresa = %s
                """, (id_empresa,))
                resultado = cur.fetchone()

        if resultado:
            try:
                minutos = int(resultado[0])
                return timedelta(minutes=minutos)
            except ValueError:
                logging.warning(f"Valor inválido para tempo_sessao_minutos: {resultado[0]}")
    except Exception as e:
        logging.error(f"Erro ao buscar tempo de sessão (empresa {id_empresa}): {e}")

    return timedelta(minutes=30)



# ────────────────────────────────────────────────
# FUNÇÃO PARA CONECTAR NO BANCO DE DADOS PostgreSQL
# ────────────────────────────────────────────────
def Var_ConectarBanco():
    """
    Conecta ao PostgreSQL conforme MODO_PRODUCAO e já define o search_path
    usando DB_SCHEMA_DEV/DB_SCHEMA_PROD fornecidos no .env.
    """

    modo_prod = str(os.getenv("MODO_PRODUCAO", "false")).strip().lower() in ("1", "true", "yes", "sim")
    SUF = "PROD" if modo_prod else "DEV"

    user    = os.getenv(f"DB_USER_{SUF}")
    pwd     = os.getenv(f"DB_PASSWORD_{SUF}")
    dbname  = os.getenv(f"DB_NAME_{SUF}")
    host    = os.getenv(f"DB_HOST_{SUF}", "127.0.0.1")
    port    = os.getenv(f"DB_PORT_{SUF}", "5432")
    schema  = os.getenv(f"DB_SCHEMA_{SUF}", "public")  # 🔸 definido no .env

    faltando = [n for n, v in [
        (f"DB_USER_{SUF}", user),
        (f"DB_PASSWORD_{SUF}", pwd),
        (f"DB_NAME_{SUF}", dbname),
        (f"DB_HOST_{SUF}", host),
        (f"DB_PORT_{SUF}", port),
        (f"DB_SCHEMA_{SUF}", schema),
    ] if not str(v or "").strip()]
    if faltando:
        raise ValueError("Variáveis ausentes: " + ", ".join(faltando))

    try:
        # ✅ já nasce com search_path correto
        conn = psycopg2.connect(
            dbname=dbname,
            user=user,
            password=pwd,
            host=host,
            port=port,
            options=f"-c search_path={schema},public -c application_name=fleedguard"
        )
        conn.set_client_encoding("UTF8")
        return conn

    except OperationalError as e:
        raise RuntimeError(f"Erro ao conectar ao banco ({'PROD' if modo_prod else 'DEV'}): {e}")


# ────────────────────────────────────────────────
# LOGIN OBRIGATORIO
# ────────────────────────────────────────────────
def login_obrigatorio(func=None):
    def _decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            # 0 = verificar | 1 = ignorar (default 0)
            body = request.get_json(silent=True) or {}
            raw = (
                request.headers.get("X-Bypass-Login") or
                request.headers.get("X-Ignorar-Login") or
                request.args.get("bypass_login") or
                request.args.get("ignorar_login") or
                body.get("bypass_login") or
                body.get("ignorar_login") or
                "0"
            )
            ignorar = 1 if str(raw).strip() == "1" else 0

            if ignorar == 1:
                return f(*args, **kwargs)

            if not session.get("id_usuario") or not session.get("id_empresa"):
                if request.method == "GET":
                    session["proxima_url"] = request.url
                # use o endpoint correto do seu login
                return redirect(url_for("auth.exibir_login"))
            return f(*args, **kwargs)
        return wrapper
    return _decorator if func is None else _decorator(func)






# ────────────────────────────────────────────────────────────────────────────
# ROTA GENÉRICA PARA PÁGINAS GLOBAIS
# ────────────────────────────────────────────────────────────────────────────
@global_bp.route("/<path:pagina>", methods=["GET"])

def abrir_pagina(pagina):
    """
    Carrega HTML principal.
    - Sem barra: usa frm_{pagina}.html no templates raiz.
    - Com barra (módulo): 'mod_xxx/nome' -> renderiza frm_{nome}.html
      O arquivo deve estar no templates do blueprint do módulo.
    """
    try:
        # Ex.: "motorista"  -> frm_motorista.html 
        # Ex.: "mod_ontracker/ontracker_telemetria" -> frm_ontracker_telemetria.html
        if "/" in pagina:
            partes = pagina.split("/", 1)
            nome_html = partes[1]                      # "ontracker_telemetria"
            template_name = f"frm_{nome_html}.html"    # "frm_ontracker_telemetria.html"
        else:
            template_name = f"frm_{pagina}.html"

        return render_template(template_name)

    except Exception as e:
        print(f"Erro ao carregar página {pagina}: {e}")
        return "❌ Erro interno ao tentar acessar a página.", 500






# ────────────────────────────────────────────────
# Combobox para buscar planos de contas
# ────────────────────────────────────────────────
@global_bp.route("/combobox/plano_contas")
@login_obrigatorio()
def plano_contas_buscar():
    termo = request.args.get("termo", "").strip()
    id_empresa = session.get("id_empresa")

    conn = Var_ConectarBanco()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, descricao, plano
        FROM tbl_hub_plano_contas
        WHERE id_empresa = %s
          AND tipo = 'Analítica'
          AND descricao ILIKE %s
        ORDER BY descricao
        LIMIT 20
    """, (id_empresa, f"%{termo}%"))

    resultados = [
        {"id": row[0], "descricao": row[1], "plano": row[2]}
        for row in cursor.fetchall()
    ]
    conn.close()
    return jsonify(resultados)




# ────────────────────────────────────────────────
# Combobox para buscar as categorias    
# ────────────────────────────────────────────────
@global_bp.route("/combobox/categorias", methods=["GET"])
@login_obrigatorio
def combobox_categorias():
    conn = None
    try:
        id_empresa = session.get("id_empresa")
        if not id_empresa:
            return jsonify({"erro": "Sessão expirada"}), 401

        termo = (request.args.get("termo") or "").strip()
        limite = int(request.args.get("limite", 30))

        conn = Var_ConectarBanco()
        cursor = conn.cursor()

        where = "WHERE id_empresa = %s AND COALESCE(status, TRUE) = TRUE"
        params = [id_empresa]

        if termo:
            where += " AND nome_categoria ILIKE %s"
            params.append(f"%{termo}%")

        cursor.execute(f"""
            SELECT id, nome_categoria
              FROM tbl_hub_categoria
              {where}
          ORDER BY nome_categoria ASC
             LIMIT %s
        """, params + [limite])

        rows = cursor.fetchall()
        dados = [{"id": r[0], "nome": r[1]} for r in rows]
        return jsonify(dados)

    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    finally:
        if conn:
            conn.close()

# ────────────────────────────────────────────────
# Combobox para buscar as formas de pagamento   
# ────────────────────────────────────────────────
@global_bp.route("/combobox/formas_pagamento")
@login_obrigatorio()
def formas_pagamento_combo():
    id_empresa = request.args.get("id_empresa")
    if not id_empresa:
        return jsonify([])

    conn = Var_ConectarBanco()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, nome_exibicao
          FROM tbl_hub_livro_diario
         WHERE id_empresa = %s
         ORDER BY nome_exibicao
    """, (id_empresa,))

    resultado = [{"id": row[0], "nome_exibicao": row[1]} for row in cur.fetchall()]

    conn.close()
    return jsonify(resultado)


# ────────────────────────────────────────────────
# API PARA BUSCA GENERALIZADAS
# ────────────────────────────────────────────────
@global_bp.route('/api/buscacnpj', methods=['POST'])
def buscar_cnpj():
    try:
        # Proteção contra falha no request body
        try:
            dados = request.get_json(force=True, silent=True) or {}
        except Exception as e:
            print("❌ Erro ao obter JSON do request:", str(e))
            return jsonify({"erro": "Requisição inválida"}), 400

        cnpj = dados.get("cnpj", "").replace(".", "").replace("/", "").replace("-", "")

        if len(cnpj) != 14 or not cnpj.isdigit():
            return jsonify({"erro": "CNPJ inválido"}), 400

        resposta = requests.get(f"https://publica.cnpj.ws/cnpj/{cnpj}", timeout=10)

        if resposta.status_code != 200:
            return jsonify({"erro": "Não foi possível consultar o CNPJ no momento."}), 400

        data = resposta.json()

        estabelecimento = data.get("estabelecimento", {})
        cidade = estabelecimento.get("cidade", {})
        estado = estabelecimento.get("estado", {})

        resultado = {
            "razao_social": data.get("razao_social", ""),
            "fantasia": data.get("nome_fantasia", ""),
            "email": estabelecimento.get("email", ""),
            "telefone": estabelecimento.get("telefone1", ""),
            "cep": estabelecimento.get("cep", ""),
            "endereco": estabelecimento.get("logradouro", ""),
            "numero": estabelecimento.get("numero", ""),
            "bairro": estabelecimento.get("bairro", ""),
            "cidade": cidade.get("nome", ""),
            "uf": estado.get("sigla", ""),
            "ie": estabelecimento.get("inscricao_estadual", ""),
            "data_abertura": estabelecimento.get("data_inicio_atividade", ""),
            "natureza_juridica": data.get("natureza_juridica", {}).get("descricao", ""),
            "cnae_principal": estabelecimento.get("atividade_principal", {}).get("id", ""),
            "cnaes_secundarios": ", ".join([
                item.get("id", "") for item in estabelecimento.get("atividades_secundarias", [])
            ]),
            "situacao_cadastral": estabelecimento.get("situacao_cadastral", ""),
            "data_situacao": estabelecimento.get("data_situacao_cadastral", "")
        }

        return jsonify(resultado)

    except Exception as e:
        print("❌ Erro na consulta de CNPJ:", str(e))
        return jsonify({"erro": "Erro inesperado ao consultar CNPJ"}), 500


# ────────────────────────────────────────────────
# FUNÇÕES GLOBAIS
# ────────────────────────────────────────────────
def remover_tags_html(texto):
    """Remove qualquer tag HTML da string"""
    return re.sub('<[^<]+?>', '', texto or "")

# Converte data ISO para formato brasileiro DD/MM/AAAA
def formata_data_brasileira(data_iso):
    """Converte data ISO para formato DD/MM/AAAA"""
    if not data_iso:
        return "-"
    try:
        dt = datetime.fromisoformat(data_iso.replace("Z", "+00:00"))
        return dt.strftime("%d/%m/%Y")
    except Exception:
        return data_iso

# Formata valor como moeda brasileira (R$)
def formata_moeda(valor):
    """Formata número como moeda brasileira"""
    try:
        locale.setlocale(locale.LC_ALL, 'pt_BR.UTF-8')
        return locale.currency(valor, grouping=True)
    except Exception:
        return f"R$ {valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")




def gerar_hmac_token(raw_token: str) -> str:
    """
    Gera hash HMAC-SHA256 de um token bruto usando SECRET_KEY.
    Boa prática LGPD: nunca armazenar o token cru no banco.
    """
    secret = (os.getenv("SECRET_KEY") or "").encode()
    return hmac.new(secret, raw_token.encode(), hashlib.sha256).hexdigest()

def agora_utc():
    """
    Retorna datetime atual em UTC, timezone-aware.
    Evita problemas de fuso horário entre servidor e banco.
    """
    return datetime.now(timezone.utc)


# ────────────────────────────────────────────────
# Validação de e-mail
# ────────────────────────────────────────────────
def valida_email(email: str) -> bool:
    """
    Valida se o e-mail informado tem formato básico válido.
    Retorna True se for válido, False caso contrário.
    """
    if not email or not isinstance(email, str):
        return False

    email = email.strip().lower()
    padrao = re.compile(
        r"^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$",
        re.IGNORECASE
    )
    return bool(padrao.match(email))