# ────────────────────────────────────────────────
# DECLARAÇÔES E IMPORTAÇÕES
# ────────────────────────────────────────────────
import os
import psycopg2
import re
import requests
import locale
import logging
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, session, redirect, url_for, render_template
from functools import wraps
from psycopg2 import OperationalError


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
    Conecta ao banco de dados PostgreSQL utilizando variáveis de ambiente.
    Retorna uma conexão válida ou lança erro com detalhes.
    """
    usuario = os.getenv("BANK_USER")
    senha = os.getenv("BANK_KEY")
    banco = os.getenv("BANK_NAME")
    host = os.getenv("BANK_HOST")
    porta = os.getenv("BANK_PORT")

    # 🔒 Validação das variáveis de ambiente
    if not all([usuario, senha, banco, host, porta]):
        raise ValueError("❌ Variáveis de conexão com o banco estão ausentes ou incompletas.")

    try:
        conn = psycopg2.connect(
            dbname=banco,
            user=usuario,
            password=senha,
            host=host,
            port=porta
        )
        return conn
    except OperationalError as e:
        # 🧠 Padrão SaaS: logar com rastreamento (ou ferramenta tipo Sentry/NewRelic)
        print(f"❌ Erro ao conectar ao banco: {str(e)}")
        raise


# ────────────────────────────────────────────────
# LOGIN OBRIGATORIO
# ────────────────────────────────────────────────
def login_obrigatorio(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        id_usuario = session.get("id_usuario")
        id_empresa = session.get("id_empresa")

        if not id_usuario or not id_empresa:
            # Salva URL de destino para redirecionamento pós-login
            session["proxima_url"] = request.url
            return redirect(url_for("rotas.Var_Login"))

        return func(*args, **kwargs)
    return wrapper




# ────────────────────────────────────────────────────────────────────────────
# ROTA GENÉRICA PARA PÁGINAS GLOBAIS
# ────────────────────────────────────────────────────────────────────────────
@global_bp.route('/abrir_pagina/<pagina>')
@login_obrigatorio
def abrir_pagina_global(pagina):
    try:
        return render_template(f"frm_{pagina}.html")
    except Exception as e:
        print(f"[ERRO] Falha ao abrir página {pagina}: {str(e)}")
        return f"Erro ao abrir página: {str(e)}", 500






# ────────────────────────────────────────────────
# Combobox para buscar planos de contas
# ────────────────────────────────────────────────
@global_bp.route("/combobox/plano_contas")
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
@global_bp.route("/combobox/categorias")
def combobox_categorias():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    id_empresa = session.get("id_empresa")
    onde_usa = request.args.get("onde_usa")

    try:
        sql = """
            SELECT id, nome_categoria
            FROM tbl_hub_categoria
            WHERE id_empresa = %s AND status = true
        """
        params = [id_empresa]

        if onde_usa:
            sql += " AND onde_usa = %s"
            params.append(onde_usa)

        sql += " ORDER BY nome_categoria"

        cursor.execute(sql, params)
        dados = [{"id": row[0], "nome_categoria": row[1]} for row in cursor.fetchall()]
        return jsonify(dados)

    except Exception as e:
        return jsonify({"erro": str(e)}), 500

    finally:
        cursor.close()
        conn.close()

# ────────────────────────────────────────────────
# Combobox para buscar as formas de pagamento   
# ────────────────────────────────────────────────
@global_bp.route("/combobox/formas_pagamento")
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

# Valida e-mail com regex básica
def valida_email(email):
    """Valida se o e-mail tem formato básico correto"""
    if not email:
        return False
    padrao = r'^[\w\.-]+@[\w\.-]+\.\w+$'
    return re.match(padrao, email) is not None
