from extensoes import criar_app
from srotas import init_app as auth_init
from srotas_api_email_brevo import init_app as brevo_init
from srotas_api_efi import init_app as efi_init

app = criar_app()

# Registra todos os blueprints
auth_init(app)
brevo_init(app)
efi_init(app)

if __name__ == "__main__":
    import os
    modo_producao = os.getenv("MODO_PRODUCAO", "False").lower() == "true"
    porta = int(os.getenv("PORTA", 5000))
    app.run(host="0.0.0.0" if modo_producao else "127.0.0.1", port=porta, debug=not modo_producao, use_reloader=False)
