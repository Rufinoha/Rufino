from extensoes import criar_app

# Cria o app
app = criar_app()

# ▶️ Executa o servidor
if __name__ == "__main__":
    import os
    modo_producao = os.getenv("MODO_PRODUCAO", "False").lower() == "true"
    porta = int(os.getenv("PORTA", 5000))

    if modo_producao:
        app.run(host="0.0.0.0", port=porta, debug=False)
    else:
        app.run(debug=True, use_reloader=False)
