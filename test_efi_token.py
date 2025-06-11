# ───────────────────────────────────────────────────
# 🔐 Teste de Autenticação - API Pix (Homologação)
# ───────────────────────────────────────────────────

from dotenv import load_dotenv
import os
import requests

# ✅ Carrega as variáveis do .env da pasta atual
load_dotenv()

# 🧪 Define ambiente: estamos testando a homologação
modo_producao = False

# 🔍 Seleciona variáveis do ambiente correto
api_url = os.getenv("EFI_API_URL") if modo_producao else os.getenv("EFI_API_URL_HOM")
client_id = os.getenv("EFI_CLIENT_ID") if modo_producao else os.getenv("EFI_CLIENT_ID_HOM")
client_secret = os.getenv("EFI_CLIENT_SECRET") if modo_producao else os.getenv("EFI_CLIENT_SECRET_HOM")
certificado = os.getenv("EFI_CERTIFICADO_PEM") if modo_producao else os.getenv("EFI_CERTIFICADO_PEM_HOM")

# 🔎 Mostra o que será usado
print("🌐 URL:", api_url)
print("🔐 client_id:", repr(client_id))
print("🔐 client_secret:", repr(client_secret))
print("📄 certificado PEM:", certificado)

# 🚀 Faz a requisição de token
try:
    response = requests.post(
        f"{api_url}/oauth/token",
        auth=(client_id, client_secret),
        headers={"Content-Type": "application/json"},
        json={"grant_type": "client_credentials"},
        cert=certificado
    )

    print("📥 Status Code:", response.status_code)
    print("📨 Resposta da API:")
    print(response.text)

except Exception as e:
    print("❌ Erro ao tentar autenticar:")
    print(str(e))
