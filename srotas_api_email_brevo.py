# ────────────────────────────────────────────────
# INTEGRAÇÃO EMAIL BREVO
# ────────────────────────────────────────────────
import os
import json
import requests
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from flask import Blueprint, request, jsonify, make_response, session
from datetime import datetime
from weasyprint import HTML
from global_utils import (
    remover_tags_html,
    login_obrigatorio,
    valida_email,
    Var_ConectarBanco
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
# Rota pública: /email/enviar  (sem login)
# ────────────────────────────────────────────────
# ================= Rodapé padrão =================
def _montar_footer_padrao_row() -> str:
    return """
    <tr>
      <td style="background:#1A1C1F;color:#DDDDDD;font-family:Arial,Helvetica,sans-serif;
                 padding:16px 24px;font-size:12px;line-height:1.6;">
        <p style="margin:0 0 10px 0;">
          Este e-mail foi enviado por <b>notifica@rufino.tech</b>.
        </p>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0"
               style="color:#C9C9C9;font-size:12px;">
          <tr>
            <td valign="top" style="padding-right:8px;">•</td>
            <td>Nunca pedimos sua senha por e-mail.</td>
          </tr>
          <tr>
            <td valign="top" style="padding-right:8px;">•</td>
            <td>Verifique se o link começa com <b>rufino.tech</b>.</td>
          </tr>
        </table>

        <p style="margin:12px 0 0 0;">
          Dúvidas? Veja a
          <a href="https://rufino.tech/politica-de-privacidade" target="_blank"
             style="color:#85C300;text-decoration:none;">Política de Privacidade</a>.
        </p>
        <p style="margin:12px 0 0 0;color:#AAAAAA;">
          © 2025 Rufino. Todos os direitos reservados.
        </p>
      </td>
    </tr>
    """

def _anexar_footer(html: str) -> str:
    html = html or ""
    if "política de privacidade".casefold() in html.casefold():
        return html
    if "<!--RF_FOOTER-->" in html:
        return html.replace("<!--RF_FOOTER-->", _montar_footer_padrao_row())
    return html  # sem fallback fora do card (pra não mexer fora da área marcada)



# ================= ENVIAR VIA API =================
@brevo_bp.route("/email/enviar", methods=["POST"])
def email_enviar():
    """
    - Não exige sessão.
    - id_empresa: OBRIGATÓRIO neste fluxo (já criado na rota de cadastro).
    - A TAG SEMPRE será "<tag_base>_<id_empresa>" (ignora tag vinda do front).
    - Rodapé padrão é anexado aqui (_montar_footer_padrao()).
    """
    d = request.get_json(silent=True) or {}

    # 3) id_empresa (obrigatório aqui porque a tag e os registros dependem dele)
    id_empresa = d.get("id_empresa")
    if not id_empresa:
        return jsonify({"erro": "id_empresa é obrigatório para envio e registro."}), 400

    # 4) Campos básicos (sem validações extras aqui)
    destinatarios = d.get("destinatarios") or []
    assunto       = (d.get("assunto") or "").strip()
    corpo_html    = (d.get("corpo_html") or "").strip()


    # ✅ usa a tag exatamente como veio do chamador
    tag = (d.get("tag") or "").strip()
    if not tag:
        return jsonify({"erro": "tag é obrigatória."}), 400


    # 7) Corpo final com rodapé padrão
    corpo_html_final = _anexar_footer(corpo_html)


    # 8) Envio via Brevo
    payload = {
        "sender": {"name": "Notifica Tech", "email": "notifica@rufino.tech"},
        "to": [{"email": e} for e in destinatarios],
        "subject": assunto,
        "htmlContent": corpo_html_final,
        "tags": [tag] if tag else []
    }
    headers = {
        "accept": "application/json",
        "api-key": os.getenv("BREVO_API_KEY", ""),
        "content-type": "application/json"
    }
    resp = requests.post("https://api.brevo.com/v3/smtp/email", json=payload, headers=headers, timeout=15)

    # 9) Registro no banco (sempre com id_empresa)
    conn = None
    try:
        conn = Var_ConectarBanco(); cur = conn.cursor()

        status_txt = "Enviado" if resp.status_code in (200, 201) else f"Falha {resp.status_code}"
        corpo_limpo = remover_tags_html(corpo_html_final)

        # tbl_email_envio
        cur.execute("""
            INSERT INTO tbl_email_envio (id_empresa, tag_email, assunto, corpo, dt_envio)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id_envio
        """, (id_empresa, tag, assunto, corpo_limpo, datetime.now()))
        id_envio = cur.fetchone()[0]

        # tbl_email_destinatario
        for e in destinatarios:
            cur.execute("""
                INSERT INTO tbl_email_destinatario
                      (id_envio, email, status_atual, dt_ultimo_evento, tag_email, id_empresa)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (id_envio, e, status_txt, None, tag, id_empresa))

        # tbl_email_log
        cur.execute("""
            INSERT INTO tbl_email_log (assunto, corpo, destinatario, status, tag, id_empresa, data_envio)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (assunto, corpo_limpo, ", ".join(destinatarios),
              status_txt, tag, id_empresa, datetime.now()))

        conn.commit()
    finally:
        if conn: conn.close()

    # 10) Retorno
    if resp.status_code not in (200, 201):
        return jsonify({
            "erro": "Falha ao enviar e-mail via Brevo.",
            "status_code": resp.status_code,
            "detalhes": (resp.text or "")[:500]
        }), 502

    return jsonify({"status": "sucesso", "mensagem": "E-mail enviado com sucesso."})





# ────────────────────────────────────────────────
# Rota pública: /email/webhook 
# ────────────────────────────────────────────────
# ================= WEBHOOK (sem login) =================
ERROS_AMIGAVEIS = {
    "Mailbox full": "Caixa de e-mail cheia",
    "Temporary error": "⏳ Erro temporário no servidor do destinatário",
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
        dados = request.get_json(silent=True) or {}
        email = (dados.get("email") or "").strip().lower()
        evento = (dados.get("event") or "").strip()
        data_evento = (dados.get("date") or "").strip()
        motivo_bruto = (dados.get("reason") or "").strip()
        motivo_amigavel = ERROS_AMIGAVEIS.get(motivo_bruto, motivo_bruto or "Erro não especificado")

        tag_raw = dados.get("tag", "sem_tag")
        try:
            tag_lista = json.loads(tag_raw) if isinstance(tag_raw, str) else tag_raw
            tag = tag_lista[0] if isinstance(tag_lista, list) and tag_lista else "sem_tag"
        except Exception:
            tag = "sem_tag"

        if not email or not evento:
            return jsonify({"erro": "Campos obrigatórios ausentes"}), 400

        conn = Var_ConectarBanco(); cur = conn.cursor()

        # acha id_destinatario e id_empresa
        cur.execute("""
            SELECT ed.id_destinatario, ee.id_empresa
              FROM tbl_email_destinatario ed
              JOIN tbl_email_envio ee ON ed.id_envio = ee.id_envio
             WHERE ed.email = %s
               AND ed.tag_email = %s
        """, (email, tag))
        row = cur.fetchone()
        if not row:
            return jsonify({"status": "ignorado", "motivo": "Destinatário não localizado"}), 200

        id_destinatario, id_empresa = row

        try:
            data_evento_fmt = datetime.fromisoformat(data_evento.replace("Z", "+00:00")) if data_evento else datetime.utcnow()
        except Exception:
            data_evento_fmt = datetime.utcnow()

        cur.execute("""
            UPDATE tbl_email_destinatario
               SET status_atual = %s, dt_ultimo_evento = %s
             WHERE id_destinatario = %s
        """, (evento, data_evento_fmt, id_destinatario))

        # tbl_email_evento: (id_destinatario, tipo_evento, data_evento, mensagem_erro, id_empresa)
        cur.execute("""
            INSERT INTO tbl_email_evento
                   (id_destinatario, tipo_evento, data_evento, mensagem_erro, id_empresa)
            VALUES (%s, %s, %s, %s, %s)
        """, (id_destinatario, evento, data_evento_fmt, motivo_amigavel, id_empresa))

        conn.commit()
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    finally:
        if 'conn' in locals() and conn:
            conn.close()