import os
import time
from flask import Flask
from dotenv import load_dotenv
from datetime import timedelta
from pathlib import Path
from srotas import auth_bp
from system.mod_despesas.srotas import despesas_bp
from system.mod_licencas.srotas import licencas_bp



# Carrega variáveis do .env
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)









# Inicializa a aplicação Flask
app = Flask(
    __name__,
    static_folder="static",           # Pasta global de CSS/JS
    static_url_path="/static",        # URL pública para acessar
    template_folder="templates"       # HTML globais (login, home, index)
)

# Configuração da sessão
app.secret_key = os.getenv("SECRET_KEY", os.urandom(24).hex())
app.config["SESSION_COOKIE_NAME"] = "rufino_session"
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(minutes=30)


# 📍 Rotas unificadas no Srotas.py (auth_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(despesas_bp, url_prefix='/despesas')
app.register_blueprint(licencas_bp, url_prefix='/licencas')

# Executa o servidor
if __name__ == "__main__":
    os.environ["PYTHONUNBUFFERED"] = "1"
    modo_producao = os.getenv("MODO_PRODUCAO", "False").lower() == "true"
    porta = int(os.getenv("PORTA", 5000))

    if modo_producao:
        app.run(host="0.0.0.0", port=porta, debug=False)
    else:
        app.run(debug=True, use_reloader=False)
