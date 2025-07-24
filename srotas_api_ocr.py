#arquivo srotas_api_ocr.py

import os
import re
import xml.etree.ElementTree as ET
import pytesseract
import requests
import tempfile
from global_utils import Var_ConectarBanco
from flask import Blueprint, request, jsonify, session
from werkzeug.utils import secure_filename
from datetime import datetime
from dotenv import load_dotenv
from xml.etree import ElementTree as ET
from pdf2image import convert_from_path
from PIL import Image
from srotas_api_gpt import extrair_dados_via_gpt, limpar_ocr_para_gpt, buscar_config_gpt





load_dotenv()

# para funcionamento da OCR
MODO_PRODUCAO = os.getenv("MODO_PRODUCAO", "false").lower() == "true"
if MODO_PRODUCAO:
    endereco_tesseract = os.getenv("OCR_ENDERECO_TESSERACT", "/usr/bin/tesseract")
else:
    endereco_tesseract = os.getenv("OCR_ENDERECO_TESSERACT_HOM", r"C:\Program Files\Tesseract-OCR\tesseract.exe")

pytesseract.pytesseract.tesseract_cmd = endereco_tesseract


ap_ocr = Blueprint(
    'ap_ocr',
    __name__,
    template_folder='../templates',
    static_folder='../static',
    static_url_path='/static'
)

def init_app(app):
    app.register_blueprint(ap_ocr)




# Configuração Tesseract via .env
# 🔧 Caminhos OCR
MODO_PRODUCAO = os.getenv("MODO_PRODUCAO", "false").lower() == "true"
CAMINHO_TESSERACT = os.getenv("OCR_ENDERECO_TESSERACT" if MODO_PRODUCAO else "OCR_ENDERECO_TESSERACT_HOM")
CAMINHO_POPPLER = os.getenv("OCR_ENDERECO_POPPLER" if MODO_PRODUCAO else "OCR_ENDERECO_POPPLER_HOM")

# ✅ Aponta para o Tesseract
pytesseract.pytesseract.tesseract_cmd = CAMINHO_TESSERACT


@ap_ocr.route("/api/ocr/lernota", methods=["POST"])
def ocr_ler_nota():
    try:
        if "anexo" not in request.files:
            return jsonify({"erro": "Arquivo não enviado"}), 400

        anexo = request.files["anexo"]
        nome_original = secure_filename(anexo.filename)
        ext = nome_original.split(".")[-1].lower()
        tipo_arquivo = "imagem" if ext in ["jpg", "jpeg", "png"] else "pdf" if ext == "pdf" else ext

        # 🔒 ID da empresa (obrigatório)
        id_empresa = request.form.get("id_empresa") or request.args.get("id_empresa")
        if not id_empresa:
            return jsonify({"erro": "ID da empresa não informado"}), 400

        # 📁 Pasta específica por empresa
        pasta_empresa = os.path.join("system", "mod_despesas", "static", "uploadnf", f"notas{id_empresa}")
        os.makedirs(pasta_empresa, exist_ok=True)

        # 🕓 Nome padronizado
        agora = datetime.now().strftime("%Y%m%dT%H%M%S")
        nome_final = f"nota_{id_empresa}_{agora}.{ext}"
        caminho_final = os.path.join(pasta_empresa, nome_final)

        # 💾 Salva o anexo
        anexo.save(caminho_final)

        # 🔠 Extrai o texto
        texto_extraido = extrair_texto_ocr(caminho_final, ext)
        conteudo_limpo = limpar_ocr_para_gpt(texto_extraido)

        # ⚙️ Busca config GPT da empresa
        config_gpt = buscar_config_gpt(id_empresa)
        usar_gpt = config_gpt.get("usar_extracao_gpt", False)
        modelo = config_gpt.get("modelo_gpt_utilizado", "gpt-3.5-turbo")

        resultado = {
            "razao_social_emitente": None,
            "cnpj_emitente": None,
            "valor": None,
            "data": None,
            "documento": None,
            "chave_nfe": None,
            "tipo_documento": tipo_arquivo.upper(),
            "origem_preenchimento": "automatico",
            "nome_arquivo": nome_final
        }

        if usar_gpt:
            dados_gpt = extrair_dados_via_gpt(conteudo_limpo, tipo_arquivo=tipo_arquivo, modelo_config=modelo)

            return jsonify({
                "sucesso": True,
                "dados": dados_gpt
            })

        # se não usar GPT
        return jsonify(resultado)


    except Exception as e:
        print("❌ Erro OCR:", e)
        return jsonify({"erro": f"Erro ao processar arquivo: {str(e)}"}), 500



# === 🟡 LEITURA DE XML ===
def ler_xml(file):
    try:
        tree = ET.parse(file)
        root = tree.getroot()
        ns = {"nfe": root.tag.split("}")[0].strip("{")}

        emit = root.find(".//nfe:emit", ns)
        total = root.find(".//nfe:ICMSTot", ns)
        ide = root.find(".//nfe:ide", ns)
        numero_nota = ide.findtext("nfe:nNF", default="", namespaces=ns)
        infNFe = root.find(".//nfe:infNFe", ns)

        dados = {
            "cnpj_emitente": emit.findtext("nfe:CNPJ", default="", namespaces=ns),
            "razao_social_emitente": emit.findtext("nfe:xNome", default="", namespaces=ns),
            "valor": total.findtext("nfe:vNF", default="", namespaces=ns),
            "data": ide.findtext("nfe:dhEmi", default="", namespaces=ns)[:10],
            "chave_nfe": infNFe.attrib.get("Id", "")[-44:],
            "tipo_documento": "NFe",
            "documento": numero_nota,

        }

        return jsonify({"sucesso": True, "dados": dados})
    except Exception as e:
        print("❌ Erro XML:", e)
        return jsonify({"erro": "Falha ao interpretar XML"}), 500


# === 🔵 LEITURA DE PDF/IMG VIA OCR ===
def ler_imagem_ou_pdf(file, ext):
    try:
        temp_filename = f"temp_{datetime.now().timestamp()}.{ext}"
        temp_path = os.path.join("system", "mod_despesas", "static", "uploadnf", temp_filename)
        file.save(temp_path)

        # PDF → imagem
        if ext == "pdf":
            pages = convert_from_path(temp_path, dpi=300, poppler_path=CAMINHO_POPPLER)
            imagem = pages[0]
        else:
            imagem = Image.open(temp_path)

        texto = pytesseract.image_to_string(imagem)

        dados = {
            "cnpj_emitente": extrair_cnpj(texto),
            "razao_social_emitente": extrair_razao_social(texto),
            "valor": extrair_valor(texto),
            "data": extrair_data(texto),
            "chave_nfe": extrair_chave(texto),
            "tipo_documento": "Cupom/Imagem",
            "documento": extrair_numero_documento(texto),

        }

        return jsonify({"sucesso": True, "dados": dados})
    except Exception as e:
        print("❌ Erro OCR:", e)
        return jsonify({"erro": "Falha ao interpretar imagem ou PDF"}), 500


# === Funções auxiliares OCR ===
def extrair_cnpj(txt):
    linhas = txt.splitlines()
    for i, linha in enumerate(linhas):
        if "CNPJ" in linha.upper():
            # tenta capturar CNPJ na mesma linha
            match = re.search(r"\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}", linha)
            if match:
                return match.group().replace(".", "").replace("/", "").replace("-", "")
            
            # senão, tenta na próxima linha
            if i + 1 < len(linhas):
                proxima = linhas[i + 1]
                match2 = re.search(r"\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}", proxima)
                if match2:
                    return match2.group().replace(".", "").replace("/", "").replace("-", "")
    return ""


def extrair_razao_social(txt):
    linhas = txt.splitlines()
    for linha in linhas:
        if "LTDA" in linha.upper() or "ME" in linha.upper():
            return linha.strip()
    return ""

def extrair_valor(txt):
    match = re.search(r"(R\$|VALOR\s*TOTAL)?\s*[\$]?\s*(\d{1,3}(?:[\.,]\d{3})*[\.,]\d{2})", txt, re.IGNORECASE)
    return match.group(2).replace(".", "").replace(",", ".") if match else ""

def extrair_data(txt):
    match = re.search(r"\d{2}[/\-\.]\d{2}[/\-\.]\d{4}", txt)
    if match:
        try:
            return datetime.strptime(match.group(), "%d/%m/%Y").date().isoformat()
        except:
            return ""
    return ""


def extrair_chave(txt):
    match = re.search(r"(chave\s*(de)?\s*acesso)?\s*(\d{44})", txt, re.IGNORECASE)
    return match.group(3) if match else ""


def extrair_numero_documento(txt):
    match = re.search(r"(NF(?:E)?|Nota\s*Fiscal|N[oºº]?)\s*[:\-]?\s*(\d{3,10})", txt, re.IGNORECASE)
    return match.group(2) if match else ""





# Função central para avaliar qualidade da extração OCR/XML
def avaliar_extracao(campos_dict: dict, tipo_arquivo: str, nome_arquivo: str, id_empresa: int, id_lancamento: int = None):
    from datetime import datetime
    import psycopg2
    from global_utils import Var_ConectarBanco

    # Lista dos campos considerados para a avaliação
    campos_alvo = ["data", "valor", "cnpj", "razao_social", "tipo_documento", "chave"]
    campos_preenchidos = [campo for campo in campos_alvo if campos_dict.get(campo)]
    quantidade = len(campos_preenchidos)
    percentual = round((quantidade / len(campos_alvo)) * 100, 2)

    # Determina o aviso ao usuário
    if quantidade == 6:
        mensagem = "Extraímos 100% dos dados da nota com sucesso!"
        tipo_aviso = "success"
    elif quantidade > 0:
        mensagem = "Conseguimos extrair parte das informações da nota, favor verificar."
        tipo_aviso = "warning"
    else:
        mensagem = "Não foi possível extrair as informações da nota. Preencha manualmente."
        tipo_aviso = "error"

    # Registra no log de OCR
    try:
        conn = Var_ConectarBanco()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO tbl_desp_ocrlog (
                id_empresa, id_lancamento, tipo_arquivo, nome_arquivo,
                campos_extraidos, percentual_extraido, data_leitura
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            id_empresa,
            id_lancamento,
            tipo_arquivo,
            nome_arquivo,
            quantidade,
            percentual,
            datetime.now()
        ))

        conn.commit()
        cursor.close()
        conn.close()
    except Exception as e:
        print("Erro ao registrar OCR log:", str(e))

    # Retorno final para uso no frontend ou salvamento
    return {
        "campos_extraidos": quantidade,
        "percentual_extraido": percentual,
        "origem_leitura": tipo_arquivo,
        "mensagem": mensagem,
        "tipo_aviso": tipo_aviso
    }



# verificar_ou_criar_empresa(cnpj, id_empresa)
def verificar_ou_criar_empresa(cnpj: str, id_empresa: int, id_categoria: int = None):
    from global_utils import Var_ConectarBanco
    import requests

    if not cnpj or len(cnpj) != 14:
        return {"status": "erro", "mensagem": "CNPJ inválido"}

    try:
        conn = Var_ConectarBanco()
        cur = conn.cursor()

        cur.execute("SELECT id FROM tbl_empresa WHERE cnpj = %s", (cnpj,))
        empresa_existe = cur.fetchone()

        if empresa_existe:
            cur.close()
            conn.close()
            return {"status": "ok", "mensagem": "Empresa já cadastrada"}

        # Consulta Receita
        r = requests.get(f"https://publica.cnpj.ws/cnpj/{cnpj}", timeout=10)
        if r.status_code != 200:
            return {"status": "erro", "mensagem": "Falha ao consultar CNPJ"}

        dados = r.json()
        est = dados.get("estabelecimento", {})
        cidade = est.get("cidade", {}).get("nome", "")
        uf = est.get("estado", {}).get("sigla", "")
        nome_fantasia = dados.get("nome_fantasia", "")
        razao_social = dados.get("razao_social", "")
        email = est.get("email", "")
        telefone = est.get("telefone1", "")

        # Cadastra na tbl_empresa
        cur.execute("""
            INSERT INTO tbl_empresa (cnpj, nome, nome_empresa, email, telefone, cidade, uf)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (cnpj, nome_fantasia, razao_social, email, telefone, cidade, uf))

        # Cadastra também na tbl_hub_favorecido (opcional)
        if id_categoria:
            cur.execute("""
                INSERT INTO tbl_hub_favorecido (id_empresa, documento, razao_social, cidade, uf, categoria, status)
                VALUES (%s, %s, %s, %s, %s, %s, true)
            """, (
                id_empresa, cnpj, razao_social, cidade, uf, id_categoria
            ))

        conn.commit()
        cur.close()
        conn.close()
        return {"status": "novo", "mensagem": "Empresa e favorecido criados com sucesso"}

    except Exception as e:
        print("❌ Erro ao criar empresa:", str(e))
        return {"status": "erro", "mensagem": "Erro inesperado ao criar empresa"}





def extrair_texto_ocr(caminho, ext):
    """
    Usa pytesseract para extrair texto de um arquivo PDF ou imagem.
    """
    if ext == "pdf":
        paginas = convert_from_path(caminho, dpi=300, poppler_path=CAMINHO_POPPLER)
        imagem = paginas[0]
    else:
        imagem = Image.open(caminho)

    texto_extraido = pytesseract.image_to_string(imagem)

    # Logs úteis para debug
    print("📄 Texto extraído OCR (parcial):", texto_extraido[:1000].replace("\n", " "))
    
    return texto_extraido
