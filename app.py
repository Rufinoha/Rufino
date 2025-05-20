from flask import Flask
from dotenv import load_dotenv
from datetime import timedelta
from pathlib import Path

from app.auth.srotas import auth_bp
from app.home.srotas import home_bp
from app.main.srotas import main_bp
from system.mod_despesas.srotas import despesas_bp
from system.mod_licencas.srotas import licencas_bp

import os
import time

# Carrega variáveis do .env
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

# Configura o timezone
if os.getenv("MODO_PRODUCAO", "False") == "True":
    os.environ['TZ'] = 'America/Sao_Paulo'
    time.tzset()
else:
    print("Modo de desenvolvimento: Timezone não configurado.")

# Inicializa a aplicação Flask
app = Flask(
    __name__,
    static_folder="static",
    static_url_path="/static"
)



# Configuração da sessão
app.secret_key = os.getenv("SECRET_KEY", os.urandom(24).hex())
app.config["SESSION_COOKIE_NAME"] = "rufino_session"
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(minutes=30)

# Carrega variáveis do SMTP
if os.getenv("SMTP_SENHA"):
    print("✅ Senha SMTP carregada com sucesso!")
else:
    print("❌ ERRO: Variável SMTP_SENHA não encontrada!")

# Registro dos Blueprints
app.register_blueprint(auth_bp, url_prefix='/auth')
app.register_blueprint(home_bp, url_prefix='/')
app.register_blueprint(main_bp, url_prefix='/main')
app.register_blueprint(despesas_bp, url_prefix='/despesas')
app.register_blueprint(licencas_bp, url_prefix='/licencas')

# Executa o servidor
if __name__ == "__main__":
    os.environ["PYTHONUNBUFFERED"] = "1"
    modo_producao = os.getenv("MODO_PRODUCAO", "False") == "True"
    porta = int(os.getenv("PORTA", 5000))

    if modo_producao:
        app.run(host="0.0.0.0", port=porta, debug=False)
    else:
        app.run(debug=True, use_reloader=False)
