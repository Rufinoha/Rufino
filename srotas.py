# ────────────────────────────────────────────────
# 1️⃣ DECLARAÇÕES
# ────────────────────────────────────────────────
import os
import re
import secrets
import bcrypt
import requests
import calendar
import psycopg2
import html
from datetime import date, datetime, timedelta
from email.mime.text import MIMEText
from dotenv import load_dotenv
from pathlib import Path
from werkzeug.utils import secure_filename
from functools import wraps
from urllib.parse import urlparse
from flask import (
    Blueprint, render_template, request, jsonify, session, redirect, url_for,
    send_from_directory, make_response, current_app as app
)

# Importar arquivos de rotas
from srotas_api_efi import gerar_cobranca_efi
from srotas_api_email_brevo import brevo_bp
from modelos import (
    TblAssinaturaCliente, TblChamado, TblChamadoMensagem, TblChamadoMensagemAnexo,
    TblConfig, TblEmailEnvio, TblEmailDestinatario, TblEmailEvento, TblEmailLog,
    TblEmpresa, TblFatura, TblFaturaAssinatura, TblMenu, TblNovidades,
    TblUsuario, TblUsuarioGrupo, TblUsuarioPermissaoGrupo
)
from global_utils import (
    remover_tags_html,
    formata_data_brasileira,
    formata_moeda,
    valida_email,
)




# Carrega variáveis do .env
load_dotenv()

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
# 5️⃣ BLUEPRINT: LOGIN / AUTENTICAÇÃO
# ────────────────────────────────────────────────
auth_bp = Blueprint(
    'auth',
    __name__,
    template_folder='../templates',
    static_folder='../static',
    static_url_path='/static'
)

def init_app(app):
    app.register_blueprint(auth_bp)
# ────────────────────────────────────────────────

# ────────────────────────────────────────────────
# 6️⃣ OUTRAS FUNÇÕES ÚTEIS
# ────────────────────────────────────────────────

def remover_tags_html(texto):
    return re.sub('<[^<]+?>', '', texto)

def get_base_url():
    return "https://rufino.tech" if os.getenv("MODO_PRODUCAO", "false").lower() == "true" else "http://127.0.0.1:5000"

def login_obrigatorio(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        if not session.get("id_usuario"):
            return redirect(url_for("rotas.Var_Login"))  # ou o nome correto da sua rota de login
        return func(*args, **kwargs)
    return wrapper




def configurar_tempo_sessao(id_empresa):
    try:
        conn = Var_ConectarBanco()
        cur = conn.cursor()
        cur.execute("""
            SELECT valor 
            FROM tbl_config 
            WHERE chave = 'tempo_sessao_minutos' AND id_empresa = %s
        """, (id_empresa,))
        resultado = cur.fetchone()
        conn.close()

        if resultado:
            return timedelta(minutes=int(resultado[0]))
    except Exception as e:
        print("⚠️ Erro ao configurar tempo de sessão:", str(e))
    
    return timedelta(minutes=30)  # Valor padrão


# ────────────────────────────────────────────────
# Rota para testar conexão com banco
# ────────────────────────────────────────────────

@auth_bp.route("/teste_banco")
def teste_banco():
    try:
        conn = Var_ConectarBanco()
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM tbl_usuario")
        qtd = cur.fetchone()[0]
        conn.close()
        return f"✅ Conectado ao banco! Existem {qtd} usuários cadastrados."
    except Exception as e:
        return f"❌ Erro de conexão: {e}"




# ────────────────────────────────────────────────
# função de geração automáticaou manual de fatura
# ────────────────────────────────────────────────
def gerar_faturas_mensais():
    print("📅 Iniciando geração de faturas mensais...")

    try:
        conn = Var_ConectarBanco()
        cursor = conn.cursor()

        hoje = date.today()
        primeiro_dia_mes = hoje.replace(day=1)
        vencimento = primeiro_dia_mes.replace(day=15)

        # 🔍 Buscar todos os clientes com assinaturas ativas
        cursor.execute("""
            SELECT id_empresa, id_modulo, dt_inicio, forma_pagamento
            FROM tbl_assinatura_cliente
            WHERE status = 'Ativo'
        """)
        assinaturas = cursor.fetchall()

        faturas_criadas = 0

        for assinatura in assinaturas:
            id_empresa, id_modulo, dt_inicio, forma_pagamento = assinatura

            # ⏱️ Definir o período da assinatura para a fatura
            periodo_inicio = max(dt_inicio, primeiro_dia_mes - timedelta(days=30))
            periodo_fim = primeiro_dia_mes - timedelta(days=1)

            dias_utilizados = (periodo_fim - periodo_inicio).days + 1
            dias_no_mes = (periodo_fim.replace(day=28) + timedelta(days=4)).replace(day=1) - periodo_fim.replace(day=1)
            dias_no_mes = dias_no_mes.days

            # 💰 Valor mensal da assinatura
            cursor.execute("SELECT valor FROM tbl_menu WHERE id = %s", (id_modulo,))
            resultado = cursor.fetchone()
            valor_mensal = resultado[0] if resultado else 0.0

            # 🔢 Calcular valor proporcional
            valor_proporcional = round((valor_mensal / dias_no_mes) * dias_utilizados, 2)

            # 🧾 Criar a fatura principal
            cursor.execute("""
                INSERT INTO tbl_fatura (id_empresa, dt_referencia, vencimento, valor_total, desconto, acrescimo, forma_pagamento, status_pagamento)
                VALUES (%s, %s, %s, %s, 0, 0, %s, 'Pendente')
            """, (id_empresa, primeiro_dia_mes.isoformat(), vencimento.isoformat(), valor_proporcional, forma_pagamento))
            id_fatura = cursor.fetchone()[0]

            # 🧾 Inserir detalhe da fatura
            cursor.execute("""
                INSERT INTO tbl_fatura_assinatura (id_fatura, id_modulo, periodo_inicio, periodo_fim, valor)
                VALUES (%s, %s, %s, %s, %s)
            """, (id_fatura, id_modulo, periodo_inicio.isoformat(), periodo_fim.isoformat(), valor_proporcional))

            faturas_criadas += 1

        conn.commit()
        print(f"✅ {faturas_criadas} faturas criadas com sucesso.")

    except Exception as e:
        print(f"❌ Erro ao gerar faturas: {str(e)}")
    finally:
        if conn:
            conn.close()

   
def enviar_email_fatura(id_fatura):
    try:
        conn = Var_ConectarBanco()
        cursor = conn.cursor()

        # 📦 Dados da fatura
        cursor.execute("""
            SELECT F.id, F.valor_total, F.vencimento, F.forma_pagamento, F.status_pagamento,
                   F.id_empresa, C.nome_fantasia, C.email
            FROM tbl_fatura F
            JOIN tbl_config C ON F.id_empresa = C.id_empresa
            WHERE F.id = %s
        """, (id_fatura,))
        fatura = cursor.fetchone()

        if not fatura:
            print("⚠️ Fatura não encontrada para envio.")
            return

        id_fatura, valor_total, vencimento, forma_pagamento, status, id_empresa, nome_cliente, email_destino = fatura

        # 📄 Detalhes da fatura
        cursor.execute("""
            SELECT M.nome_menu, D.periodo_inicio, D.periodo_fim, D.valor
            FROM tbl_fatura_assinatura D
            JOIN tbl_menu M ON D.id_modulo = M.id
            WHERE D.id_fatura = %s
        """, (id_fatura,))
        detalhes = cursor.fetchall()

        # 🧱 Monta tabela HTML com os detalhes
        html_detalhes = ""
        for nome_menu, inicio, fim, valor in detalhes:
            html_detalhes += f"<tr><td>{nome_menu}</td><td>{inicio}</td><td>{fim}</td><td>R$ {valor:.2f}</td></tr>"

        corpo_html = f"""
        <h3>Fatura #{id_fatura} - {nome_cliente}</h3>
        <p>Prezado cliente,</p>
        <p>Segue abaixo o resumo da sua fatura com vencimento em <strong>{vencimento}</strong>.</p>
        <table border="1" cellspacing="0" cellpadding="6">
            <thead><tr><th>App</th><th>Início</th><th>Fim</th><th>Valor</th></tr></thead>
            <tbody>{html_detalhes}</tbody>
        </table>
        <p><strong>Total:</strong> R$ {valor_total:.2f}</p>
        <p>Forma de pagamento escolhida: <strong>{forma_pagamento}</strong></p>
        <p>Você receberá o link de pagamento assim que a cobrança for registrada.</p>
        """

        # 🔁 URL dinâmica conforme o modo de produção
        url_base = os.getenv("BASE_PROD") if os.getenv("MODO_PRODUCAO", "false").lower() == "true" else os.getenv("BASE_DEV")
        url_envio = f"{url_base}/email/enviar"

        # ✉️ Payload conforme a rota definida
        payload = {
            "destinatarios": [email_destino],
            "assunto": f"💼 Fatura #{id_fatura} - Sistema Rufino",
            "corpo_html": corpo_html,
            "tag": "fatura_assinatura"
        }

        response = requests.post(url_envio, json=payload)
        if response.status_code == 200:
            print(f"📤 E-mail da fatura #{id_fatura} enviado para {email_destino}")
        else:
            print(f"❌ Erro ao enviar e-mail. Status: {response.status_code}, Resposta: {response.text}")

    except Exception as e:
        print(f"❌ Erro ao montar e enviar e-mail de fatura: {str(e)}")
    finally:
        if conn:
            conn.close()




# ────────────────────────────────────────────────
# 6️⃣ ROTAS DE PÁGINA PRINCIPAL (HOME, INDEX)
# ────────────────────────────────────────────────

@auth_bp.route('/')
def home():
    return render_template('home.html')

@auth_bp.route('/index')
def index():
    return render_template('index.html')

@auth_bp.route("/main")
def main():
    return render_template("index.html")


# ────────────────────────────────────────────────
# 4️⃣ ROTAS PARA CARREGAR DINAMICO O HTML NO INDEX
# ────────────────────────────────────────────────

@auth_bp.route("/<pagina>", methods=["GET"])
def abrir_pagina(pagina):
    try:
        return render_template(f"frm_{pagina}.html")
    except Exception as e:
        return f"❌ Erro ao carregar página: {str(e)}", 404


# ────────────────────────────────────────────────
# 4️⃣ ROTAS DE LOGIN / AUTENTICAÇÃO
# ────────────────────────────────────────────────

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

        # 🔍 Traz exatamente os campos existentes na tabela
        cursor.execute("""
            SELECT 
                id_usuario, id_empresa, nome, nome_completo, email, senha, grupo, 
                departamento, whatsapp, status, ultimo_login, trocasenha_em, imagem,
                consentimento_lgpd, consentimento_marketing
            FROM tbl_usuario
            WHERE email = %s AND status = 'Ativo'
        """, (email,))
        usuario = cursor.fetchone()

        if not usuario:
            return jsonify(success=False, message="Usuário não encontrado."), 404

        (
            id_usuario, id_empresa, nome, nome_completo, email_db, senha_db, grupo,
            departamento, whatsapp, status, ultimo_login, trocasenha_em, imagem,
            consentimento_lgpd, consentimento_marketing
        ) = usuario

        if status == "Inativo":
            return jsonify(success=False, message="Usuário inativo. Entre em contato com o administrador."), 403
        if status == "Bloqueado":
            return jsonify(success=False, message="Usuário bloqueado. Solicite o desbloqueio ou recuperação de senha."), 403

        senha_em_bytes = senha_db.encode('utf-8') if isinstance(senha_db, str) else senha_db
        if not bcrypt.checkpw(senha.encode('utf-8'), senha_em_bytes):
            return jsonify(success=False, message="Senha inválida."), 401

        # Buscar nome da empresa
        cursor.execute("SELECT nome_empresa FROM tbl_empresa WHERE id = %s", (id_empresa,))
        empresa_row = cursor.fetchone()
        nome_empresa = empresa_row[0] if empresa_row else ""

        #Atualiza sessão
        session["usuario_id"] = id_usuario
        session["id_usuario"] = id_usuario
        session["id_empresa"] = id_empresa
        session["grupo"] = grupo 

        #Configura tempo de sessão com base na empresa
        session.permanent = True
        app.permanent_session_lifetime = configurar_tempo_sessao(id_empresa)

        # Verifica se está na hora de trocar a senha
        if trocasenha_em and datetime.now().date() >= trocasenha_em.date():
            return jsonify({"trocar_senha": True})


        # Dados para o frontend
        usuario_dados = {
            "id_usuario": id_usuario,
            "id_empresa": id_empresa,
            "nome": nome,
            "nome_completo": nome_completo,
            "email": email_db,
            "grupo": grupo,
            "departamento": departamento,
            "whatsapp": whatsapp,
            "status": status,
            "imagem": imagem,
            "ultimo_login": str(ultimo_login) if ultimo_login else "",
            "horaLogin": str(datetime.now()),
            "nome_empresa": nome_empresa,
            "consentimento_lgpd": bool(consentimento_lgpd),
            "consentimento_marketing": bool(consentimento_marketing)
        }

        return jsonify(success=True, usuario=usuario_dados)

    except Exception as e:
        print(f"Erro ao realizar login: {e}")
        return jsonify(success=False, message="Erro interno ao realizar login."), 500



# Sair da sessão (logout)
@auth_bp.route('/logout', methods=["POST"])
def logout():
    session.clear()
    return '', 204

# Processos Esqueci a Senha ARRUMAR
@auth_bp.route("/usuario/recuperar", methods=["POST"])
def usuario_recuperar():
    try:
        dados = request.get_json()
        email = dados.get("email")

        if not email:
            return jsonify({"erro": "E-mail não informado."}), 400

        conn = Var_ConectarBanco()
        cursor = conn.cursor()

        cursor.execute("SELECT id_usuario, nome FROM tbl_usuario WHERE email = %s AND status = 'Ativo'", (email,))
        usuario = cursor.fetchone()

        if not usuario:
            return jsonify({"erro": "Usuário não encontrado ou inativo."}), 404

        id_usuario, nome = usuario
        token = secrets.token_urlsafe(32)
        expira_em = datetime.now() + timedelta(hours=1)

        cursor.execute("""
            UPDATE tbl_usuario SET token_redefinicao = %s, expira_em = %s
            WHERE id_usuario = %s
        """, (token, expira_em, id_usuario))
        conn.commit()

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

        

        return jsonify({"sucesso": True, "mensagem": "E-mail de recuperação enviado com sucesso."})

    except Exception as e:
        print("Erro ao recuperar senha:", e)
        return jsonify({"erro": "Erro interno ao processar solicitação."}), 500


@auth_bp.route("/usuario/validar-token", methods=["GET"])
def usuario_validar_token():
    token = request.args.get("token")
    if not token:
        return jsonify({"valido": False, "mensagem": "Token não informado."})

    conn = Var_ConectarBanco()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id_usuario FROM tbl_usuario
        WHERE token_redefinicao = %s AND expira_em >= %s
    """, (token, datetime.now()))

    usuario = cursor.fetchone()
    if usuario:
        return jsonify({"valido": True})
    else:
        return jsonify({"valido": False, "mensagem": "Token inválido ou expirado."})


@auth_bp.route("/usuario/atualizar-senha", methods=["POST"])
def usuario_atualizar_senha():
    dados = request.get_json()
    token = dados.get("token")
    nova = dados.get("nova_senha")
    confirmar = dados.get("confirmar")

    if not token or not nova or not confirmar:
        return jsonify({"erro": "Todos os campos são obrigatórios."}), 400

    if nova != confirmar:
        return jsonify({"erro": "As senhas não coincidem."}), 400

    if len(nova) < 8 or not re.search(r"[a-z]", nova) or not re.search(r"[A-Z]", nova) \
       or not re.search(r"[0-9]", nova) or not re.search(r"[\W_]", nova):
        return jsonify({"erro": "Senha não atende aos critérios de segurança."}), 400

    conn = Var_ConectarBanco()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id_usuario FROM tbl_usuario
        WHERE token_redefinicao = %s AND expira_em >= %s
    """, (token, datetime.now()))
    usuario = cursor.fetchone()

    if not usuario:
        return jsonify({"erro": "Token inválido ou expirado."}), 400

    id_usuario = usuario[0]
    senha_hash = bcrypt.hashpw(nova.encode(), bcrypt.gensalt()).decode()

    cursor.execute("""
        UPDATE tbl_usuario SET senha = %s, token_redefinicao = NULL, expira_em = NULL
        WHERE id_usuario = %s
    """, (senha_hash, id_usuario))
    conn.commit()

    return jsonify({"sucesso": True, "mensagem": "Senha atualizada com sucesso!"})


@auth_bp.route("/usuario/apoio")
def usuario_apoio():
    try:
        id_usuario = request.args.get("id")
        if not id_usuario:
            return jsonify({"status": "erro", "mensagem": "ID do usuário não informado."}), 400

        conn = Var_ConectarBanco()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT u.id_usuario AS id,
                   u.nome_completo,
                   u.nome,
                   u.email,
                   u.whatsapp,
                   u.departamento,
                   u.status,
                   g.nome_grupo AS grupo
            FROM tbl_usuario u
            LEFT JOIN tbl_usuario_grupo g ON u.id_grupo = g.id_grupo
            WHERE u.id_usuario = %s
        """, (id_usuario,))
        
        usuario = cursor.fetchone()
        if not usuario:
            return jsonify({"status": "erro", "mensagem": "Usuário não encontrado."}), 404

        colunas = [col[0] for col in cursor.description]
        dados_usuario = dict(zip(colunas, usuario))

        return jsonify({"status": "sucesso", "dados": dados_usuario})
    
    except Exception as e:
        return jsonify({"status": "erro", "mensagem": f"Erro ao buscar usuário: {str(e)}"}), 500



# ────────────────────────────────────────────────
# 5️⃣ ROTAS DE CONFIGURAÇÕES
# ────────────────────────────────────────────────

@auth_bp.route("/configuracoes/<int:id_empresa>", methods=["GET"])
def configuracoes(id_empresa):
    try:
        conn = Var_ConectarBanco()
        cursor = conn.cursor()

        cursor.execute("SELECT chave, valor FROM tbl_config WHERE id_empresa = %s", (id_empresa,))
        registros = cursor.fetchall()

        config = {}
        for chave, valor in registros:
            config[chave] = valor

        return jsonify(success=True, config=config)
    except Exception as e:
        return jsonify(success=False, message=str(e))


# 🔍 Buscar CNPJ via API ReceitaWS
@auth_bp.route('/api/buscacnpj', methods=['POST'])
def buscar_cnpj():
    try:
        dados = request.get_json()
        cnpj = dados.get("cnpj", "").replace(".", "").replace("/", "").replace("-", "")

        if len(cnpj) != 14:
            return jsonify({"erro": "CNPJ inválido"}), 400

        resposta = requests.get(f"https://www.receitaws.com.br/v1/cnpj/{cnpj}")
        data = resposta.json()

        if data.get("status") == "ERROR":
            return jsonify({"erro": data.get("message", "Erro na consulta")}), 400

        resultado = {
            "empresa": data.get("nome"),
            "endereco": data.get("logradouro"),
            "numero": data.get("numero", ""),
            "bairro": data.get("bairro"),
            "cidade": data.get("municipio"),
            "uf": data.get("uf"),
            "cep": data.get("cep"),
            "ie": data.get("inscricao_estadual", "")
        }

        return jsonify(resultado)

    except Exception as e:
        return jsonify({"erro": "Erro inesperado ao consultar CNPJ"}), 500





# ────────────────────────────────────────────────
# 5️⃣ ROTAS DE CADASTRO
# ────────────────────────────────────────────────

@auth_bp.route("/cadastro/abrir")
def frm_cadastro():
    return render_template("frm_cadastro.html")



@auth_bp.route("/cadastro/novo", methods=["POST"])
def cadastro_novo():
    try:
        dados = request.get_json()
        if not dados:
            return jsonify({"mensagem": "Dados não recebidos."}), 400

        # 🔍 Dados recebidos
        nome_completo = dados.get("nome_completo", "").strip()
        email = dados.get("email", "").strip().lower()
        cnpj = dados.get("cnpj", "").strip()
        empresa = dados.get("empresa", "").strip()
        ie = dados.get("ie", "").strip()
        cep = dados.get("cep", "").strip()
        endereco = dados.get("endereco", "").strip()
        numero = dados.get("numero", "").strip()
        bairro = dados.get("bairro", "").strip()
        cidade = dados.get("cidade", "").strip()
        uf = dados.get("uf", "").strip().upper()

        if not all([nome_completo, email, cnpj, empresa, endereco, numero, bairro, cidade, uf]):
            return jsonify({"mensagem": "Campos obrigatórios não preenchidos."}), 400

        conn = Var_ConectarBanco()
        cursor = conn.cursor()

        # 🔎 Verifica se o CNPJ já está cadastrado
        cursor.execute("SELECT id FROM tbl_empresa WHERE cnpj = %s", (cnpj,))
        empresa_existente = cursor.fetchone()
        if empresa_existente:
            return jsonify({"mensagem": "Já existe um cadastro com este CNPJ. Faça login com o e-mail vinculado ou entre em contato com o suporte."}), 400


        # Verifica se o e‑mail já está cadastrado
        cursor.execute("SELECT id_usuario FROM tbl_usuario WHERE email = %s", (dados["email"],))
        if cursor.fetchone():
            conn.close()
            return jsonify({
                "status": "erro",
                "mensagem": "O e‑mail já está cadastrado. Use-o para fazer login ou entre em contato com o suporte."
            }), 400
    


        # 🏢 Insere nova empresa
        cursor.execute("""
            INSERT INTO tbl_empresa (
                tipo, cnpj, nome_empresa, endereco, numero, bairro,
                cidade, uf, cep, ie, tipofavorecido, status
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            "Juridica", cnpj, empresa, endereco, numero, bairro,
            cidade, uf, cep, ie, "Empresa", "Ativo"
        ))
        id_empresa = cursor.fetchone()[0]

        # 👥 Cria os grupos padrões para a empresa
        agora = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        grupos_padrao = [
            ("Usuario", "Grupo de acesso básico a nível padrão"),
            ("Administrador", "Acesso nível administrador")
        ]

        for nome_grupo, descricao in grupos_padrao:
            cursor.execute("""
                INSERT INTO tbl_usuario_grupo (id_empresa, nome_grupo, descricao, criado_em)
                VALUES (%s, %s, %s, %s)
            """, (id_empresa, nome_grupo, descricao, agora))


        # 👤 Cria o primeiro usuário
        nome = nome_completo.split()[0]
        token = secrets.token_urlsafe(32)
        cursor.execute("""
            INSERT INTO tbl_usuario (
                id_empresa, nome, nome_completo, email, senha,
                grupo, status, imagem, token_redefinicao
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            id_empresa, nome, nome_completo, email, "",
            "Administrador", "Ativo", "userpadrao.png", token
        ))

        # ⚙️ Cria configuração padrão
        cursor.execute("""
            INSERT INTO tbl_config (id_empresa, chave, valor, descricao)
            VALUES (%s, %s, %s, %s)
        """, (id_empresa, "tempo_sessao_minutos", "60", "Tempo de inatividade permitido"))

        conn.commit()
        conn.close()

        # 🌐 Monta link de redefinição com base no ambiente
        base_url = os.getenv("BASE_PROD") if os.getenv("MODO_PRODUCAO", "false").lower() == "true" else os.getenv("BASE_DEV")
        url_redefinicao = f"{base_url}/usuario/redefinir?token={token}"

        # 🌐 Monta URLs dinâmicas
        base_url = os.getenv("BASE_PROD") if os.getenv("MODO_PRODUCAO", "false").lower() == "true" else os.getenv("BASE_DEV")
        url_redefinicao = f"{base_url}/usuario/redefinir?token={token}"
        url_privacidade  = f"{base_url}/privacidade"
        url_logo         = f"{base_url}/static/imge/logorufino.png"

       # ✉️ Aqui começa o corpo completo do e‑mail (bloco triple-quote)
        corpo_html = f"""<!DOCTYPE html>
<html lang="pt-br">
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table width="100%" style="max-width:600px;background:#ffffff;" cellpadding="20" cellspacing="0">
        <tr><td style="text-align:left;">
          <img src="{url_logo}" alt="Rufino Logo" style="max-width:200px;height:auto;display:block;">
        </td></tr>
        <tr><td style="border-top:1px solid #ddd;"></td></tr>
        <tr><td>
          <p>Olá <strong>{nome}</strong>,</p>
          <p>Seja bem‑vindo à família Rufino! Ficamos muito felizes por tê‑lo conosco.</p>
          <p>Seu cadastro inicial foi concluído. Para criar sua senha e acessar o sistema, <a href="{url_redefinicao}" style="color:#85C300;text-decoration:none;">clique aqui</a> ou copie e cole este link no navegador:</p>
          <p><a href="{url_redefinicao}" style="word-break:break-all;color:#555;">{url_redefinicao}</a></p>
        </td></tr>
        <tr><td style="background:#f9f9f9;padding:15px;border-radius:4px;font-size:14px;color:#666;">
          <p><strong>Este e‑mail foi enviado exclusivamente por notificas@rufino.tech.</strong></p>
          <ul style="margin:10px 0 0 15px;padding:0;">
            <li>Não pedimos sua senha por e‑mail.</li>
            <li>Verifique sempre se o link começa com <strong>rufino.tech</strong>.</li>
            <li>Nunca informe dados sensíveis via e‑mail.</li>
            <li>Se você não solicitou este acesso, ignore esta mensagem.</li>
          </ul>
        </td></tr>
        <tr><td style="font-size:14px;color:#666;">
          <p>Dúvidas? Consulte nossa <a href="{url_privacidade}" style="color:#85C300;text-decoration:none;">Política de Privacidade</a>.</p>
        </td></tr>
        <tr><td style="font-size:12px;color:#999;text-align:center;padding-top:20px;">
          Obrigado por escolher a Rufino! © 2025 Rufino. Todos os direitos reservados.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""  

        # Agora fazemos o envio para o serviço de email
        requests.post(f"{base_url}/email/enviar", json={
            "destinatarios": [email],
            "assunto": "Crie sua senha de acesso",
            "corpo_html": corpo_html,
            "tag": "cadastro_inicial",
            "id_empresa": id_empresa
        })


        return jsonify({"status": "sucesso", "mensagem": "Cadastro realizado! Um e‑mail foi enviado para você criar sua senha."})

    except Exception as e:
        print("❌ Erro no cadastro:", str(e))
        return jsonify({"mensagem": "Erro interno ao processar o cadastro."}), 500


# ────────────────────────────────────────────────
# 5️⃣ ROTAS PARA SENHAS (TROCAR SENHA)
# ────────────────────────────────────────────────
@auth_bp.route("/trocar-senha", methods=["POST"])
def trocar_senha():
    dados = request.get_json()
    nova = dados.get("nova")
    confirmar = dados.get("confirmar")

    if not nova or not confirmar:
        return jsonify({"erro": "Todos os campos são obrigatórios."}), 400

    if nova != confirmar:
        return jsonify({"erro": "As senhas não coincidem."}), 400

    if len(nova) < 8 or not re.search(r"[a-z]", nova) or not re.search(r"[A-Z]", nova) or not re.search(r"[\W_]", nova):
        return jsonify({"erro": "A senha deve conter ao menos 8 caracteres, uma letra maiúscula, uma minúscula e um caractere especial."}), 400

    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return jsonify({"erro": "Sessão expirada. Faça login novamente."}), 401

    try:
        conn = Var_ConectarBanco()
        cursor = conn.cursor()

        senha_hash = bcrypt.hashpw(nova.encode(), bcrypt.gensalt()).decode()

        cursor.execute("""
            UPDATE tbl_usuario SET senha = %s, trocasenha_em = NULL
            WHERE id_usuario = %s
        """, (senha_hash, usuario_id))
        conn.commit()

        return jsonify({"sucesso": True})

    except Exception as e:
        print("Erro ao atualizar senha:", e)
        return jsonify({"erro": "Erro interno ao atualizar a senha."}), 500

@auth_bp.route("/senha/trocar")
def exibir_troca_senha():
    return render_template("frm_trocasenha.html")



# ────────────────────────────────────────────────
# 4️⃣ ROTAS MENU DINAMICO
# ────────────────────────────────────────────────
@auth_bp.route("/menu/<posicao>", methods=["GET"])
def menu_por_posicao(posicao):
    conn = None
    try:
        id_usuario = session.get("id_usuario")
        id_empresa = session.get("id_empresa")  # nome correto no seu projeto
        grupo = session.get("grupo")

        if not id_usuario or not id_empresa or not grupo:
            return jsonify({"erro": "Sessão expirada"}), 401

        conn = Var_ConectarBanco()
        cursor = conn.cursor()

        if grupo == "Desenvolvedor":
            print("🔓 Desenvolvedor logado - acesso total")
            cursor.execute("""
                SELECT id, nome_menu, descricao, rota, data_page, icone, link_detalhe,
                       tipo_abrir, ordem, parent_id
                FROM tbl_menu
                WHERE ativo = TRUE AND LOWER(local_menu) = LOWER(%s)
                ORDER BY ordem
            """, (posicao,))

        elif grupo == "Administrador":
            print("🔒 Administrador logado - acesso com assinatura")
            cursor.execute("""
                SELECT m.id, m.nome_menu, m.descricao, m.rota, m.data_page, m.icone, m.link_detalhe,
                       m.tipo_abrir, m.ordem, m.parent_id
                FROM tbl_menu m
                LEFT JOIN tbl_fatura_assinatura f ON f.id_modulo = m.id AND f.id_empresa = %s AND f.status = 'Ativo'
                WHERE m.ativo = TRUE
                  AND LOWER(m.local_menu) = LOWER(%s)
                  AND (
                      m.assinatura_app = FALSE
                      OR (m.assinatura_app = TRUE AND f.id IS NOT NULL)
                  )
                ORDER BY m.ordem
            """, (id_empresa, posicao))

        else:
            print("🔍 Grupo personalizado - buscando permissões")
            cursor.execute("SELECT id_grupo FROM tbl_usuario WHERE id_usuario = %s", (id_usuario,))
            resultado = cursor.fetchone()

            if not resultado or resultado[0] is None:
                print("❌ id_grupo não encontrado para o usuário")
                return jsonify([])

            id_grupo = resultado[0]

            cursor.execute("""
                SELECT m.id, m.nome_menu, m.descricao, m.rota, m.data_page, m.icone, m.link_detalhe,
                       m.tipo_abrir, m.ordem, m.parent_id
                FROM tbl_usuario_permissao_grupo p
                JOIN tbl_menu m ON m.id = p.id_menu
                LEFT JOIN tbl_fatura_assinatura f ON f.id_modulo = m.id AND f.id_empresa = %s AND f.status = 'Ativo'
                WHERE m.ativo = TRUE
                  AND LOWER(m.local_menu) = LOWER(%s)
                  AND p.id_empresa = %s
                  AND p.id_grupo = %s
                  AND (
                      m.assinatura_app = FALSE
                      OR (m.assinatura_app = TRUE AND f.id IS NOT NULL)
                  )
                ORDER BY m.ordem
            """, (id_empresa, posicao, id_empresa, id_grupo))

        menus = cursor.fetchall()
        colunas = [desc[0] for desc in cursor.description]
        lista = [dict(zip(colunas, m)) for m in menus]

        print(f"📋 Menus retornados para grupo '{grupo}': {len(lista)}")
        return jsonify(lista)

    except Exception as e:
        print(f"❌ Erro ao carregar menu: {str(e)}")
        return jsonify({"erro": f"Erro ao carregar menu: {str(e)}"}), 500

    finally:
        if conn:
            conn.close()








@auth_bp.route("/menu/acoes", methods=["POST"])
def menu_acoes():
    try:
        id_usuario = session.get("id_usuario")
        grupo = session.get("grupo")

        if not id_usuario or not grupo:
            return jsonify({"erro": "Sessão expirada"}), 401

        dados = request.get_json()
        id_menu = dados.get("id_menu")
        if not id_menu:
            return jsonify({"erro": "ID do menu não informado"}), 400

        # Desenvolvedor e Administrador têm acesso total
        if grupo in ("desenvolvedor", "administrador"):
            return jsonify({
                "pode_visualizar": True,
                "pode_incluir": True,
                "pode_editar": True,
                "pode_excluir": True
            })

        # Buscar ID do grupo personalizado
        conn = Var_ConectarBanco()
        cursor = conn.cursor()
        cursor.execute("SELECT id_grupo FROM tbl_usuario WHERE id_usuario = %s", (id_usuario,))
        id_grupo = cursor.fetchone()

        if not id_grupo or not id_grupo[0]:
            return jsonify({
                "pode_visualizar": False,
                "pode_incluir": False,
                "pode_editar": False,
                "pode_excluir": False
            })

        id_grupo = id_grupo[0]

        # Buscar permissões do grupo no menu
        cursor.execute("""
            SELECT pode_visualizar, pode_incluir, pode_editar, pode_excluir
            FROM tbl_usuario_permissao
            WHERE id_grupo = %s AND id_menu = %s
        """, (id_grupo, id_menu))

        permissao = cursor.fetchone()
        conn.close()

        if not permissao:
            return jsonify({
                "pode_visualizar": False,
                "pode_incluir": False,
                "pode_editar": False,
                "pode_excluir": False
            })

        colunas = ["pode_visualizar", "pode_incluir", "pode_editar", "pode_excluir"]
        return jsonify(dict(zip(colunas, permissao)))

    except Exception as e:
        return jsonify({"erro": f"Erro ao consultar ações: {str(e)}"}), 500

# ────────────────────────────────────────────────
# 2️⃣ Rotas para Carregar Menu
# ────────────────────────────────────────────────




@auth_bp.route("/menu/novidades", methods=["GET"])
def painel_novidades():
    try:
        conn = Var_ConectarBanco()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id, emissao, modulo, descricao, link
            FROM tbl_novidades
            ORDER BY emissao DESC
            LIMIT 50
        """)
        colunas = [col[0] for col in cursor.description]
        dados = [dict(zip(colunas, linha)) for linha in cursor.fetchall()]
        return jsonify(dados)

    except Exception as e:
        print(f"Erro ao buscar novidades: {e}")
        return jsonify([]), 500



# ────────────────────────────────────────────────
# 6️⃣ ROTAS MEU PERFIL
# ────────────────────────────────────────────────
# Pasta onde as imagens dos usuários ficam salvas
CAMINHO_IMG_USER = os.path.join('static', 'imge', 'imguser')


@auth_bp.route("/perfil/dados", methods=["GET"])
def obter_dados_perfil():
    try:
        id_usuario = session.get("id_usuario")
        id_empresa = session.get("id_empresa")

        if not id_usuario or not id_empresa:
            return jsonify({"erro": "Sessão expirada ou inválida."}), 401

        conn = Var_ConectarBanco()
        cursor = conn.cursor()

        # Busca dados do usuário
        cursor.execute("""
            SELECT nome_completo, email, departamento, whatsapp, imagem
            FROM tbl_usuario
            WHERE id_usuario = %s AND id_empresa = %s
        """, (id_usuario, id_empresa))
        row_usuario = cursor.fetchone()

        usuario = {
            "nome_completo": row_usuario[0],
            "email": row_usuario[1],
            "departamento": row_usuario[2],
            "whatsapp": row_usuario[3],
            "imagem": row_usuario[4] or "userpadrao.png"
        }

        # Busca dados da empresa (com novos campos financeiros)
        cursor.execute("""
            SELECT nome_empresa, cnpj, endereco, numero, bairro, cidade, uf, cep, ie,
                   contato_financeiro, email_financeiro, whatsapp_financeiro, 
                   forma_pagamento_padrao, obs_faturamento
            FROM tbl_empresa
            WHERE id = %s
        """, (id_empresa,))
        row_empresa = cursor.fetchone()

        empresa = {
            "empresa": row_empresa[0],
            "cnpj": row_empresa[1],
            "endereco": row_empresa[2],
            "numero": row_empresa[3],
            "bairro": row_empresa[4],
            "cidade": row_empresa[5],
            "uf": row_empresa[6],
            "cep": row_empresa[7],
            "ie": row_empresa[8],
            "contato_financeiro": row_empresa[9],
            "email_financeiro": row_empresa[10],
            "whatsapp_financeiro": row_empresa[11],
            "forma_pagamento_padrao": row_empresa[12],
            "obs_faturamento": row_empresa[13]
        }

        conn.close()
        return jsonify({"usuario": usuario, "empresa": empresa})

    except Exception as e:
        print("❌ Erro ao obter dados do perfil:", e)
        return jsonify({"erro": "Erro ao carregar dados do perfil."}), 500




@auth_bp.route("/perfil/upload_imagem", methods=["POST"])
def perfil_upload_imagem():
    try:
        id_usuario = session.get("id_usuario")
        if not id_usuario:
            return jsonify({"erro": "Sessão expirada"}), 401

        if 'imagem' not in request.files:
            return jsonify({"erro": "Nenhum arquivo enviado"}), 400

        arquivo = request.files['imagem']
        if not arquivo:
            return jsonify({"erro": "Arquivo inválido"}), 400

        extensao = os.path.splitext(arquivo.filename)[1].lower()
        if extensao not in [".jpg", ".png"]:
            return jsonify({"erro": "Apenas arquivos .jpg ou .png são permitidos"}), 400

        nome_arquivo = f"user{id_usuario}{extensao}"
        caminho_completo = os.path.join(CAMINHO_IMG_USER, nome_arquivo)
        arquivo.save(caminho_completo)

        conn = Var_ConectarBanco()
        cursor = conn.cursor()
        cursor.execute("UPDATE tbl_usuario SET imagem = %s WHERE id_usuario = %s", (nome_arquivo, id_usuario))
        conn.commit()
        conn.close()

        return jsonify({"mensagem": "Imagem atualizada com sucesso", "imagem": nome_arquivo})

    except Exception as e:
        return jsonify({"erro": f"Erro ao salvar imagem: {str(e)}"}), 500


@auth_bp.route("/perfil/excluir_imagem", methods=["POST"])
def perfil_excluir_imagem():
    try:
        id_usuario = session.get("id_usuario")
        if not id_usuario:
            return jsonify({"erro": "Sessão expirada"}), 401

        # Atualiza no banco a imagem padrão
        conn = Var_ConectarBanco()
        cursor = conn.cursor()
        cursor.execute("SELECT imagem FROM tbl_usuario WHERE id_usuario = %s", (id_usuario,))
        atual = cursor.fetchone()

        if atual and atual[0] != "userpadrao.png":
            caminho = os.path.join(CAMINHO_IMG_USER, atual[0])
            if os.path.exists(caminho):
                os.remove(caminho)

        cursor.execute("UPDATE tbl_usuario SET imagem = %s WHERE id_usuario = %s", ("userpadrao.png", id_usuario))
        conn.commit()
        conn.close()

        return jsonify({"mensagem": "Imagem removida com sucesso", "imagem": "userpadrao.png"})

    except Exception as e:
        return jsonify({"erro": f"Erro ao excluir imagem: {str(e)}"}), 500



@auth_bp.route("/perfil/trocar_senha", methods=["POST"])
def perfil_trocar_senha():
    try:
        id_usuario = session.get("id_usuario")
        if not id_usuario:
            return jsonify({"erro": "Sessão expirada"}), 401

        dados = request.get_json()
        nova = dados.get("nova", "").strip()
        repetir = dados.get("repetir", "").strip()

        if nova != repetir:
            return jsonify({"erro": "As senhas não coincidem"}), 400

        if len(nova) < 8 or not any(c.isupper() for c in nova) or not any(c.islower() for c in nova) or not any(c in "!@#$%&*()" for c in nova):
            return jsonify({"erro": "Senha não atende aos critérios de segurança"}), 400

        senha_hash = bcrypt.hashpw(nova.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        conn = Var_ConectarBanco()
        cursor = conn.cursor()
        cursor.execute("UPDATE tbl_usuario SET senha = %s WHERE id_usuario = %s", (senha_hash, id_usuario))
        conn.commit()
        conn.close()

        return jsonify({"mensagem": "Senha alterada com sucesso"})

    except Exception as e:
        return jsonify({"erro": f"Erro ao alterar senha: {str(e)}"}), 500

@auth_bp.route("/perfil/salvar", methods=["POST"])
def salvar_perfil():
    try:
        dados = request.get_json()

        id_usuario = session.get("id_usuario")
        id_empresa = session.get("id_empresa")
        if not id_usuario or not id_empresa:
            return jsonify({"erro": "Sessão expirada ou inválida."}), 401

        conn = Var_ConectarBanco()
        cursor = conn.cursor()

        # Atualiza dados da empresa, incluindo campos financeiros
        empresa = dados.get("empresa", {})
        cursor.execute("""
            UPDATE tbl_empresa SET
                endereco = %s, 
                numero = %s, 
                bairro = %s, 
                cidade = %s, 
                uf = %s, 
                cep = %s, 
                ie = %s,
                contato_financeiro = %s,
                email_financeiro = %s,
                whatsapp_financeiro = %s,
                forma_pagamento_padrao = %s,
                obs_faturamento = %s
            WHERE id = %s
        """, (
            empresa.get("endereco"),
            empresa.get("numero"),
            empresa.get("bairro"),
            empresa.get("cidade"),
            empresa.get("uf"),
            empresa.get("cep"),
            empresa.get("ie"),
            empresa.get("contato_financeiro"),
            empresa.get("email_financeiro"),
            empresa.get("whatsapp_financeiro"),
            empresa.get("forma_pagamento_padrao"),
            empresa.get("obs_faturamento"),
            id_empresa  # ← usado como ID da empresa
        ))

        # Atualiza dados do usuário
        usuario = dados.get("usuario", {})
        cursor.execute("""
            UPDATE tbl_usuario SET
                departamento = %s, 
                whatsapp = %s
            WHERE id_usuario = %s AND id_empresa = %s
        """, (
            usuario.get("departamento"),
            usuario.get("whatsapp"),
            id_usuario,
            id_empresa
        ))

        conn.commit()
        conn.close()
        return jsonify({"sucesso": True})

    except Exception as e:
        print("❌ Erro ao salvar perfil:", e)
        return jsonify({"erro": "Erro interno ao salvar os dados."}), 500




# ────────────────────────────────────────────────
# 🔧 ROTAS DO MÓDULO CHAMADO
# ────────────────────────────────────────────────
@auth_bp.route("/chamado/dados")
def chamado_dados():
    conn = Var_ConectarBanco()
    cur = conn.cursor()

    pagina = int(request.args.get("pagina", 1))
    por_pagina = int(request.args.get("porPagina", 20))
    offset = (pagina - 1) * por_pagina

    filtros = {
        "categoria": request.args.get("categoria", ""),
        "status": request.args.get("status", ""),
        "situacao": request.args.get("situacao", ""),
        "ocorrencia": request.args.get("ocorrencia", ""),
        "usuario": request.args.get("usuario", "")
    }

    base_query = """
        SELECT 
            c.id, c.titulo, c.categoria, c.status, c.situacao, 
            u.nome AS nome_usuario, c.criado_em 
        FROM tbl_chamado c 
        JOIN tbl_usuario u ON c.id_usuario = u.id_usuario 
        WHERE c.id_empresa = %s
    """
    params = [session["id_empresa"]]

    if session.get("grupo") != "Desenvolvedor":
        base_query += " AND c.id_usuario = %s"
        params.append(session["id_usuario"])

    if filtros["categoria"]:
        base_query += " AND c.categoria = %s"
        params.append(filtros["categoria"])
    if filtros["status"]:
        base_query += " AND c.status = %s"
        params.append(filtros["status"])
    if filtros["situacao"]:
        base_query += " AND c.situacao = %s"
        params.append(filtros["situacao"])
    if filtros["ocorrencia"]:
        base_query += " AND c.id = %s"
        params.append(filtros["ocorrencia"])
    if filtros["usuario"]:
        base_query += " AND u.nome LIKE %s"
        params.append(f"%{filtros['usuario']}%")

    # Logs para depuração
    print("📄 base_query:", base_query)
    print("📦 params:", params)

    # ⚠️ Conta registros (sem LIMIT/OFFSET)
    try:
        count_query = f"SELECT COUNT(*) FROM ({base_query}) AS subquery"
        cur.execute(count_query, tuple(params))
        row = cur.fetchone()
        total = row[0] if row else 0
    except Exception as e:
        print("❌ Erro ao contar registros:", e)
        total = 0

    # Adiciona paginação à query principal
    base_query += " ORDER BY c.id DESC LIMIT %s OFFSET %s"
    params_com_paginacao = params + [por_pagina, offset]

    # ⚠️ Busca os chamados com proteção
    try:
        cur.execute(base_query, tuple(params_com_paginacao))
        rows = cur.fetchall()
        columns = [desc[0] for desc in cur.description]
        chamados = [dict(zip(columns, row)) for row in rows]
    except Exception as e:
        print("❌ Erro ao buscar chamados:", e)
        chamados = []

    return jsonify(dados=chamados, total_paginas=(total + por_pagina - 1) // por_pagina)



@auth_bp.route("/chamado/incluir")
def chamado_incluir():
    return render_template("/frm_chamado_apoio.html")



@auth_bp.route("/chamado/editar")
def chamado_editar():
    return render_template("/frm_chamado_apoio.html")



@auth_bp.route("/chamado/salvar", methods=["POST"])
def chamado_salvar():
    conn = Var_ConectarBanco()
    cur = conn.cursor()
    agora = datetime.now()

    # Lê dados do formulário
    id_chamado = request.form.get("id")
    titulo = request.form.get("titulo", "").strip()
    categoria = request.form.get("categoria", "").strip()
    status = request.form.get("status", "Pendente").strip()
    situacao = request.form.get("situacao", "Aberto").strip()
    ocorrencia = request.form.get("ocorrencia", "").strip()
    usuario = session.get("id_usuario")
    empresa = session.get("id_empresa")

    if not titulo or not categoria or not ocorrencia:
        return jsonify({"erro": "Campos obrigatórios não preenchidos."}), 400

    # Atualiza
    if id_chamado:
        cur.execute("""
            UPDATE tbl_chamado
            SET titulo = %s, categoria = %s, status = %s, situacao = %s, ocorrencia = %s
            WHERE id = %s
        """, (titulo, categoria, status, situacao, ocorrencia, id_chamado))
    else:
        # Insere novo chamado
        cur.execute("""
            INSERT INTO tbl_chamado (id_usuario, id_empresa, categoria, status, situacao, titulo, ocorrencia)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (usuario, empresa, categoria, status, situacao, titulo, ocorrencia))
        id_chamado = cur.fetchone()[0]


    # Salvar anexos se existirem
    for i in range(1, 4):
        file = request.files.get(f"anexo{i}")
        if file:
            nome = secure_filename(file.filename)
            nome_arquivo = f"{id_chamado}_{usuario}_{int(datetime.timestamp(agora))}_{nome}"
            caminho = os.path.join("static/imge/anexochamado", nome_arquivo)
            file.save(caminho)

            # Registra na tabela de mensagens como anexo inicial do chamado
            cur.execute("""
                INSERT INTO tbl_chamado_mensagem (id_chamado, id_usuario, mensagem, origem, criado_em)
                VALUES (%s, %s, %s, 'sistema', %s)
                RETURNING id
            """, (id_chamado, usuario, f"[anexo inicial] {nome}", agora))
            id_mensagem = cur.fetchone()[0]

            cur.execute("""
                INSERT INTO tbl_chamado_mensagem_anexo (id_mensagem, nome_arquivo, caminho, criado_em)
                VALUES (%s, %s, %s, %s)
            """, (id_mensagem, nome, nome_arquivo, agora))

    conn.commit()
    return jsonify({"sucesso": True, "id": id_chamado})





# Obter detalhes e mensagens de um chamado
@auth_bp.route("/chamado/detalhes/<int:id>")
def chamado_detalhes(id):
    conn = Var_ConectarBanco()
    cur = conn.cursor()

    # Busca o chamado
    cur.execute("SELECT * FROM tbl_chamado WHERE id = %s", (id,))
    chamado = cur.fetchone()
    if not chamado:
        return jsonify({"erro": "Chamado não encontrado."}), 404

    colunas = [desc[0] for desc in cur.description]
    dados_chamado = dict(zip(colunas, chamado))

    # Busca mensagens com ID explícito
    cur.execute("""
        SELECT m.id, m.mensagem, m.criado_em, m.origem, u.nome AS nome_usuario
        FROM tbl_chamado_mensagem m
        JOIN tbl_usuario u ON m.id_usuario = u.id_usuario
        WHERE m.id_chamado = %s
        ORDER BY m.id ASC
    """, (id,))
    
    mensagens = []
    for linha in cur.fetchall():
        msg = {
            "id": linha[0],
            "mensagem": linha[1],
            "criado_em": linha[2],
            "origem": linha[3],
            "nome_usuario": linha[4]
        }

        # Busca os anexos da mensagem
        cur.execute("""
            SELECT nome_arquivo, caminho 
            FROM tbl_chamado_mensagem_anexo 
            WHERE id_mensagem = %s
        """, (msg["id"],))
        msg["anexos"] = [dict(zip(["nome_arquivo", "caminho"], a)) for a in cur.fetchall()]
        mensagens.append(msg)

    dados_chamado["mensagens"] = mensagens
    return jsonify(dados_chamado)




# Adicionar nova mensagem com anexos
@auth_bp.route("/chamado/mensagem/incluir", methods=["POST"])
def chamado_mensagem_incluir():
    id_chamado = request.form.get("id_chamado")
    mensagem = request.form.get("mensagem", "").strip()
    usuario = session.get("id_usuario")
    agora = datetime.now()

    conn = Var_ConectarBanco()
    cur = conn.cursor()

    # 🔒 Verifica se o chamado existe
    cur.execute("SELECT 1 FROM tbl_chamado WHERE id = %s", (id_chamado,))
    if not cur.fetchone():
        return jsonify({"erro": "Chamado inexistente. Salve o chamado antes de responder."}), 400

    # 🔒 Verifica se o usuário é válido
    cur.execute("SELECT 1 FROM tbl_usuario WHERE id_usuario = %s", (usuario,))
    if not cur.fetchone():
        return jsonify({"erro": "Usuário inválido ou sessão expirada."}), 400

    # 💬 Salva mensagem e captura o ID com RETURNING
    cur.execute("""
        INSERT INTO tbl_chamado_mensagem (id_chamado, id_usuario, mensagem, origem, criado_em)
        VALUES (%s, %s, %s, 'sistema', %s)
        RETURNING id
    """, (id_chamado, usuario, mensagem, agora))
    id_mensagem = cur.fetchone()[0]

    # 📎 Salva anexos (1 a 3)
    for i in range(1, 4):
        file = request.files.get(f"anexo{i}")
        if file:
            nome = secure_filename(file.filename)
            caminho = f"{id_chamado}_{id_mensagem}_{nome}"
            fullpath = os.path.join("static/imge/anexochamado", caminho)
            file.save(fullpath)

            cur.execute("""
                INSERT INTO tbl_chamado_mensagem_anexo (id_mensagem, nome_arquivo, caminho, criado_em)
                VALUES (%s, %s, %s, %s)
            """, (id_mensagem, nome, caminho, agora))

    conn.commit()
    return jsonify({"sucesso": True})



# ------------------------------------------------------------
# ROTAS DE NOVIDADES
# ------------------------------------------------------------
@auth_bp.route("/novidades/painel")
@login_obrigatorio
def novidades_painel():
    
    conn = Var_ConectarBanco()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT emissao, modulo, descricao, link
        FROM tbl_novidades
        ORDER BY emissao DESC
        LIMIT 50
    """)

    colunas = [desc[0] for desc in cursor.description]
    registros = [dict(zip(colunas, linha)) for linha in cursor.fetchall()]

    conn.close()
    return jsonify(registros)


@auth_bp.route("/novidades/dados")
def novidades_dados():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()

    pagina = int(request.args.get("pagina", 1))
    por_pagina = int(request.args.get("porPagina", 20))
    offset = (pagina - 1) * por_pagina

    modulo = request.args.get("modulo", "").strip()
    emissao = request.args.get("emissao", "").strip()

    base_sql = "SELECT * FROM tbl_novidades WHERE 1=1"
    filtros = []
    valores = []

    if modulo:
        base_sql += " AND modulo LIKE %s"
        valores.append(f"%{modulo}%")

    if emissao:
        base_sql += " AND emissao = %s"
        valores.append(emissao)

    sql_total = f"SELECT COUNT(*) FROM ({base_sql})"
    cursor.execute(sql_total, valores)
    total_registros = cursor.fetchone()[0]
    total_paginas = (total_registros + por_pagina - 1) // por_pagina

    base_sql += " ORDER BY emissao DESC LIMIT %s OFFSET %s"
    valores.extend([por_pagina, offset])

    cursor.execute(base_sql, valores)
    colunas = [desc[0] for desc in cursor.description]
    registros = [dict(zip(colunas, linha)) for linha in cursor.fetchall()]
    conn.close()

    return jsonify({
        "dados": registros,
        "total_paginas": total_paginas
    })



@auth_bp.route("/novidades/incluir")
@login_obrigatorio
def novidades_incluir():
    return render_template("frm_novidades_apoio.html")



@auth_bp.route("/novidades/editar")
@login_obrigatorio
def novidades_editar():
    return render_template("frm_novidades_apoio.html")



@auth_bp.route("/novidades/salvar", methods=["POST"])
@login_obrigatorio
def novidades_salvar():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    dados = request.json

    try:
        if dados.get("id"):
            cursor.execute("""
                UPDATE tbl_novidades
                SET emissao = %s, modulo = %s, descricao = %s, link = %s
                WHERE id = %s
            """, (dados["emissao"], dados["modulo"], dados["descricao"], dados["link"], dados["id"]))
        else:
            cursor.execute("""
                INSERT INTO tbl_novidades (emissao, modulo, descricao, link)
                VALUES (%s, %s, %s, %s)
            """, (dados["emissao"], dados["modulo"], dados["descricao"], dados["link"]))
            dados["id"] = cursor.fetchone()[0]

        conn.commit()
        return jsonify({"status": "sucesso", "id": dados["id"]})
    except Exception as e:
        print("Erro ao salvar novidade:", e)
        return jsonify({"erro": str(e)}), 500
    finally:
        conn.close()




@auth_bp.route("/novidades/delete", methods=["POST"])
@login_obrigatorio
def novidades_delete():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    dados = request.json

    try:
        cursor.execute("DELETE FROM tbl_novidades WHERE id = %s", (dados["id"],))
        conn.commit()
        return jsonify({"status": "sucesso", "mensagem": "Registro excluído com sucesso."})
    except Exception as e:
        print("Erro ao excluir novidade:", e)
        return jsonify({"erro": str(e)}), 500
    finally:
        conn.close()


# ------------------------------------------------------------
# ROTAS DE CONFIGURAÇÔES GERAIS (tbl_config)
# ------------------------------------------------------------
@auth_bp.route("/configuracoes/dados")
@login_obrigatorio
def config_dados():
    pagina = int(request.args.get("pagina", 1))
    por_pagina = int(request.args.get("porPagina", 20))
    descricao = request.args.get("descricao", "").strip()
    chave = request.args.get("chave", "").strip()

    conn = Var_ConectarBanco()
    cursor = conn.cursor()

    sql = "SELECT descricao, chave, valor, atualizado_em FROM tbl_config WHERE 1=1"
    params = []

    if descricao:
        sql += " AND descricao LIKE %s"
        params.append(f"%{descricao}%")
    if chave:
        sql += " AND chave LIKE %s"
        params.append(f"%{chave}%")

    cursor.execute(sql, params)
    registros = cursor.fetchall()

    total = len(registros)
    total_paginas = max(1, -(-total // por_pagina))  # Arredondamento para cima

    inicio = (pagina - 1) * por_pagina
    fim = inicio + por_pagina
    dados_pagina = registros[inicio:fim]

    resultado = []
    for row in dados_pagina:
        resultado.append({
            "descricao": row[0],
            "chave": row[1],
            "valor": row[2],
            "atualizado_em": row[3]
        })

    return jsonify({"dados": resultado, "total_paginas": total_paginas})





@auth_bp.route("/configuracoes/incluir")
@login_obrigatorio
def config_incluir():
    return render_template("frm_config_geral_apoio.html")

@auth_bp.route("/configuracoes/editar")
@login_obrigatorio
def config_editar():
    return render_template("frm_config_geral_apoio.html")



@auth_bp.route("/configuracoes/salvar", methods=["POST"])
@login_obrigatorio
def rota_configuracoes_salvar():
    dados = request.json
    chave = dados.get("chave")

    if not chave:
        return jsonify({"erro": "Chave da configuração é obrigatória."}), 400

    descricao = dados.get("descricao", "").strip()
    valor = dados.get("valor", "").strip()

    conexao = Var_ConectarBanco()
    cursor = conexao.cursor()

    try:
        # Verifica se a chave já existe
        cursor.execute("SELECT 1 FROM tbl_config WHERE chave = %s", (chave,))
        existe = cursor.fetchone()

        if existe:
            # Atualiza
            cursor.execute("""
                UPDATE tbl_config
                SET descricao = %s, valor = %s, atualizado_em = CURRENT_TIMESTAMP
                WHERE chave = %s
            """, (descricao, valor, chave))
            conexao.commit()
            return jsonify({"status": "sucesso", "mensagem": "Configuração atualizada com sucesso!", "chave": chave})
        else:
            # Insere
            cursor.execute("""
                INSERT INTO tbl_config (chave, descricao, valor, atualizado_em)
                VALUES (%s, %s, %s, CURRENT_TIMESTAMP)
            """, (chave, descricao, valor))
            conexao.commit()
            return jsonify({"status": "sucesso", "mensagem": "Configuração incluída com sucesso!", "chave": chave})

    except Exception as e:
        conexao.rollback()
        return jsonify({"erro": f"Erro ao salvar configuração: {str(e)}"}), 500
    finally:
        conexao.close()



@auth_bp.route("/configuracoes/delete", methods=["POST"])
@login_obrigatorio
def rota_configuracoes_delete():
    dados = request.json
    chave = dados.get("chave")

    if not chave:
        return jsonify({"erro": "Chave da configuração não informada."}), 400

    conexao = Var_ConectarBanco()
    cursor = conexao.cursor()

    try:
        cursor.execute("DELETE FROM tbl_config WHERE chave = %s", (chave,))
        conexao.commit()
        return jsonify({"status": "sucesso", "mensagem": "Configuração excluída com sucesso!"})
    except Exception as e:
        conexao.rollback()
        return jsonify({"erro": f"Erro ao excluir configuração: {str(e)}"}), 500
    finally:
        conexao.close()




@auth_bp.route("/configuracoes/apoio/<chave>")
@login_obrigatorio
def config_apoio(chave):
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    
    cursor.execute("SELECT descricao, chave, valor, atualizado_em FROM tbl_config WHERE chave = %s", (chave,))
    row = cursor.fetchone()

    if row:
        return jsonify({
            "descricao": row[0],
            "chave": row[1],
            "valor": row[2],
            "atualizado_em": row[3]
        })
    else:
        return jsonify({"erro": "Configuração não encontrada"}), 404


# ------------------------------------------------------------
# ✅ ROTAS DE USUARIO
# ------------------------------------------------------------
# rota para preencher a tabela principal
@auth_bp.route("/usuario/dados", methods=["GET"])
@login_obrigatorio
def obter_usuarios():
    if "id_empresa" not in session:
        return jsonify({"erro": "Cliente não autenticado."}), 403

    try:
        id_empresa = session["id_empresa"]
        nome_filtro = request.args.get("nome", "").strip()
        status_filtro = request.args.get("status", "").strip()
        pagina = int(request.args.get("pagina", 1))
        registros_por_pagina = int(request.args.get("porPagina", 20))
        offset = (pagina - 1) * registros_por_pagina

        # 🔍 SQL principal com base em id_empresa
        sql = """
            SELECT id_usuario, nome_completo, email, whatsapp, departamento, grupo,
                   ultimo_login, status, imagem
            FROM tbl_usuario
            WHERE id_empresa = %s
        """
        params = [id_empresa]

        if nome_filtro:
            sql += " AND nome_completo LIKE %s"
            params.append(f"%{nome_filtro}%")

        if status_filtro in ["Ativo", "Inativo", "Bloqueado"]:
            sql += " AND status = %s"
            params.append(status_filtro)

        sql += " ORDER BY nome_completo ASC LIMIT %s OFFSET %s"
        params.extend([registros_por_pagina, offset])

        # 🔢 Consulta de total para paginação
        count_sql = "SELECT COUNT(*) FROM tbl_usuario WHERE id_empresa = %s"
        count_params = [id_empresa]

        if nome_filtro:
            count_sql += " AND nome_completo LIKE %s"
            count_params.append(f"%{nome_filtro}%")

        if status_filtro in ["Ativo", "Inativo", "Bloqueado"]:
            count_sql += " AND status = %s"
            count_params.append(status_filtro)

        conn = Var_ConectarBanco()
        cursor = conn.cursor()

        # 🔄 Executar queries
        cursor.execute(count_sql, count_params)
        total_registros = cursor.fetchone()[0]

        cursor.execute(sql, params)
        usuarios = cursor.fetchall()

    except Exception as e:
        print(f"❌ Erro ao carregar usuários: {e}")
        return jsonify({"erro": f"Erro ao carregar usuários: {str(e)}"}), 500
    finally:
        conn.close()

    # 📦 Organiza resultado
    lista_usuarios = []
    for u in usuarios:
        lista_usuarios.append({
            "id": u[0],
            "nome_completo": u[1],
            "email": u[2],
            "whatsapp": u[3],
            "departamento": u[4],
            "grupo": u[5],
            "ultimo_login": u[6],
            "status": u[7],
            "imagem": u[8]
        })

    total_paginas = (total_registros // registros_por_pagina) + (1 if total_registros % registros_por_pagina > 0 else 0)

    return jsonify({
        "dados": lista_usuarios,
        "total_paginas": total_paginas,
        "pagina_atual": pagina
    })




# ✅ Rota para abrir o formulário de inclusão de usuário
@auth_bp.route('/usuario/incluir')
@login_obrigatorio
def usuario_incluir():
    return render_template('frm_usuario_apoio.html')





# ✅ Rota para abrir o formulário de edição de usuário
@auth_bp.route('/usuario/editar', methods=["GET"])
@login_obrigatorio
def usuario_editar():
    return render_template('frm_usuario_apoio.html')



# Rota para Salvar os dados do usuário
@auth_bp.route("/usuario/salvar", methods=["POST"])
def salvar_usuario():
    try:
        dados = request.get_json()
        print("📥 Dados recebidos do front-end:", dados)

        id_usuario = dados.get("id")
        nome_completo = dados.get("nome_completo", "").strip()
        nome = nome_completo.split(" ")[0] if nome_completo else ""
        email = dados.get("email", "").strip().lower()
        id_empresa = dados.get("id_empresa")
        id_grupo = dados.get("id_grupo")
        grupo_nome = dados.get("grupo")  # ✅ Nome do grupo para campo visível
        departamento = dados.get("departamento") or ""
        whatsapp = dados.get("whatsapp") or ""
        status = dados.get("status", "Ativo")
        imagem = dados.get("imagem", "userpadrao.png")

        conn = Var_ConectarBanco()
        cursor = conn.cursor()

        token = secrets.token_urlsafe(32)
        expira_em = datetime.now() + timedelta(hours=1)
        trocasenha_em = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        # Verifica se o e-mail já existe
        cursor.execute("SELECT id_usuario FROM tbl_usuario WHERE email = %s", (email,))
        usuario_existente = cursor.fetchone()

        if usuario_existente:
            return jsonify({"status": "erro", "mensagem": "Já existe um usuário com esse e-mail."}), 400

        if not id_usuario:
            senha_provisoria = "123456"
            senha_hash = bcrypt.hashpw(senha_provisoria.encode('utf-8'), bcrypt.gensalt())

            cursor.execute("""
                INSERT INTO tbl_usuario (
                    id_empresa, id_grupo, nome_completo, nome, email, grupo,
                    departamento, whatsapp, status, senha, imagem,
                    trocasenha_em, token_redefinicao, expira_em
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id_usuario
            """, (
                id_empresa, id_grupo, nome_completo, nome, email, grupo_nome,  # ✅ Corrigido aqui
                departamento, whatsapp, status, senha_hash, imagem,
                trocasenha_em, token, expira_em
            ))

            id_usuario = cursor.fetchone()[0]
            conn.commit()
            print("✅ Usuário incluído com ID:", id_usuario)

            # 🔗 Montar link
            base_url = os.getenv("BASE_PROD") if os.getenv("MODO_PRODUCAO", "false").lower() == "true" else os.getenv("BASE_DEV")
            link = f"{get_base_url()}/usuario/redefinir?token={token}"
            url_privacidade  = f"{base_url}/privacidade"
            url_logo         = f"{base_url}/static/imge/logorufino.png"
            url_redefinicao = f"{base_url}/usuario/redefinir?token={token}"
            # 📧 Enviar e-mail via API
            assunto = "Acesso ao sistema Rufino"
            corpo_html = f"""<!DOCTYPE html>
                <html lang="pt-br">
                <body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f4f4;">
                <table width="100%" cellpadding="0" cellspacing="0">
                    <tr><td align="center">
                    <table width="100%" style="max-width:600px;background:#ffffff;" cellpadding="20" cellspacing="0">
                        <tr><td style="text-align:left;">
                        <img src="{url_logo}" alt="Rufino Logo" style="max-width:200px;height:auto;display:block;">
                        </td></tr>
                        <tr><td style="border-top:1px solid #ddd;"></td></tr>
                        <tr><td>
                        <p>Olá <strong>{nome}</strong>,</p>
                        <p>Você foi cadastrado no sistema <strong>Rufino</strong>.</p>
                        <p>Para criar sua senha e acessar o sistema, <a href="{url_redefinicao}" style="color:#85C300;text-decoration:none;">clique aqui</a> ou copie e cole este link no navegador:</p>
                        <p><a href="{url_redefinicao}" style="word-break:break-all;color:#555;">{url_redefinicao}</a></p>
                        <p style="font-size:13px;color:#999;">Este link expira em 1 hora.</p>
                        </td></tr>
                        <tr><td style="background:#f9f9f9;padding:15px;border-radius:4px;font-size:14px;color:#666;">
                        <p><strong>Este e‑mail foi enviado exclusivamente por notificas@rufino.tech.</strong></p>
                        <ul style="margin:10px 0 0 15px;padding:0;">
                            <li>Não pedimos sua senha por e‑mail.</li>
                            <li>Verifique sempre se o link começa com <strong>rufino.tech</strong>.</li>
                            <li>Nunca informe dados sensíveis via e‑mail.</li>
                            <li>Se você não solicitou este acesso, ignore esta mensagem.</li>
                        </ul>
                        </td></tr>
                        <tr><td style="font-size:14px;color:#666;">
                        <p>Dúvidas? Consulte nossa <a href="{url_privacidade}" style="color:#85C300;text-decoration:none;">Política de Privacidade</a>.</p>
                        </td></tr>
                        <tr><td style="font-size:12px;color:#999;text-align:center;padding-top:20px;">
                        Obrigado por escolher a Rufino! © 2025 Rufino. Todos os direitos reservados.
                        </td></tr>
                    </table>
                    </td></tr>
                </table>
                </body></html>"""



            payload = {
                "destinatarios": [email],
                "assunto": assunto,
                "corpo_html": corpo_html,
                "tag": f"user_{id_usuario}",
                "id_empresa": id_empresa  # ✅ Usado na API e registro
            }

            try:
                url = f"{get_base_url()}/email/enviar"
                print("🌐 URL do envio:", url)
                print("📦 Payload:", payload)
                resp = requests.post(url, json=payload)
                print("📬 E-mail enviado:", resp.status_code, resp.text)
            except Exception as e:
                print("⚠️ Falha ao enviar e-mail:", str(e))

        else:
            cursor.execute("""
                UPDATE tbl_usuario SET
                    id_grupo = %s, nome_completo = %s, nome = %s, email = %s, usuario = %s,
                    departamento = %s, whatsapp = %s, status = %s, imagem = %s
                WHERE id_usuario = %s
            """, (
                id_grupo, nome_completo, nome, email, email,
                departamento, whatsapp, status, imagem, id_usuario
            ))
            conn.commit()
            print("✅ Usuário atualizado com ID:", id_usuario)

        conn.close()
        return jsonify({"status": "sucesso", "mensagem": "Usuário salvo com sucesso!", "id": id_usuario})

    except Exception as e:
        print("❌ Erro ao salvar usuário:", str(e))
        return jsonify({"status": "erro", "mensagem": str(e)}), 400





# função auxiliar para atribuir permissões ao usuário
def atribuir_permissoes_por_grupo(usuario_id, grupo):
    print(f"🔧 Iniciando atribuição de permissões para o usuário {usuario_id} do grupo '{grupo}'")

    conn = Var_ConectarBanco()
    cursor = conn.cursor()

    try:
        # Apaga permissões antigas
        print(f"🧹 Removendo permissões existentes do usuário {usuario_id}...")
        cursor.execute("DELETE FROM tbl_permissoes WHERE usuario_id = %s", (usuario_id,))
        conn.commit()

        # Busca permissões do grupo
        print(f"🔍 Buscando permissões padrão do grupo '{grupo}'...")
        cursor.execute("SELECT submenu_id FROM tbl_permissoes_modelo WHERE grupo = %s", (grupo,))
        permissoes = cursor.fetchall()

        if not permissoes:
            print(f"⚠️ Nenhuma permissão modelo encontrada para o grupo '{grupo}'.")
        else:
            print(f"📋 {len(permissoes)} permissões encontradas. Inserindo...")

        # Insere permissões
        for p in permissoes:
            print(f"➕ Inserindo submenu_id {p[0]} para usuário_id {usuario_id}")
            cursor.execute("INSERT INTO tbl_permissoes (usuario_id, submenu_id) VALUES (%s, %s)", (usuario_id, p[0]))

        conn.commit()
        print(f"✅ Permissões atribuídas com sucesso ao usuário {usuario_id}.")

    except Exception as e:
        print(f"❌ Erro ao atribuir permissões para o usuário {usuario_id}: {e}")
        raise

    finally:
        conn.close()




# ✅ Rota para excluir um usuário
@auth_bp.route('/usuario/delete', methods=['POST'])
@login_obrigatorio
def excluir_usuario():
    conn = None
    try:
        dados = request.get_json()
        usuario_id = dados.get("id")
        id_empresa = session.get("id_empresa")

        if not usuario_id:
            return jsonify({"status": "erro", "mensagem": "ID do usuário não foi fornecido."}), 400
        if not id_empresa:
            return jsonify({"status": "erro", "mensagem": "Sessão expirada ou cliente não identificado."}), 403

        conn = Var_ConectarBanco()
        cursor = conn.cursor()

        # 🔍 Verifica se é o usuário criador
        cursor.execute("""
            SELECT criador FROM tbl_usuario 
            WHERE id_usuario = %s AND id_empresa = %s
        """, (usuario_id, id_empresa))
        resultado = cursor.fetchone()

        if resultado and resultado[0] == 1:
            print(f"🚫 Tentativa de excluir o usuário criador: {usuario_id}")
            return jsonify({"status": "erro", "mensagem": "Usuário criador não pode ser excluído."}), 403

        # 🔄 Exclusão segura
        print(f"🗑️ Excluindo usuário com ID {usuario_id} da empresa {id_empresa}...")
        cursor.execute("""
            DELETE FROM tbl_usuario 
            WHERE id_usuario = %s AND id_empresa = %s
        """, (usuario_id, id_empresa))
        conn.commit()

        return jsonify({"status": "sucesso", "mensagem": "Usuário excluído com sucesso!"})

    except Exception as e:
        print(f"❌ Erro ao excluir usuário: {str(e)}")
        return jsonify({"status": "erro", "mensagem": str(e)}), 500

    finally:
        if conn:
            conn.close()

# rota para redefinir a senha do usuário
@auth_bp.route("/usuario/redefinir", methods=["GET", "POST"])
def usuario_redefinir():
    if request.method == "GET":
        token = request.args.get("token", "").strip()
        if not token:
            return "Token não informado.", 400
        return render_template("frm_usuario_redefinir.html", token=token)

    # Se for POST, mantém o código atual que processa a nova senha
    try:
        dados = request.get_json()
        token = dados.get("token", "").strip()
        senha_plana = dados.get("senha", "").strip()

        if not token or not senha_plana:
            return jsonify({"mensagem": "Token ou senha não fornecidos."}), 400

        conn = Var_ConectarBanco()
        cursor = conn.cursor()

        cursor.execute("SELECT id_usuario FROM tbl_usuario WHERE token_redefinicao = %s", (token,))
        usuario = cursor.fetchone()
        if not usuario:
            return jsonify({"mensagem": "Token inválido ou expirado."}), 400

        id_usuario = usuario[0]
        senha_hash = bcrypt.hashpw(senha_plana.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        nova_data = datetime.now() + timedelta(days=90)


        cursor.execute("""
            UPDATE tbl_usuario
            SET senha = %s, trocasenha_em = %s, token_redefinicao = NULL
            WHERE id_usuario = %s
        """, (senha_hash, nova_data, id_usuario))

        conn.commit()
        conn.close()
        return jsonify({"mensagem": "Senha redefinida com sucesso! Agora você pode fazer login."})

    except Exception as e:
        print("❌ Erro ao redefinir senha:", str(e))
        return jsonify({"mensagem": "Erro interno ao redefinir senha."}), 500




# ------------------------------------------------------------
# ✅ ROTAS DE PERMISSÃO DE ACESSO AO USUÁRIO
# ------------------------------------------------------------

@auth_bp.route("/usuario/permissoes")
@login_obrigatorio
def pagina_permissoes_usuario():
    return render_template("frm_usuario_permissoes.html")



# 🔹 Retorna todos os usuários ativos
@auth_bp.route("/permissao/ativos")
@login_obrigatorio
def get_usuarios_ativos():
    id_empresa = session.get("id_empresa")
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, nome_completo 
        FROM tbl_usuario 
        WHERE status = 'ATIVO' AND id_empresa = %s
    """, (id_empresa,))
    usuarios = [{"id": row[0], "nome_completo": row[1]} for row in cursor.fetchall()]
    return jsonify(usuarios)


@auth_bp.route("/permissao/id/<int:usuario_id>")
@login_obrigatorio
def get_permissoes_usuario(usuario_id):
    id_empresa = session.get("id_empresa")
    conn = Var_ConectarBanco()
    cursor = conn.cursor()

    # Verifica se o usuário pertence à empresa
    cursor.execute("SELECT grupo FROM tbl_usuario WHERE id = %s AND id_empresa = %s", (usuario_id, id_empresa))
    resultado = cursor.fetchone()

    if not resultado:
        return jsonify({"erro": "Usuário não encontrado ou não pertence à sua empresa."}), 404

    grupo_usuario = resultado[0]

    if grupo_usuario.upper() == "ADMINISTRADOR":
        cursor.execute("SELECT id FROM tbl_permissoes_submenus ORDER BY ordem")
        permissoes = [{"submenu_id": row[0]} for row in cursor.fetchall()]
    else:
        cursor.execute("""
            SELECT submenu_id FROM tbl_permissoes 
            WHERE usuario_id = %s AND permitido = 1
        """, (usuario_id,))
        permissoes = [{"submenu_id": row[0]} for row in cursor.fetchall()]

    conn.close()
    return jsonify(permissoes)


# 🔹 Atualiza a lista de permissões de um usuário
@auth_bp.route("/permissao/salvar", methods=["POST"])
@login_obrigatorio
def salvar_permissoes():
    data = request.get_json()
    usuario_id = data.get("usuario_id")
    permissoes = data.get("permissoes", [])

    conn = Var_ConectarBanco()
    cursor = conn.cursor()

    # Remove permissões antigas
    cursor.execute("DELETE FROM tbl_permissoes WHERE usuario_id = %s", (usuario_id,))

    # Insere novas permissões
    for item in permissoes:
        cursor.execute("""
            INSERT INTO tbl_permissoes (usuario_id, submenu_id, permitido)
            VALUES (%s, %s, %s)
        """, (usuario_id, item["submenu_id"], item["permitido"]))

    conn.commit()
    return jsonify({"status": "ok", "msg": "Permissões atualizadas com sucesso."})

# 🔹 Aplica o modelo de permissões com base no grupo selecionado
@auth_bp.route("/permissao/modelo", methods=["POST"])
@login_obrigatorio
def aplicar_permissao_modelo():
    try:
        dados = request.get_json()
        usuario_id = dados.get("usuario_id")
        grupo = dados.get("grupo")

        if not usuario_id or not grupo:
            return jsonify({"erro": "Dados incompletos"}), 400

        #usuario_id = cursor.fetchone()[0]
        #atribuir_permissoes_por_grupo(usuario_id, grupo_nome)    3333333333333333333333333333333333333333333333333333333333333333333333

        return jsonify({"mensagem": "Permissões modelo aplicadas com sucesso"})

    except Exception as e:
        print("Erro ao aplicar permissões modelo:", e)
        return jsonify({"erro": "Erro interno ao aplicar permissões"}), 500

# 🔹 Retorna todos os grupos de permissões cadastrados
@auth_bp.route("/permissao/grupos")
@login_obrigatorio
def listar_grupos_permissao():
    try:
        id_empresa = session.get("id_empresa")
        conn = Var_ConectarBanco()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, nome_grupo 
            FROM tbl_usuario_grupo 
            WHERE id_empresa = %s 
            ORDER BY nome_grupo ASC
        """, (id_empresa,))
        grupos = [{"id": row[0], "grupo": row[1]} for row in cursor.fetchall()]
        return jsonify(grupos)
    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    finally:
        conn.close()


# 🔹 Função auxiliar: aplica permissões com base na tbl_permissoes_modelo
def atribuir_permissoes_por_grupo(usuario_id, grupo_nome):
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    print(f"🔍 Atribuindo permissões do grupo '{grupo_nome}' para o usuário ID {usuario_id}")
    try:
        cursor.execute("""
            SELECT submenuid, permitido
            FROM tbl_permissoes_modelo
            WHERE gruponome = %s
        """, (grupo_nome,))
        permissoes = cursor.fetchall()

        for submenu_id, permitido in permissoes:
            cursor.execute("""
                INSERT INTO tbl_permissoes (usuario_id, submenu_id, permitido)
                VALUES (%s, %s, %s)
            """, (usuario_id, submenu_id, permitido))

        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"Erro ao atribuir permissões: {e}")
    finally:
        conn.close()







# 🔹 Carrega as opções do combo de permissões ***
@auth_bp.route("/permissao/combobox", methods=["GET"])
def permissao_combobox():
    try:
        conn = Var_ConectarBanco()
        cursor = conn.cursor()

        # Grupos personalizados
        cursor.execute("SELECT id, nome_grupo FROM tbl_usuario_grupo ORDER BY nome_grupo ASC")
        grupos = [{"id": row[0], "nome": row[1]} for row in cursor.fetchall()]

        # Insere opções fixas no topo com id nulo
        grupos.insert(0, {"id": None, "nome": "Administrador"})

        return jsonify({"status": "sucesso", "dados": grupos})
    
    except Exception as e:
        return jsonify({"status": "erro", "mensagem": str(e)}), 500
    finally:
        conn.close()



@auth_bp.route("/permissao/idgrupo", methods=["POST"])
def buscar_id_grupo():
    try:
        dados = request.get_json()
        nome_grupo = dados.get("grupo", "").strip()

        if not nome_grupo:
            return jsonify({"status": False, "mensagem": "Grupo não informado."}), 400

        conn = Var_ConectarBanco()
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM tbl_usuario_grupo WHERE nome_grupo = %s", (nome_grupo,))
        resultado = cursor.fetchone()
        conn.close()

        if resultado:
            return jsonify({"status": True, "id": resultado[0]})
        else:
            return jsonify({"status": False, "mensagem": "Grupo não encontrado."}), 404

    except Exception as e:
        return jsonify({"status": False, "mensagem": str(e)}), 500






# ------------------------------------------------------------
# ✅ ROTAS PARA O email dentro de configurações
# ------------------------------------------------------------
@auth_bp.route("/email/dados")
def email_dados():
    try:
        id_empresa = session.get("id_empresa")
        if not id_empresa:
            return jsonify([])

        status = request.args.get("status", "")
        destinatario = request.args.get("destinatario", "")
        data_inicio = request.args.get("data_inicio", "")
        data_fim = request.args.get("data_fim", "")

        conn = Var_ConectarBanco()
        cursor = conn.cursor()

        query = """
            SELECT l.id_log, l.assunto, l.destinatario, l.status, l.data_envio, e.tag_email as tag
            FROM tbl_email_log l
            JOIN tbl_email_envio e ON e.tag_email = l.tag
            WHERE e.id_empresa = %s
        """
        params = [id_empresa]

        if status:
            query += " AND l.status = %s"
            params.append(status)

        if destinatario:
            query += " AND l.destinatario LIKE %s"
            params.append(f"%{destinatario}%")

        if data_inicio:
            query += " AND date(l.data_envio) >= %s"
            params.append(data_inicio)

        if data_fim:
            query += " AND date(l.data_envio) <= %s"
            params.append(data_fim)

        query += " ORDER BY l.data_envio DESC LIMIT 100"

        cursor.execute(query, params)
        registros = cursor.fetchall()

        resultado = [{
            "id_log": r[0],
            "assunto": r[1],
            "destinatario": r[2],
            "status": r[3],
            "data_envio": r[4],
            "tag": r[5]
        } for r in registros]

        return jsonify(resultado)

    except Exception as e:
        print("❌ Erro em /email/logs:", e)
        return jsonify([])

    finally:
        if conn:
            conn.close()



@auth_bp.route("/email/log/detalhes/<tag>")
def email_detalhes(tag):
    try:
        id_empresa = session.get("id_empresa")
        if not id_empresa:
            return jsonify([])

        conn = Var_ConectarBanco()
        cursor = conn.cursor()

        # 1. Buscar destinatários do envio
        cursor.execute("""
            SELECT d.id_destinatario, d.email, d.status_atual
            FROM tbl_email_destinatario d
            JOIN tbl_email_envio e ON d.id_envio = e.id_envio
            WHERE d.tag_email = %s AND e.id_empresa = %s
        """, (tag, id_empresa))

        destinatarios = cursor.fetchall()

        resultado = []
        for dest in destinatarios:
            id_dest, email, status_atual = dest

            # 2. Buscar eventos do destinatário
            cursor.execute("""
                SELECT tipo_evento, data_evento
                FROM tbl_email_evento
                WHERE id_destinatario = %s
                ORDER BY data_evento DESC
            """, (id_dest,))
            eventos = cursor.fetchall()

            eventos_formatados = [{
                "tipo_evento": ev[0].capitalize(),
                "data_evento": ev[1]
            } for ev in eventos]

            resultado.append({
                "email": email,
                "status_atual": status_atual,
                "eventos": eventos_formatados
            })

        return jsonify(resultado)

    except Exception as e:
        print("❌ Erro em /email/log/detalhes:", e)
        return jsonify([])

    finally:
        if conn:
            conn.close()



@auth_bp.route("/email/log/reenviar/<tag>", methods=["POST"])
def email_reenviar(tag):
    try:
        id_empresa = session.get("id_empresa")
        if not id_empresa:
            return jsonify({"status": "error", "titulo": "Erro", "mensagem": "Sessão expirada."})

        conn = Var_ConectarBanco()
        cursor = conn.cursor()

        # Buscar os destinatários da TAG com status de erro
        cursor.execute("""
            SELECT d.id_destinatario, d.email, d.id_envio
            FROM tbl_email_destinatario d
            JOIN tbl_email_envio e ON d.id_envio = e.id_envio
            WHERE d.tag_email = %s AND e.id_empresa = %s AND d.status_atual IN ('Falha', 'Aguardando')
        """, (tag, id_empresa))

        destinatarios = cursor.fetchall()
        if not destinatarios:
            return jsonify({"status": "info", "titulo": "Nenhum Reenvio", "mensagem": "Todos os e-mails já foram entregues ou abertos."})

        # Simulação: aqui você chamaria sua função de envio de e-mails
        for dest in destinatarios:
            id_dest, email, id_envio = dest

            # Marcar como reenviado
            cursor.execute("""
                INSERT INTO tbl_email_evento (id_destinatario, tipo_evento, data_evento)
                VALUES (%s, 'reenviado', datetime('now', 'localtime'))
            """, (id_dest,))

            # Atualiza status para "Enviado"
            cursor.execute("""
                UPDATE tbl_email_destinatario
                SET status_atual = 'Enviado', dt_ultimo_evento = datetime('now', 'localtime')
                WHERE id_destinatario = %s
            """, (id_dest,))

        conn.commit()

        return jsonify({"status": "success", "titulo": "E-mails reenviados", "mensagem": "Processo concluído com sucesso."})

    except Exception as e:
        print("❌ Erro no reenvio:", e)
        return jsonify({"status": "error", "titulo": "Erro", "mensagem": str(e)})

    finally:
        if conn:
            conn.close()




# ────────────────────────────────────────────────
# ROTAS PARA MARKTPLACE
# ────────────────────────────────────────────────
@auth_bp.route("/marketplace/api", methods=["GET"])
def api_marketplace():
    conn = None
    try:
        id_empresa = session.get("id_empresa")
        if not id_empresa:
            return jsonify([])

        conn = Var_ConectarBanco()
        cursor = conn.cursor()

        # Seleciona apps disponíveis para venda
        cursor.execute("""
            SELECT id, nome_menu, descricao, valor, obs
            FROM tbl_menu
            WHERE assinatura_app = true AND ativo = true

            ORDER BY ordem
        """)
        apps = cursor.fetchall()

        lista = []
        for id_modulo, nome, desc, valor, obs in apps:
            # Verifica se já foi assinado por este cliente com status Ativo
            cursor.execute("""
                SELECT 1 FROM tbl_fatura_assinatura
                WHERE id_empresa = %s AND id_modulo = %s AND status = 'Ativo'
            """, (id_empresa, id_modulo))
            assinado = cursor.fetchone() is not None

            # Converte entidades HTML para texto visível
            obs_convertida = html.unescape(obs or '')

            lista.append({
                "id": id_modulo,
                "nome_menu": nome,
                "descricao": desc,
                "valor": valor,
                "obs": obs_convertida,
                "assinado": assinado
            })

        return jsonify(lista)

    except Exception as e:
        print(f"❌ Erro em /marketplace/api: {str(e)}")
        return jsonify([])

    finally:
        if conn:
            conn.close()





@auth_bp.route("/marketplace/assinar", methods=["POST"])
def assinar_app():
    conn = None
    try:
        dados = request.get_json()
        id_empresa = session.get("id_empresa")
        id_modulo = dados.get("id_modulo")

        if not id_empresa or not id_modulo:
            return jsonify({"status": "erro", "mensagem": "Cliente ou módulo inválido."})

        conn = Var_ConectarBanco()
        cursor = conn.cursor()

        # Verifica se já existe assinatura ativa
        cursor.execute("""
            SELECT 1 FROM tbl_fatura_assinatura
            WHERE id_empresa = %s AND id_modulo = %s AND status = 'Ativo'
        """, (id_empresa, id_modulo))
        if cursor.fetchone():
            return jsonify({"status": "erro", "mensagem": "Este app já está assinado."})

        # Dados do app
        cursor.execute("SELECT nome_menu, valor FROM tbl_menu WHERE id = %s", (id_modulo,))
        app = cursor.fetchone()
        if not app:
            return jsonify({"status": "erro", "mensagem": "Módulo não encontrado."})

        nome_modulo, valor = app
        hoje = datetime.now().date().isoformat()

        # Insere na tbl_fatura_assinatura
        cursor.execute("""
            INSERT INTO tbl_fatura_assinatura (
                id_empresa, id_modulo, nome_modulo,
                periodo_inicio, periodo_fim, valor, status
            ) VALUES (%s, %s, %s, %s, NULL, %s, 'Ativo')
        """, (id_empresa, id_modulo, nome_modulo, hoje, valor))

        
        conn.commit()

        # Envia e-mail de confirmação
        enviar_email_confirmacao_assinatura(id_empresa, id_modulo)

        return jsonify({
            "status": "sucesso",
            "mensagem": f"O módulo '{nome_modulo}' foi assinado com sucesso e já está liberado para uso."
        })

    except Exception as e:
        print("❌ Erro ao assinar app:", str(e))
        return jsonify({"status": "erro", "mensagem": str(e)})

    finally:
        if conn:
            conn.close()

def enviar_email_confirmacao_assinatura(id_empresa, id_modulo):
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT e.email_cobranca, m.nome_menu
            FROM tbl_empresa e
            JOIN tbl_menu m ON m.id = %s
            WHERE e.id = %s
        """, (id_modulo, id_empresa))

        resultado = cursor.fetchone()
        if not resultado:
            print("⚠️ Dados do e-mail não encontrados.")
            return

        email_destinatario, nome_app = resultado
        assunto = f"Assinatura confirmada - {nome_app}"
        corpo = f"""
Olá!

Sua assinatura do app *{nome_app}* foi concluída com sucesso.

Você já pode utilizá-lo imediatamente na plataforma Rufino.

Atenciosamente,
Equipe Rufino
"""

        # Determina base conforme ambiente
        modo_producao = os.getenv("MODO_PRODUCAO", "false").lower() == "true"
        base_url = os.getenv("BASE_PROD") if modo_producao else os.getenv("BASE_DEV")
        url_envio = f"{base_url}/email/enviar"

        print(f"📨 Enviando e-mail para {email_destinatario} via {url_envio}...")

        response = requests.post(url_envio, json={
            "destinatarios": [email_destinatario],
            "assunto": assunto,
            "mensagem": corpo
        })

        if response.status_code != 200:
            print(f"❌ Erro ao enviar e-mail: {response.text}")
        else:
            print("✅ E-mail enviado com sucesso.")

    except Exception as e:
        print("❌ Erro ao preparar envio de e-mail:", str(e))

    finally:
        conn.close()


# ────────────────────────────────────────────────
# 6️⃣ ROTAS DE COBRANÇAS
# ────────────────────────────────────────────────
@auth_bp.route("/cobranca/fatura_pre")
def abrir_fatura_pre():
    return render_template("frm_fatura_pre.html")


@auth_bp.route("/cobranca/pendentes", methods=["GET"])
def cobranca_pendentes():
    try:
        conn = Var_ConectarBanco()
        cursor = conn.cursor()

        competencia = request.args.get("competencia")
        id_empresa = request.args.get("id_empresa")

        if not competencia or not re.match(r"^\d{4}-\d{2}$", competencia):
            return jsonify({"status": "erro", "mensagem": "Competência obrigatória no formato YYYY-MM."}), 400

        # 📆 Período da competência
        ano, mes = map(int, competencia.split("-"))
        primeiro_dia = datetime(ano, mes, 1)
        _, dias_no_mes = calendar.monthrange(ano, mes)
        ultimo_dia = datetime(ano, mes, dias_no_mes)

        # 🔍 Seleciona assinaturas ativas na competência
        sql = """
            SELECT fa.id_empresa, fa.nome_modulo, fa.valor, fa.periodo_inicio, fa.periodo_fim, e.nome_empresa
            FROM tbl_fatura_assinatura fa
            JOIN tbl_empresa e ON e.id = fa.id_empresa
            WHERE fa.periodo_inicio <= %s
              AND (fa.periodo_fim IS NULL OR fa.periodo_fim >= %s)
        """
        params = [ultimo_dia.strftime("%Y-%m-%d"), primeiro_dia.strftime("%Y-%m-%d")]

        if id_empresa:
            sql += " AND fa.id_empresa = %s"
            params.append(id_empresa)

        cursor.execute(sql, params)
        registros = cursor.fetchall()

        # 🚫 Evita repetir clientes que já têm fatura na competência
        cursor.execute("SELECT id_empresa FROM tbl_fatura WHERE competencia = %s", (competencia,))
        clientes_faturados = set(row[0] for row in cursor.fetchall())

        if id_empresa:
            # 👁️ Detalhado por módulo (para popup)
            resultado = []
            for row in registros:
                id_cli, modulo, valor, dt_ini_str, dt_fim_str, _ = row

                if id_cli in clientes_faturados:
                    continue

                dt_ini = datetime.strptime(dt_ini_str, "%Y-%m-%d")
                dt_fim = datetime.strptime(dt_fim_str, "%Y-%m-%d") if dt_fim_str else None

                inicio = max(dt_ini, primeiro_dia)
                fim = min(dt_fim if dt_fim else ultimo_dia, ultimo_dia)

                if fim < inicio:
                    continue

                dias_ativos = (fim - inicio).days + 1
                valor_proporcional = round((dias_ativos / dias_no_mes) * float(valor), 2)

                resultado.append({
                    "nome_modulo": modulo,
                    "periodo": f"{inicio.strftime('%Y-%m-%d')} a {fim.strftime('%Y-%m-%d')}",
                    "valor": valor_proporcional
                })

            return jsonify(resultado)

        else:
            # 📋 Agrupado por cliente (para tela principal)
            resumo = {}
            for row in registros:
                id_cli, modulo, valor, dt_ini_str, dt_fim_str, nome_cli = row

                if id_cli in clientes_faturados:
                    continue

                dt_ini = datetime.strptime(dt_ini_str, "%Y-%m-%d")
                dt_fim = datetime.strptime(dt_fim_str, "%Y-%m-%d") if dt_fim_str else None

                inicio = max(dt_ini, primeiro_dia)
                fim = min(dt_fim if dt_fim else ultimo_dia, ultimo_dia)

                if fim < inicio:
                    continue

                dias_ativos = (fim - inicio).days + 1
                valor_proporcional = round((dias_ativos / dias_no_mes) * float(valor), 2)

                if id_cli not in resumo:
                    resumo[id_cli] = {
                        "id_empresa": id_cli,
                        "nome": nome_cli,
                        "competencia": competencia,
                        "valor_estimado": 0
                    }

                resumo[id_cli]["valor_estimado"] += valor_proporcional

            return jsonify(list(resumo.values()))

    except Exception as e:
        print(f"❌ Erro ao buscar faturamentos pendentes: {e}")
        return jsonify({"status": "erro", "mensagem": str(e)}), 500

    finally:
        if conn:
            conn.close()




@auth_bp.route("/cobranca/faturas", methods=["POST"])
def cobranca_faturas():
    try:
        dados = request.get_json()
        cliente = dados.get("cliente", "").strip()
        data_inicio = dados.get("data_inicio")
        data_fim = dados.get("data_fim")
        status = dados.get("status", "").strip()

        conn = Var_ConectarBanco()
        cursor = conn.cursor()

        sql = """
        SELECT f.id, e.nome_empresa AS nome, f.dt_referencia, f.vencimento,
               f.valor_total, f.status_pagamento
        FROM tbl_fatura f
        JOIN tbl_empresa e ON f.id_empresa = e.id
        WHERE f.dt_referencia BETWEEN %s AND %s
        """
        params = [data_inicio, data_fim]

        if cliente:
            sql += " AND e.nome_empresa LIKE %s"
            params.append(f"%{cliente}%")

        if status:
            sql += " AND f.status_pagamento = %s"
            params.append(status)

        sql += " ORDER BY f.dt_referencia DESC, e.nome_empresa"

        cursor.execute(sql, params)
        linhas = cursor.fetchall()
        colunas = [desc[0] for desc in cursor.description]
        resultado = [dict(zip(colunas, linha)) for linha in linhas]

        return jsonify(resultado)

    except Exception as e:
        print(f"❌ Erro ao listar faturas: {e}")
        return jsonify({"status": "erro", "mensagem": str(e)}), 500

    finally:
        if conn:
            conn.close()


@auth_bp.route("/cobranca/preparar", methods=["POST"])
def cobranca_preparar():
    try:
        dados = request.get_json()
        id_empresa = dados.get("id_empresa")
        dt_referencia = dados.get("dt_referencia")  # Ex: "2025-03-01"

        if not id_empresa or not dt_referencia:
            return jsonify({"status": "erro", "mensagem": "Dados incompletos."}), 400

        referencia = datetime.strptime(dt_referencia, "%Y-%m-%d")
        ano = referencia.year
        mes = referencia.month
        primeiro_dia = datetime(ano, mes, 1)
        ultimo_dia = (primeiro_dia + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        dias_mes = (ultimo_dia - primeiro_dia).days + 1

        conn = Var_ConectarBanco()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT nome_modulo, valor, dt_inicio
            FROM tbl_fatura_assinatura
            WHERE id_empresa = %s AND status = 'Ativo'
        """, (id_empresa,))
        modulos = cursor.fetchall()

        total = 0
        detalhes = []

        for nome_modulo, valor, dt_inicio in modulos:
            inicio = datetime.strptime(dt_inicio, "%Y-%m-%d")
            if inicio <= primeiro_dia:
                periodo = f"{primeiro_dia.strftime('%d/%m')} a {ultimo_dia.strftime('%d/%m')}"
                valor_apurado = valor
            elif inicio > ultimo_dia:
                continue  # assinatura começa no próximo mês
            else:
                dias_ativos = (ultimo_dia - inicio).days + 1
                valor_apurado = round((valor / dias_mes) * dias_ativos, 2)
                periodo = f"{inicio.strftime('%d/%m')} a {ultimo_dia.strftime('%d/%m')}"

            total += valor_apurado

            detalhes.append({
                "modulo": nome_modulo,
                "periodo": periodo,
                "valor": f"{valor_apurado:.2f}".replace(".", ",")
            })

        competencia = f"{ano}-{str(mes).zfill(2)}"
        vencimento_sugerido = (ultimo_dia + timedelta(days=15)).replace(day=15)
        if vencimento_sugerido.weekday() >= 5:  # sábado ou domingo
            while vencimento_sugerido.weekday() >= 5:
                vencimento_sugerido += timedelta(days=1)

        return jsonify({
            "status": "sucesso",
            "competencia": competencia,
            "vencimento_sugerido": vencimento_sugerido.strftime("%Y-%m-%d"),
            "detalhes": detalhes,
            "valor_total": f"{total:.2f}".replace(".", ",")
        })

    except Exception as e:
        print(f"❌ Erro ao preparar fatura: {e}")
        return jsonify({"status": "erro", "mensagem": str(e)}), 500



@auth_bp.route("/cobranca/gerar", methods=["POST"])
def gerar_fatura():
    try:
        dados = request.get_json()
        id_empresa = dados.get("id_empresa")
        competencia = dados.get("competencia")
        vencimento = dados.get("vencimento")
        valor_total = dados.get("valor_total")
        forma_pagamento = dados.get("forma_pagamento")

        if not all([id_empresa, competencia, vencimento, valor_total, forma_pagamento]):
            return jsonify({"status": "erro", "mensagem": "Dados obrigatórios não informados."}), 400

        # 🚫 Verifica se já existe fatura para a competência
        conn = Var_ConectarBanco()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id FROM tbl_fatura WHERE id_empresa = %s AND competencia = %s
        """, (id_empresa, competencia))
        if cursor.fetchone():
            return jsonify({"status": "erro", "mensagem": "Já existe fatura para esta competência."}), 400

        # 🔎 Busca e-mail e nome da empresa
        cursor.execute("""
            SELECT email_financeiro, nome_empresa FROM tbl_empresa WHERE id = %s
        """, (id_empresa,))
        empresa = cursor.fetchone()
        if not empresa:
            return jsonify({"status": "erro", "mensagem": "Empresa não encontrada."}), 404

        email_financeiro, nome_empresa = empresa
        if not email_financeiro:
            return jsonify({"status": "erro", "mensagem": "E-mail financeiro não informado."}), 400

        # 🧾 Insere a fatura
        cursor.execute("""
            INSERT INTO tbl_fatura (
                id_empresa, vencimento, valor_total, forma_pagamento,
                status_pagamento, competencia
            ) VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            id_empresa, vencimento, valor_total,
            forma_pagamento, 'Pendente', competencia
        ))
        id_fatura = cursor.fetchone()[0]
        conn.commit()

        # 🏦 Geração da cobrança
        
        resultado = gerar_cobranca_efi(id_fatura)

        if resultado.get("status") != "sucesso":
            return jsonify({
                "status": "erro",
                "mensagem": "Fatura criada, mas falha na geração da cobrança.",
                "erro_efi": resultado.get("mensagem")
            }), 500

        link_pagamento = resultado.get("link_pagamento")

        # 📧 E-mail com o link da cobrança
        email_payload = {
            "destinatarios": [email_financeiro],
            "assunto": f"Cobrança gerada - {nome_empresa}",
            "corpo_html": f"""
                <p>Olá,</p>
                <p>Sua fatura da competência <strong>{competencia}</strong> está disponível para pagamento.</p>
                <p><strong>Vencimento:</strong> {datetime.strptime(vencimento, "%Y-%m-%d").strftime("%d/%m/%Y")}</p>
                <p><strong>Valor:</strong> R$ {valor_total:.2f}</p>
                <p><a href="{link_pagamento}" target="_blank">🔗 Clique aqui para pagar via {forma_pagamento.upper()}</a></p>
                <p>Atenciosamente,<br>Sistema Rufino</p>
            """,
            "tag": "cobranca_gerada"
        }

        requests.post(
            url_for("auth.email_enviar", _external=True),
            json=email_payload
        )

        return jsonify({"status": "sucesso", "mensagem": "Fatura gerada e cobrança enviada ao cliente!"})

    except Exception as e:
        print("❌ Erro ao gerar fatura:", e)
        return jsonify({"status": "erro", "mensagem": str(e)}), 500



@auth_bp.route("/cobranca/resumo", methods=["POST"])
def resumo_fatura():
    try:
        dados = request.get_json()
        id_empresa = dados.get("id_empresa")
        dt_referencia = dados.get("dt_referencia")

        if not id_empresa or not dt_referencia:
            return jsonify({"status": "erro", "mensagem": "Dados incompletos."}), 400

        # ⏱️ Competência e vencimento sugerido
        referencia = datetime.strptime(dt_referencia, "%Y-%m-%d")
        competencia = referencia.strftime("%Y-%m")
        vencimento_sugerido = (referencia.replace(day=28) + timedelta(days=15)).replace(day=15)

        # 🗓️ Postergar se cair em fim de semana (feriados não tratados ainda)
        while vencimento_sugerido.weekday() >= 5:
            vencimento_sugerido += timedelta(days=1)

        conn = Var_ConectarBanco()
        cursor = conn.cursor()

        # 🔎 Buscar módulos ativos do cliente
        cursor.execute("""
            SELECT nome_modulo, valor, dt_inicio, dt_fim
            FROM tbl_fatura_assinatura
            WHERE id_empresa = %s AND status = 'Ativo'
        """, (id_empresa,))
        modulos = cursor.fetchall()

        total = 0.0
        linhas = []

        for nome_modulo, valor, dt_inicio, dt_fim in modulos:
            inicio = datetime.strptime(dt_inicio, "%Y-%m-%d")
            fim = datetime.strptime(dt_fim, "%Y-%m-%d") if dt_fim else None

            primeiro_dia = referencia.replace(day=1)
            ultimo_dia = (referencia.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)

            # Verifica se estava ativo no mês
            if inicio > ultimo_dia or (fim and fim < primeiro_dia):
                continue

            dias_mes = (ultimo_dia - primeiro_dia).days + 1
            dias_validos = (min(ultimo_dia, fim) if fim else ultimo_dia) - max(primeiro_dia, inicio)
            dias_ativos = dias_validos.days + 1

            if dias_ativos < dias_mes:
                valor_calc = round((valor / dias_mes) * dias_ativos, 2)
                periodo = f"Parcial: {max(primeiro_dia, inicio).strftime('%d/%m')} a {min(ultimo_dia, fim).strftime('%d/%m') if fim else ultimo_dia.strftime('%d/%m')}"
            else:
                valor_calc = round(valor, 2)
                periodo = referencia.strftime("%B").capitalize()

            total += valor_calc
            linhas.append({
                "modulo": nome_modulo,
                "periodo": periodo,
                "valor": f"{valor_calc:.2f}".replace(".", ",")
            })

        return jsonify({
            "status": "sucesso",
            "competencia": competencia,
            "vencimento_sugerido": vencimento_sugerido.strftime("%Y-%m-%d"),
            "total": f"{total:.2f}".replace(".", ","),
            "itens": linhas
        })

    except Exception as e:
        print(f"❌ Erro ao gerar resumo da fatura: {e}")
        return jsonify({"status": "erro", "mensagem": str(e)}), 500

# parar puxar a forma de pagamento padrão do cliente
@auth_bp.route("/empresa/forma_pagamento")
def forma_pagamento_empresa():
    id_empresa = request.args.get("id_empresa")

    if not id_empresa:
        return jsonify({"status": "erro", "mensagem": "ID do cliente não informado."}), 400

    conn = Var_ConectarBanco()
    cursor = conn.cursor()

    cursor.execute("SELECT forma_pagamento_padrao FROM tbl_empresa WHERE id = %s", (id_empresa,))
    linha = cursor.fetchone()
    conn.close()

    if linha:
        return jsonify({"forma_pagamento_padrao": linha[0]})
    else:
        return jsonify({"forma_pagamento_padrao": "pix"})



# ────────────────────────────────────────────────
# Rotas para menu em Configurações
# ────────────────────────────────────────────────
@auth_bp.route("/menu/dados")
@login_obrigatorio
def menu_dados():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()

    pagina = int(request.args.get("pagina", 1))
    por_pagina = int(request.args.get("porPagina", 20))
    offset = (pagina - 1) * por_pagina

    nome_menu = request.args.get("nome_menu", "").strip()
    local_menu = request.args.get("local_menu", "").strip()  # <-- usa exatamente 'horizontal' ou 'lateral'

    print(f"🔍 Filtro recebido: nome_menu='{nome_menu}', local_menu='{local_menu}'")

    base_sql = "SELECT * FROM tbl_menu WHERE 1=1"
    valores = []

    if nome_menu:
        base_sql += " AND nome_menu ILIKE %s"
        print(f"🔍 Filtro recebido2: nome_menu='{nome_menu}', local_menu='{local_menu}'")
        valores.append(f"%{nome_menu}%")

    if local_menu:
        base_sql += " AND local_menu = %s"
        valores.append(local_menu)

    sql_total = f"SELECT COUNT(*) FROM ({base_sql}) AS sub"
    cursor.execute(sql_total, valores)
    total_registros = cursor.fetchone()[0]
    total_paginas = (total_registros + por_pagina - 1) // por_pagina

    base_sql += " ORDER BY id LIMIT %s OFFSET %s"
    valores.extend([por_pagina, offset])

    cursor.execute(base_sql, valores)
    colunas = [desc[0] for desc in cursor.description]
    registros = [dict(zip(colunas, linha)) for linha in cursor.fetchall()]
    conn.close()

    return jsonify({
        "dados": registros,
        "total_paginas": total_paginas
    })


@auth_bp.route("/menu/incluir")
@login_obrigatorio
def menu_incluir():
    return render_template("frm_menu_apoio.html")


@auth_bp.route("/menu/editar")
@login_obrigatorio
def menu_editar():
    return render_template("frm_menu_apoio.html")


@auth_bp.route("/menu/salvar", methods=["POST"])
@login_obrigatorio
def menu_salvar():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    dados = request.json

    try:
        if dados.get("id"):
            cursor.execute("""
                UPDATE tbl_menu
                SET nome_menu = %s, descricao = %s, rota = %s, data_page = %s, icone = %s,
                    link_detalhe = %s, tipo_abrir = %s, ordem = %s, parent_id = %s,
                    ativo = %s, local_menu = %s, valor = %s, obs = %s
                WHERE id = %s
            """, (
                dados["nome_menu"], dados["descricao"], dados["rota"], dados["data_page"], dados["icone"],
                dados["link_detalhe"], dados["tipo_abrir"], dados["ordem"], dados["parent_id"],
                dados["ativo"], dados["local_menu"], dados["valor"], dados["obs"], dados["id"]
            ))
        else:
            cursor.execute("""
                INSERT INTO tbl_menu (
                    nome_menu, descricao, rota, data_page, icone,
                    link_detalhe, tipo_abrir, ordem, parent_id,
                    ativo, local_menu, valor, obs
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                dados["nome_menu"], dados["descricao"], dados["rota"], dados["data_page"], dados["icone"],
                dados["link_detalhe"], dados["tipo_abrir"], dados["ordem"], dados["parent_id"],
                dados["ativo"], dados["local_menu"], dados["valor"], dados["obs"]
            ))
            dados["id"] = cursor.fetchone()[0]

        conn.commit()
        return jsonify({"status": "sucesso", "id": dados["id"]})
    except Exception as e:
        print("Erro ao salvar menu:", e)
        return jsonify({"erro": str(e)}), 500
    finally:
        conn.close()

# 🔎 Obter dados de um menu específico
@auth_bp.route("/menu/apoio/<int:id>", methods=["GET"])
def apoio_menu(id):
    try:
        conn = Var_ConectarBanco()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, nome_menu, descricao, rota, data_page, icone, link_detalhe,
                   tipo_abrir, ordem, parent_id, ativo, local_menu, valor, obs, assinatura_app
            FROM tbl_menu
            WHERE id = %s
        """, (id,))
        resultado = cursor.fetchone()

        if not resultado:
            return jsonify({"erro": "Menu não encontrado."}), 404

        colunas = [desc[0] for desc in cursor.description]
        menu = dict(zip(colunas, resultado))
        return jsonify(menu)

    except Exception as e:
        print("❌ Erro ao buscar menu:", e)
        return jsonify({"erro": "Erro ao carregar menu."}), 500

    finally:
        if conn:
            conn.close()


@auth_bp.route("/menu/delete", methods=["POST"])
@login_obrigatorio
def menu_delete():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    dados = request.json

    try:
        cursor.execute("DELETE FROM tbl_menu WHERE id = %s", (dados["id"],))
        conn.commit()
        return jsonify({"status": "sucesso", "mensagem": "Registro excluído com sucesso."})
    except Exception as e:
        print("Erro ao excluir menu:", e)
        return jsonify({"erro": str(e)}), 500
    finally:
        conn.close()
