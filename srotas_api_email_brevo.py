# ────────────────────────────────────────────────
# INTEGRAÇÃO EMAIL BREVO
# ────────────────────────────────────────────────
import os
import json
import requests
from flask import Blueprint, request, jsonify, make_response, session
from datetime import datetime
from weasyprint import HTML
from extensoes import Var_ConectarBanco
from global_utils import (
    remover_tags_html,
    formata_data_brasileira,
    formata_moeda,
    valida_email
)

# ────────────────────────────────────────────────
# BLUEPRINT: LOGIN / AUTENTICAÇÃO
# ────────────────────────────────────────────────
brevo_bp = Blueprint(
    'brevo',
    __name__,
    template_folder='../templates',
    static_folder='../static',
    static_url_path='/static'
)

def init_app(app):
    app.register_blueprint(brevo_bp)
# ────────────────────────────────────────────────







ERROS_AMIGAVEIS = {
    "Mailbox full": "Caixa de e-mail cheia",
    "Temporary error": "\u23f3 Erro temporário no servidor do destinatário",
    "Email address does not exist": "Endereço de e-mail inválido",
    "User unknown": "Usuário de e-mail desconhecido",
    "Blocked due to spam": "Bloqueado por suspeita de spam",
    "Domain blacklisted": "Domínio bloqueado pelo provedor de destino",
    "Marked as spam": "Marcado como spam pelo destinatário",
    "Invalid email": "E-mail mal formatado",
    "Unsubscribed user": "Usuário descadastrado da lista",
    "Soft bounce - Relay not permitted": "Erro temporário: Rejeição pelo servidor do destinatário",
    "Hard bounce - Content rejected": "Conteúdo rejeitado pelo servidor",
    "Blocked (policy)": "Política de entrega bloqueou a mensagem"
}

@brevo_bp.route("/email/webhook", methods=["POST"])
def brevo_webhook():
    try:
        dados = request.get_json(silent=True)
        email = dados.get("email")
        evento = dados.get("event")
        data_evento = dados.get("date")
        motivo_bruto = dados.get("reason", "").strip()
        motivo_amigavel = ERROS_AMIGAVEIS.get(motivo_bruto, motivo_bruto or "Erro não especificado")

        tag_raw = dados.get("tag", "sem_tag")
        try:
            tag_lista = json.loads(tag_raw) if isinstance(tag_raw, str) else tag_raw
            tag = tag_lista[0] if isinstance(tag_lista, list) and tag_lista else "sem_tag"
        except Exception:
            tag = "sem_tag"

        if not email or not evento:
            return jsonify({"erro": "Campos obrigatórios ausentes"}), 400

        conn = Var_ConectarBanco()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT ed.id_destinatario
            FROM tbl_email_destinatario ed
            JOIN tbl_email_envio ee ON ed.id_envio = ee.id_envio
            WHERE ee.tag_email = %s AND ed.email = %s
        """, (tag, email))

        resultado = cursor.fetchone()
        if not resultado:
            return jsonify({"status": "ignorado", "motivo": "Destinatário não localizado"}), 200

        id_destinatario = resultado[0]
        try:
            data_evento_fmt = datetime.fromisoformat(data_evento.replace("Z", "+00:00"))
        except Exception:
            data_evento_fmt = datetime.utcnow()

        cursor.execute("""
            UPDATE tbl_email_destinatario
            SET status_atual = %s, dt_ultimo_evento = %s
            WHERE id_destinatario = %s
        """, (evento, data_evento_fmt, id_destinatario))

        cursor.execute("""
            INSERT INTO tbl_email_evento (id_destinatario, tipo_evento, data_evento, mensagem_erro)
            VALUES (%s, %s, %s, %s)
        """, (id_destinatario, evento, data_evento_fmt, motivo_amigavel))

        conn.commit()
        return jsonify({"status": "ok"})

    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    finally:
        if 'conn' in locals():
            conn.close()

@brevo_bp.route("/email/enviar", methods=["POST"])
def email_enviar():
    try:
        dados = request.get_json()
        destinatarios = dados.get("destinatarios", [])
        assunto = dados.get("assunto", "").strip()
        corpo_html = dados.get("corpo_html", "").strip()
        tag = dados.get("tag", "sem_tag")

        if not destinatarios or not assunto or not corpo_html:
            return jsonify({"erro": "Assunto, corpo e destinatários são obrigatórios."}), 400

        id_empresa = session.get("id_empresa") or dados.get("id_empresa") or dados.get("id_cliente")
        if not id_empresa:
            return jsonify({"erro": "Cliente não identificado."}), 403

        payload = {
            "sender": {
                "name": os.getenv("BREVO_REMETENTE_NOME"),
                "email": os.getenv("BREVO_REMETENTE_EMAIL")
            },
            "to": [{"email": email.strip()} for email in destinatarios],
            "subject": assunto,
            "htmlContent": corpo_html,
            "tags": [tag],
            "id_empresa": id_empresa
        }

        headers = {
            "accept": "application/json",
            "api-key": os.getenv("BREVO_API_KEY"),
            "content-type": "application/json"
        }

        response = requests.post("https://api.brevo.com/v3/smtp/email", json=payload, headers=headers)
        if response.status_code not in [200, 201]:
            return jsonify({"erro": "Erro ao enviar e-mail via API"}), 500

        conn = Var_ConectarBanco()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO tbl_email_envio (id_empresa, tag_email, assunto, corpo, dt_envio)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id_envio
        """, (
            id_empresa,
            tag,
            remover_tags_html(corpo_html),
            assunto,
            datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        ))

        id_envio = cursor.fetchone()[0]

        for email in destinatarios:
            cursor.execute("""
                INSERT INTO tbl_email_destinatario (id_envio, email, status_atual, tag_email)
                VALUES (%s, %s, %s, %s)
            """, (id_envio, email.strip(), "Enviado", tag))

        cursor.execute("""
            INSERT INTO tbl_email_log (id_empresa, assunto, corpo, destinatario, status, tag, data_envio)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            id_empresa,
            assunto,
            remover_tags_html(corpo_html),
            ", ".join(destinatarios),
            "Enviado",
            tag,
            datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        ))

        conn.commit()
        return jsonify({"status": "sucesso", "mensagem": "E-mail enviado com sucesso!"})

    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    finally:
        if 'conn' in locals():
            conn.close()
