import os
from flask import Blueprint, render_template, send_from_directory
from flask import request, jsonify
import bcrypt
import sqlite3



# Função para conectar ao banco (ajustar se necessário para seu projeto)
def Var_ConectarBanco():
    caminho = os.path.join(os.path.dirname(__file__), "..", "..", "database", "bd_rufino.db")
    print(f"🛠️ Tentando abrir banco em: {os.path.abspath(caminho)}")
    return sqlite3.connect(caminho)


# CRIA O BLUEPRINT
auth_bp = Blueprint(
    'auth',
    __name__,
    template_folder='.',       # HTML está dentro da própria pasta
    static_folder='static',         # CSS, JS e imagens também
    static_url_path='/auth'    # A URL vai começar com /auth
)

# ------------------------------------------------------------------------------
# CONFIGURAÇÕES
@auth_bp.route("/configuracoes/<int:id_cliente>", methods=["GET"])
def configuracoes(id_cliente):
    try:
        conn = Var_ConectarBanco()
        cursor = conn.cursor()

        cursor.execute("SELECT chave, valor FROM tbl_config WHERE id_cliente = ?", (id_cliente,))
        registros = cursor.fetchall()

        config = {}
        for chave, valor in registros:
            config[chave] = valor

        return jsonify(success=True, config=config)
    except Exception as e:
        return jsonify(success=False, message=str(e))




# ------------------------------------------------------------------------------
# Rota para LOGIN
# Exibir a página de login
@auth_bp.route('/login')
def exibir_login():
    return render_template('login.html')

# Autenticar o login do usuário
@auth_bp.route('/login', methods=['POST'])
def autenticar_login():
    try:
        dados = request.get_json()
        email = dados.get('email')
        senha = dados.get('senha')

        if not email or not senha:
            return jsonify(success=False, message="Email e senha são obrigatórios."), 400

        conn = Var_ConectarBanco()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id_usuario, id_cliente, nome, nome_completo, foto, email, senha, grupo, departamento, whatsapp, status
            FROM tbl_usuario
            WHERE email = ?
        """, (email,))
        usuario = cursor.fetchone()

        if not usuario:
            return jsonify(success=False, message="Usuário não encontrado."), 404

        (
            id_usuario, id_cliente, nome, nome_completo, foto, email_db,
            senha_db, grupo, departamento, whatsapp, status
        ) = usuario

        if status == "Inativo":
            return jsonify(success=False, message="Usuário inativo. Entre em contato com o administrador."), 403
        if status == "Bloqueado":
            return jsonify(success=False, message="Usuário bloqueado. Solicite o desbloqueio ou recuperação de senha."), 403

        if not bcrypt.checkpw(senha.encode('utf-8'), senha_db.encode('utf-8')):
            return jsonify(success=False, message="Senha inválida."), 401

        usuario_dados = {
            "id_usuario": id_usuario,
            "id_cliente": id_cliente,
            "nome": nome,
            "nome_completo": nome_completo,
            "foto": foto,
            "email": email_db,
            "grupo": grupo,
            "departamento": departamento,
            "whatsapp": whatsapp,
            "status": status,
            "horaLogin": str(request.date) if hasattr(request, 'date') else None
        }

        return jsonify(success=True, usuario=usuario_dados)

    except Exception as e:
        print(f"Erro ao realizar login: {e}")
        return jsonify(success=False, message="Erro interno ao realizar login."), 500



# ------------------------------------------------------------------------------
# --------------------- PROCESSOS ESQUECI A SENHA-------------------------------
# ------------------------------------------------------------------------------

@auth_bp.route("/usuario/recuperar", methods=["POST"])
def usuario_recuperar():
    from flask import request, jsonify
    import secrets
    from datetime import datetime, timedelta
    import smtplib
    from email.mime.text import MIMEText

    try:
        dados = request.get_json()
        email = dados.get("email")

        if not email:
            return jsonify({"erro": "E-mail não informado."}), 400

        conn = Var_ConectarBanco()
        cursor = conn.cursor()

        cursor.execute("SELECT id_usuario, nome FROM tbl_usuario WHERE email = ? AND status = 'Ativo'", (email,))
        usuario = cursor.fetchone()

        if not usuario:
            return jsonify({"erro": "Usuário não encontrado ou inativo."}), 404

        id_usuario, nome = usuario
        token = secrets.token_urlsafe(32)
        expira_em = datetime.now() + timedelta(hours=1)

        cursor.execute("""
            UPDATE tbl_usuario SET token_redefinicao = ?, expira_em = ?
            WHERE id_usuario = ?
        """, (token, expira_em, id_usuario))
        conn.commit()

        # Enviar e-mail com link
        link = f"https://rufino.tech/redefinir-senha.html?token={token}"
        assunto = "Redefinição de Senha - Rufino Tech"
        corpo = f"""
        Olá, {nome}.\n\n
        Você solicitou a redefinição de senha para sua conta.\n
        Clique no link abaixo para escolher uma nova senha:\n
        {link}\n\n
        Este link expira em 1 hora.\n
        Se não foi você, ignore esta mensagem.
        """

        msg = MIMEText(corpo)
        msg["Subject"] = assunto
        msg["From"] = "nao-responda@rufino.tech"
        msg["To"] = email

        with smtplib.SMTP("smtp.seudominio.com", 587) as servidor:
            servidor.starttls()
            servidor.login("usuario_smtp", "senha_smtp")
            servidor.send_message(msg)

        return jsonify({"sucesso": True, "mensagem": "E-mail de recuperação enviado com sucesso."})

    except Exception as e:
        print("Erro ao recuperar senha:", e)
        return jsonify({"erro": "Erro interno ao processar solicitação."}), 500



@auth_bp.route("/usuario/validar-token", methods=["GET"])
def usuario_validar_token():
    from flask import request, jsonify
    from datetime import datetime

    token = request.args.get("token")
    if not token:
        return jsonify({"valido": False, "mensagem": "Token não informado."})

    conn = Var_ConectarBanco()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id_usuario FROM tbl_usuario
        WHERE token_redefinicao = ? AND expira_em >= ?
    """, (token, datetime.now()))

    usuario = cursor.fetchone()
    if usuario:
        return jsonify({"valido": True})
    else:
        return jsonify({"valido": False, "mensagem": "Token inválido ou expirado."})


@auth_bp.route("/usuario/atualizar-senha", methods=["POST"])
def usuario_atualizar_senha():
    from flask import request, jsonify
    from datetime import datetime
    import bcrypt
    import re

    dados = request.get_json()
    token = dados.get("token")
    nova = dados.get("nova_senha")
    confirmar = dados.get("confirmar")

    if not token or not nova or not confirmar:
        return jsonify({"erro": "Todos os campos são obrigatórios."}), 400

    if nova != confirmar:
        return jsonify({"erro": "As senhas não coincidem."}), 400

    # Validação dos critérios
    if len(nova) < 8 or not re.search(r"[a-z]", nova) or not re.search(r"[A-Z]", nova) \
       or not re.search(r"[0-9]", nova) or not re.search(r"[\W_]", nova):
        return jsonify({"erro": "Senha não atende aos critérios de segurança."}), 400

    conn = Var_ConectarBanco()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id_usuario FROM tbl_usuario
        WHERE token_redefinicao = ? AND expira_em >= ?
    """, (token, datetime.now()))
    usuario = cursor.fetchone()

    if not usuario:
        return jsonify({"erro": "Token inválido ou expirado."}), 400

    id_usuario = usuario[0]
    senha_hash = bcrypt.hashpw(nova.encode(), bcrypt.gensalt()).decode()

    cursor.execute("""
        UPDATE tbl_usuario SET senha = ?, token_redefinicao = NULL, expira_em = NULL
        WHERE id_usuario = ?
    """, (senha_hash, id_usuario))
    conn.commit()

    return jsonify({"sucesso": True, "mensagem": "Senha atualizada com sucesso!"})
