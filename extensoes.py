import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import text

# 🔌 Instância global do SQLAlchemy
db = SQLAlchemy()

# 🔁 Função para criar o app Flask
def criar_app():
    # Carrega o .env
    env_path = Path(__file__).resolve().parent / ".env"
    load_dotenv(dotenv_path=env_path)

    # Inicializa o app Flask
    app = Flask(
        __name__,
        static_folder="static",
        static_url_path="/static",
        template_folder="templates"
    )

    app.config.update(
        SESSION_COOKIE_SAMESITE="Lax",  # ou "None" se usar HTTPS
        SESSION_COOKIE_SECURE=False     # True somente se usar HTTPS
    )

    # Configurações básicas do Flask
    app.secret_key = os.getenv("SECRET_KEY", os.urandom(24).hex())
    app.config["SESSION_COOKIE_NAME"] = os.getenv("SESSION_COOKIE_NAME", "rufino_session")

    # Configurações do banco de dados (PostgreSQL via SQLAlchemy)
    user = os.getenv("BANK_USER")
    password = os.getenv("BANK_KEY")
    host = os.getenv("BANK_HOST")
    port = os.getenv("BANK_PORT")
    dbname = os.getenv("BANK_NAME")

    app.config["SQLALCHEMY_DATABASE_URI"] = f"postgresql://{user}:{password}@{host}:{port}/{dbname}"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # Inicializa o banco com o app
    db.init_app(app)

    return app

# 🔗 Conexão manual ao banco usando SQLAlchemy (modo alternativo com engine)
def Var_ConectarBanco():
    from flask import current_app
    return db.engine.connect()


