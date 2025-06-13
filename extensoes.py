import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from datetime import timedelta
from pathlib import Path
from dotenv import load_dotenv

# 🔌 SQLAlchemy instanciado fora
db = SQLAlchemy()

def criar_app():
    # Carrega o .env
    env_path = Path(__file__).resolve().parent / ".env"
    load_dotenv(dotenv_path=env_path)

    # Inicializa o app
    app = Flask(
        __name__,
        static_folder="static",
        static_url_path="/static",
        template_folder="templates"
    )

    # 🔐 Configuração de sessão
    app.secret_key = os.getenv("SECRET_KEY", os.urandom(24).hex())
    app.config["SESSION_COOKIE_NAME"] = os.getenv("SESSION_COOKIE_NAME", "rufino_session")
    app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(minutes=30)

    # 🔧 Configuração do PostgreSQL
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("SQLALCHEMY_DATABASE_URI")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # Inicializa o banco
    db.init_app(app)

    # 🔁 Importa e registra Blueprints (aqui dentro para evitar import circular)
    from srotas import auth_bp
    from system.mod_despesas.srotas import despesas_bp
    from system.mod_licencas.srotas import licencas_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(despesas_bp, url_prefix="/despesas")
    app.register_blueprint(licencas_bp, url_prefix="/licencas")

    return app
