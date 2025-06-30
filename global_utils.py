# ────────────────────────────────────────────────
# DECLARAÇÔES E IMPORTAÇÕES
# ────────────────────────────────────────────────
import os
import psycopg2
import re
import requests
import locale
from datetime import datetime
from extensoes import db
from flask import Blueprint, request, jsonify, session




global_bp = Blueprint(
    'global',
    __name__,
    template_folder='../templates',
    static_folder='../static',
    static_url_path='/static'
)

def init_app(app):
    app.register_blueprint(global_bp)


# ────────────────────────────────────────────────
# 4️⃣ FUNÇÃO PARA CONECTAR NO BANCO DE DADOS PostgreSQL
# ────────────────────────────────────────────────
def Var_ConectarBanco():
    usuario = os.getenv("BANK_USER")
    senha = os.getenv("BANK_KEY")
    banco = os.getenv("BANK_NAME")
    host = os.getenv("BANK_HOST")
    porta = os.getenv("BANK_PORT")

    conn = psycopg2.connect(
        dbname=banco,
        user=usuario,
        password=senha,
        host=host,
        port=porta
    )
    return conn


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

    try:
        cursor.execute("""
            SELECT id, nome_categoria
            FROM tbl_hub_categoria
            WHERE id_empresa = %s AND status = true
            ORDER BY nome_categoria
        """, (id_empresa,))
        dados = [{"id": row[0], "nome_categoria": row[1]} for row in cursor.fetchall()]
        return jsonify(dados)

    except Exception as e:
        return jsonify({"erro": str(e)}), 500

    finally:
        cursor.close()
        conn.close()



# ────────────────────────────────────────────────
# API PARA BUSCA GENERALIZADAS
# ────────────────────────────────────────────────
# 🔍 Buscar CNPJ via API ReceitaWS
@global_bp.route('/api/buscacnpj', methods=['POST'])
def buscar_cnpj():
    try:
        dados = request.get_json()
        cnpj = dados.get("cnpj", "").replace(".", "").replace("/", "").replace("-", "")

        if len(cnpj) != 14:
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
# Remove tags HTML
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

# 💰 Formata valor como moeda brasileira (R$)
def formata_moeda(valor):
    """Formata número como moeda brasileira"""
    try:
        locale.setlocale(locale.LC_ALL, 'pt_BR.UTF-8')
        return locale.currency(valor, grouping=True)
    except Exception:
        return f"R$ {valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

# 📧 Valida e-mail com regex básica
def valida_email(email):
    """Valida se o e-mail tem formato básico correto"""
    if not email:
        return False
    padrao = r'^[\w\.-]+@[\w\.-]+\.\w+$'
    return re.match(padrao, email) is not None
