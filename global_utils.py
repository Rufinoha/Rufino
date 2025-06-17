import re
from datetime import datetime
import locale
from extensoes import db








# Remove tags HTML
def remover_tags_html(texto):
    """Remove qualquer tag HTML da string"""
    return re.sub('<[^<]+?>', '', texto or "")

# Converte data ISO para formato brasileiro DD/MM/AAAA
def formata_data_brasileira(data_iso):
    """Converte data ISO para formato DD/MM/AAAA"""
    if not data_iso:
        return "-"
    try:
        dt = datetime.fromisoformat(data_iso.replace("Z", "+00:00"))
        return dt.strftime("%d/%m/%Y")
    except Exception:
        return data_iso

# 💰 Formata valor como moeda brasileira (R$)
def formata_moeda(valor):
    """Formata número como moeda brasileira"""
    try:
        locale.setlocale(locale.LC_ALL, 'pt_BR.UTF-8')
        return locale.currency(valor, grouping=True)
    except Exception:
        return f"R$ {valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

# 📧 Valida e-mail com regex básica
def valida_email(email):
    """Valida se o e-mail tem formato básico correto"""
    if not email:
        return False
    padrao = r'^[\w\.-]+@[\w\.-]+\.\w+$'
    return re.match(padrao, email) is not None
