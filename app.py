import os
from srotas import init_app as auth_init
from srotas_api_email_brevo import init_app as brevo_init
from srotas_api_efi import init_app as efi_init
from global_utils import init_app as global_init
from srotas_api_ocr import init_app as ap_ocr_init
from srotas_api_gpt import init_app as ap_gpt_init
from system.mod_reembolso.reem_srotas import init_app as mod_reembolso_init
from system.mod_reembolso.reem_global_util import init_app as reem_global_init
from system.mod_hub.hub_srotas import init_app as mod_hub_bp_init
from flask import Flask
from dotenv import load_dotenv
load_dotenv()




app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "rufino_chave_secreta_default")
app.config["SESSION_COOKIE_NAME"] = os.getenv("SESSION_COOKIE_NAME", "rufino_session")

# Registra todos os blueprints
auth_init(app)
brevo_init(app)
efi_init(app)
global_init(app)
mod_reembolso_init(app)
reem_global_init(app)
ap_ocr_init(app)
ap_gpt_init(app)
mod_hub_bp_init(app)


if __name__ == "__main__":
    modo_producao = os.getenv("MODO_PRODUCAO", "false").lower() == "true"
    porta = int(os.getenv("PORTA", 5000))
    app.run(
        host="0.0.0.0" if modo_producao else "127.0.0.1",
        port=porta,
        debug=not modo_producao,
        use_reloader=False
    )

