# ────────────────────────────────────────────────
# INTEGRAÇÃO BANCO EFI
# ────────────────────────────────────────────────
import os
import json
import requests
import sqlite3
from base64 import b64encode
from datetime import datetime
from pathlib import Path
from flask import Blueprint, request, jsonify



# ────────────────────────────────────────────────
# BLUEPRINT: LOGIN / AUTENTICAÇÃO
# ────────────────────────────────────────────────
efi_bp = Blueprint(
    'efi',
    __name__,
    template_folder='../templates',
    static_folder='../static',
    static_url_path='/static'
)

def init_app(app):
    app.register_blueprint(efi_bp)
# ────────────────────────────────────────────────


# 🔌 Conexão com SQLite
def Var_ConectarBanco():
    if os.getenv("MODO_PRODUCAO", "False") == "True":
        banco_path = Path("/srv/rufinotech/database/bd_rufino.db")
    else:
        banco_path = Path(__file__).resolve().parent.parent / "rufino" / "database" / "bd_rufino.db"

    if not banco_path.exists():
        raise FileNotFoundError(f"Banco de dados não encontrado: {banco_path}")

    conn = sqlite3.connect(banco_path, timeout=10, check_same_thread=False)
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

# 🔒 Autenticação com certificado
def get_token_efi():
    modo_producao = os.getenv("MODO_PRODUCAO", "false").lower() == "true"
    if modo_producao:
        client_id = os.getenv("EFI_CLIENT_ID")
        client_secret = os.getenv("EFI_CLIENT_SECRET")
        certificado_pem = os.getenv("EFI_CERTIFICADO_PEM")
        api_url = os.getenv("EFI_API_URL")
    else:
        client_id = os.getenv("EFI_CLIENT_ID_HOM")
        client_secret = os.getenv("EFI_CLIENT_SECRET_HOM")
        certificado_pem = os.getenv("EFI_CERTIFICADO_PEM_HOM")
        api_url = os.getenv("EFI_API_URL_HOM")

    response = requests.post(
        f"{api_url}/oauth/token",
        headers={"Content-Type": "application/json"},
        auth=(client_id, client_secret),
        json={"grant_type": "client_credentials"},
        cert=certificado_pem
    )
    response.raise_for_status()
    return response.json().get("access_token")

# 🧾 Emissão de cobrança
@efi_bp.route("/emitir", methods=["POST"])
def emitir_cobranca_efi():
    dados = request.get_json()
    id_fatura = dados.get("id_fatura")
    return gerar_cobranca_efi(id_fatura)

# 💳 Gera cobrança (Pix, Bolix ou Cartão)
def gerar_cobranca_efi(id_fatura):
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT F.id, F.valor_total, F.vencimento, F.forma_pagamento,
                   F.id_empresa, E.nome_empresa, E.email_financeiro
            FROM tbl_fatura F
            JOIN tbl_empresa E ON F.id_empresa = E.id
            WHERE F.id = ?
        """, (id_fatura,))
        fatura = cursor.fetchone()
        if not fatura:
            return {"status": "erro", "mensagem": "Fatura não encontrada."}

        id_fatura, valor_total, vencimento, forma_pgto, id_empresa, nome_cliente, email = fatura
        token = get_token_efi()
        modo_producao = os.getenv("MODO_PRODUCAO", "false").lower() == "true"
        certificado = os.getenv("EFI_CERTIFICADO_PEM") if modo_producao else os.getenv("EFI_CERTIFICADO_PEM_HOM")
        api_url = os.getenv("EFI_API_URL") if modo_producao else os.getenv("EFI_API_URL_HOM")

        if forma_pgto == "pix":
            body = {
                "calendario": {"expiracao": 3600},
                "devedor": {"nome": nome_cliente},
                "valor": {"original": f"{valor_total:.2f}"},
                "chave": os.getenv("EFI_PIX_KEY"),
                "solicitacaoPagador": f"Fatura {id_fatura} - Sistema Rufino"
            }
            endpoint = f"{api_url}/v2/cob"
        elif forma_pgto == "bolix":
            body = {
                "items": [{
                    "name": f"Fatura {id_fatura}",
                    "value": int(valor_total * 100),
                    "amount": 1
                }],
                "payment": {
                    "banking_billet": {
                        "expire_at": vencimento,
                        "message": "Essa cobrança pode ser paga via boleto ou Pix QR",
                        "customer": {
                            "email": email,
                            "juridical_person": {"corporate_name": nome_cliente, "cnpj": "32.377.025/0001-04"}
                        }
                    }
                }
            }
            endpoint = f"{api_url}/v1/charge"
        elif forma_pgto == "cartao":
            body = {
                "items": [{
                    "name": f"Fatura {id_fatura}",
                    "value": int(valor_total * 100),
                    "amount": 1
                }],
                "payment": {"credit_card": {"customer": {"name": nome_cliente}}}
            }
            endpoint = f"{api_url}/v1/charge/credit"
        else:
            return {"status": "erro", "mensagem": "Forma de pagamento inválida."}

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        response = requests.post(endpoint, headers=headers, json=body, cert=certificado)
        response.raise_for_status()
        resultado = response.json()

        # 🔁 Interpreta retorno
        if forma_pgto == "pix":
            txid = resultado.get("txid")
            link_pagamento = resultado.get("loc", {}).get("location", "")
            qrcode = resultado.get("pix", [{}])[0].get("qrcode", "")
        elif forma_pgto == "bolix":
            txid = str(resultado.get("charge_id") or resultado.get("id"))
            link_pagamento = resultado.get("payment", {}).get("banking_billet", {}).get("link", "")
            qrcode = ""
        elif forma_pgto == "cartao":
            txid = str(resultado.get("charge_id") or resultado.get("id"))
            link_pagamento = resultado.get("payment", {}).get("credit_card", {}).get("url", "")
            qrcode = ""

        # 💾 Atualiza fatura
        cursor.execute("""
            UPDATE tbl_fatura
            SET id_efi_cobranca = ?, link_efi_pagamento = ?, qrcode_efi = ?,
                dt_efi_cobranca_gerada = ?, status_pagamento = ?
            WHERE id = ?
        """, (
            txid, link_pagamento, qrcode,
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "ATIVA", id_fatura
        ))
        conn.commit()

        return {
            "status": "sucesso",
            "txid": txid,
            "link_pagamento": link_pagamento
        }

    except Exception as e:
        return {"status": "erro", "mensagem": str(e)}
    finally:
        conn.close()

# 📬 Webhook EFI
@efi_bp.route("/webhook", methods=["POST"])
def webhook_efi():
    dados = request.get_json()
    txid = dados.get("txid") or dados.get("charge_id") or dados.get("id")
    if not txid:
        return jsonify({"erro": "txid não localizado"}), 400

    status_efi = consultar_status_cobranca(txid)
    if status_efi["status"] != "sucesso":
        return jsonify({"erro": "Erro ao consultar status"}), 500

    status_original = status_efi["dados"].get("status", "").upper()
    mapa_status = {
        "CONCLUIDA": "Pago",
        "ATIVA": "Pendente",
        "REMOVIDA_PELO_USUARIO_RECEBEDOR": "Cancelado",
        "EXPIRADA": "Cancelado"
    }
    status_local = mapa_status.get(status_original, "Pendente")

    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    cursor.execute("UPDATE tbl_fatura SET status_pagamento = ? WHERE id_efi_cobranca = ?", (status_local, txid))
    conn.commit()
    conn.close()

    return jsonify({"status": "sucesso", "mensagem": f"Status atualizado para {status_local}"}), 200

# 🔍 Consultar cobrança
@efi_bp.route("/consultar", methods=["POST"])
def consultar_efi():
    dados = request.get_json()
    return consultar_status_cobranca(dados.get("txid"))

def consultar_status_cobranca(txid):
    token = get_token_efi()
    modo_producao = os.getenv("MODO_PRODUCAO", "false").lower() == "true"
    api_url = os.getenv("EFI_API_URL") if modo_producao else os.getenv("EFI_API_URL_HOM")

    url = f"{api_url}/v2/cob/{txid}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    resp = requests.get(url, headers=headers)
    if resp.status_code in [200, 201]:
        return {"status": "sucesso", "dados": resp.json()}
    else:
        return {"status": "erro", "mensagem": resp.text}

# ❌ Cancelar cobrança
@efi_bp.route("/cancelar", methods=["POST"])
def cancelar_efi():
    dados = request.get_json()
    return cancelar_cobranca(dados.get("txid"))

def cancelar_cobranca(txid):
    token = get_token_efi()
    modo_producao = os.getenv("MODO_PRODUCAO", "false").lower() == "true"
    api_url = os.getenv("EFI_API_URL") if modo_producao else os.getenv("EFI_API_URL_HOM")

    url = f"{api_url}/v2/cob/{txid}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    body = { "status": "REMOVIDA_PELO_USUARIO_RECEBEDOR" }
    resp = requests.patch(url, headers=headers, json=body)
    if resp.status_code in [200, 204]:
        return {"status": "sucesso", "mensagem": "Cobrança cancelada com sucesso"}
    else:
        return {"status": "erro", "mensagem": resp.text}
