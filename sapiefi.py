# ───────────────────────────────────────────────
# 🌐 Integração com Banco EFI (Pix, Boleto, Cartão)
# ───────────────────────────────────────────────
import json
import os
import sqlite3
import requests
from base64 import b64encode
from datetime import datetime
from flask import Blueprint, request, jsonify
from requests import post
from pathlib import Path
efi_bp = Blueprint('efi', __name__)


# Função para conectar ao banco de dados (Rufino)
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




# 🔐 Autenticação
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

    print 

    headers = {"Content-Type": "application/json"}
    data = {"grant_type": "client_credentials"}

    response = requests.post(
        f"{api_url}/oauth/token",
        headers=headers,
        auth=(client_id, client_secret),
        json=data,
        cert=certificado_pem
    )

    response.raise_for_status()
    return response.json().get("access_token")


# 💳 Geração da cobrança via Pix (simples)
def gerar_cobranca_efi(id_fatura):
    conn = Var_ConectarBanco()
    cursor = conn.cursor()

    try:
        # 🔍 Dados da fatura e cliente
        cursor.execute("""
            SELECT F.id, F.valor_total, F.vencimento, F.forma_pagamento,
                F.id_cliente, E.nome_empresa, E.email_financeiro
            FROM tbl_fatura F
            JOIN tbl_empresa E ON F.id_cliente = E.id
            WHERE F.id = ?
        """, (id_fatura,))

        fatura = cursor.fetchone()

        if not fatura:
            return {"status": "erro", "mensagem": "Fatura não encontrada."}

        id_fatura, valor_total, vencimento, forma_pgto, id_cliente, nome_cliente, email = fatura

        # 🔐 Ambiente e credenciais
        modo_producao = os.getenv("MODO_PRODUCAO", "false").lower() == "true"
        if modo_producao:
            client_id = os.getenv("EFI_CLIENT_ID_HOM")
            client_secret = os.getenv("EFI_CLIENT_SECRET_HOM")
            certificado = os.getenv("EFI_CERTIFICADO_PEM_HOM")
            api_url = os.getenv("EFI_API_URL_HOM")
        else:
            client_id = os.getenv("EFI_CLIENT_ID")
            client_secret = os.getenv("EFI_CLIENT_SECRET")
            certificado = os.getenv("EFI_CERTIFICADO_PEM")
            api_url = os.getenv("EFI_API_URL")

        # 🛡️ Autenticação
        auth_response = post(
            f"{api_url}/oauth/token",
            auth=(client_id, client_secret),
            headers={"Content-Type": "application/json"},
            json={"grant_type": "client_credentials"},
            cert=certificado
        )
        auth_response.raise_for_status()
        access_token = auth_response.json().get("access_token")

        # 💸 Monta cobrança conforme forma_pgto
        if forma_pgto == "pix":
            body = {
                "calendario": {"expiracao": 3600},
                "devedor": {"nome": nome_cliente},
                "valor": {"original": f"{valor_total:.2f}"},
                "chave": os.getenv("EFI_PIX_KEY"),
                "solicitacaoPagador": f"Fatura {id_fatura} - Sistema Rufino",
                "infoAdicionais": [
                    {"nome": "Cliente", "valor": nome_cliente},
                    {"nome": "Forma", "valor": forma_pgto}
                ]
            }
            endpoint = f"{api_url}/v2/cob"

        elif forma_pgto == "bolix":
            body = {
                "items": [
                    {
                        "name": f"Fatura {id_fatura} - Sistema Rufino",
                        "value": int(valor_total * 100),  # Em centavos
                        "amount": 1
                    }
                ],
                "payment": {
                    "banking_billet": {
                        "expire_at": vencimento,
                        "message": "Essa cobrança pode ser paga pelo código de barras ou QR Code Pix",
                        "customer": {
                            "email": email or "ml@h74.com.br",
                            "phone_number": "11999999999",
                            "juridical_person": {
                                "corporate_name": "Rufino Tecnologia ampliada",
                                "cnpj": "32.377.025/0001-04"
                            },
                            "address": {
                                "street": "Rua Padrão",
                                "number": "39",
                                "neighborhood": "Centro",
                                "zipcode":  "00000000",
                                "city":  "Louveira",
                                "state": "SP",
                                "complement": "ao lado"
                            }
                        },
                        "configurations": {
                            "fine": 200,
                            "interest": 33
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
                "payment": {
                    "credit_card": {
                        "customer": {"name": nome_cliente}
                    }
                }
            }
            endpoint = f"{api_url}/v1/charge/credit"

        else:
            return {"status": "erro", "mensagem": "Forma de pagamento inválida."}

        
        
        # 🚀 Envia para API da EFI
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }

        print("🔍 Endpoint:", endpoint)
        print("📦 Body enviado:", json.dumps(body, indent=2, ensure_ascii=False))
        print("🔑 Token:", access_token)

        response = post(endpoint, headers=headers, json=body, cert=certificado)
        response.raise_for_status()
        resultado = response.json()

        # 🧾 Interpreta retorno por tipo de pagamento
        if forma_pgto == "pix":
            txid = resultado.get("txid")
            link_pagamento = resultado.get("loc", {}).get("location", "")
            qrcode = resultado.get("pix", [{}])[0].get("qrcode", "")

        elif forma_pgto == "bolix":
            txid = str(resultado.get("charge_id") or resultado.get("id"))
            link_pagamento = resultado.get("payment", {}).get("banking_billet", {}).get("link", "")
            qrcode = ""  # Não se aplica

        elif forma_pgto == "cartao":
            txid = str(resultado.get("charge_id") or resultado.get("id"))
            link_pagamento = resultado.get("payment", {}).get("credit_card", {}).get("url", "")
            qrcode = ""  # Não se aplica

        else:
            return {"status": "erro", "mensagem": "Erro ao interpretar retorno."}

        # 📝 Atualiza dados da fatura
        cursor.execute("""
            UPDATE tbl_fatura
            SET 
                id_efi_cobranca = ?,
                link_efi_pagamento = ?,
                qrcode_efi = ?,
                dt_efi_cobranca_gerada = ?,
                status_pagamento = ?
            WHERE id = ?
        """, (
            txid,
            link_pagamento,
            qrcode,
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "ATIVA",
            id_fatura
        ))
        conn.commit()

        return {
            "status": "sucesso",
            "txid": txid,
            "link_pagamento": link_pagamento
        }

    except Exception as e:
        print("❌ Erro ao gerar cobrança:", str(e))
        return {"status": "erro", "mensagem": str(e)}

    finally:
        conn.close()




def consultar_status_cobranca(txid):
    token = get_token_efi()
    modo_producao = os.getenv("MODO_PRODUCAO", "false").lower() == "true"
    api_url = os.getenv("EFI_API_URL") if modo_producao else os.getenv("EFI_API_URL_HOM")


    url = f"{api_url}/v2/cob/{txid}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    response = requests.get(url, headers=headers)
    if response.status_code in [200, 201]:
        return {"status": "sucesso", "dados": response.json()}
    else:
        return {"status": "erro", "mensagem": response.text}




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

    response = requests.patch(url, headers=headers, json=body)
    if response.status_code in [200, 204]:
        return {"status": "sucesso", "mensagem": "Cobrança cancelada com sucesso"}
    else:
        return {"status": "erro", "mensagem": response.text}



def gerar_qrcode(txid):
    token = get_token_efi()
    modo_producao = os.getenv("MODO_PRODUCAO", "false").lower() == "true"
    api_url = os.getenv("EFI_API_URL") if modo_producao else os.getenv("EFI_API_URL_HOM")



    url = f"{api_url}/v2/loc/{txid}/qrcode"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    response = requests.get(url, headers=headers)
    if response.status_code in [200, 201]:
        return {"status": "sucesso", "dados": response.json()}
    else:
        return {"status": "erro", "mensagem": response.text}








@efi_bp.route("/efi/webhook", methods=["POST"])
def webhook_efi():
    try:
        dados = request.get_json()
        print("📬 Webhook EFI recebido:", dados)

        # 🔍 Extrai txid (Pix) ou charge_id (Boleto/Cartão)
        txid = dados.get("txid") or \
               (dados.get("pix", [{}])[0].get("txid") if "pix" in dados else None) or \
               dados.get("charge_id") or \
               dados.get("id")

        if not txid:
            print("⚠️ txid/charge_id não localizado no payload recebido.")
            return jsonify({"erro": "txid não fornecido"}), 400

        print(f"🔎 Verificando status para cobrança TXID: {txid}")

        # 🔄 Consulta status real da cobrança na EFI
        status_efi = consultar_status_cobranca(txid)
        if status_efi["status"] != "sucesso":
            return jsonify({"erro": "Erro ao consultar status"}), 500

        status_original = status_efi["dados"].get("status", "").upper()
        print(f"📌 Status retornado pela EFI: {status_original}")

        # 🎯 Mapeamento de status para status_pagamento
        mapa_status = {
            "CONCLUIDA": "Pago",
            "ATIVA": "Pendente",
            "REMOVIDA_PELO_USUARIO_RECEBEDOR": "Cancelado",
            "EXPIRADA": "Cancelado"
        }
        status_local = mapa_status.get(status_original, "Pendente")

        conn = Var_ConectarBanco()
        cursor = conn.cursor()

        # 🔐 Verifica se a fatura existe antes de atualizar
        cursor.execute("SELECT id FROM tbl_fatura WHERE id_efi_cobranca = ?", (txid,))
        fatura = cursor.fetchone()

        if not fatura:
            print(f"⚠️ Nenhuma fatura encontrada para o txid {txid}")
            return jsonify({"erro": "Fatura não encontrada para este txid."}), 404

        id_fatura = fatura[0]

        # 💾 Atualiza status no banco
        cursor.execute("""
            UPDATE tbl_fatura
            SET status_pagamento = ?
            WHERE id_efi_cobranca = ?
        """, (status_local, txid))
        conn.commit()

        print(f"✅ Status da fatura {id_fatura} atualizado para {status_local}")

        # 📤 Ações pós-pagamento
        if status_local == "Pago":
            print("🚀 Ações pós-pagamento: emitir nota fiscal, enviar e-mail, etc.")
            # emitir_nfse(id_fatura)
            # enviar_email_confirmacao_pagamento(id_fatura)

        return jsonify({"status": "sucesso", "mensagem": f"Status atualizado para {status_local}"}), 200

    except Exception as e:
        print("❌ Erro no webhook:", str(e))
        return jsonify({"erro": str(e)}), 500
