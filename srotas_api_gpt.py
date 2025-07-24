# Arquivo srotas_api_gpt.py

import os
import json
from openai import OpenAI
from flask import Blueprint, request, jsonify, session, current_app
from dotenv import load_dotenv
from global_utils import Var_ConectarBanco

# Carrega variáveis do .env
load_dotenv()

# Blueprint do módulo GPT
ap_gpt = Blueprint(
    'ap_gpt',
    __name__,
    template_folder='../templates',
    static_folder='../static',
    static_url_path='/static'
)

#--------------------------------------------------------------------
# Registra o blueprint do módulo GPT na aplicação Flask principal
#--------------------------------------------------------------------
def init_app(app):
    app.register_blueprint(ap_gpt)


#--------------------------------------------------------------------
# Carrega variáveis do ambiente e retorna o client da OpenAI,
# o modelo a ser utilizado e o modo (produção ou homologação)
#--------------------------------------------------------------------
def configurar_openai(modelo_config=None):
    modo_producao = os.getenv("MODO_PRODUCAO", "false").lower() == "true"
    openai_key = os.getenv("OPENAI_API_KEY")
    modelo_padrao = os.getenv("MODELO_GPT_PADRAO", "gpt-3.5-turbo")
    modelo_usado = modelo_config or modelo_padrao

    if not openai_key:
        raise ValueError("Chave da OpenAI não encontrada no ambiente")

    client = OpenAI(api_key=openai_key)
    return client, modelo_usado, modo_producao


#--------------------------------------------------------------------
# Limpa e prepara o texto extraído por OCR antes de enviar ao GPT
# Remove quebras de linha, múltiplos espaços e limita o tamanho
#--------------------------------------------------------------------
def limpar_ocr_para_gpt(texto_bruto: str, max_caracteres: int = 10000) -> str:
    if not texto_bruto:
        return ""

    linhas = texto_bruto.splitlines()
    linhas_limpas = [linha.strip() for linha in linhas if linha.strip()]
    texto_unificado = " ".join(linhas_limpas)
    texto_final = " ".join(texto_unificado.split())
    return texto_final[:max_caracteres]


#--------------------------------------------------------------------
# Usa a API da OpenAI para extrair campos relevantes de uma nota fiscal
# a partir do conteúdo bruto (OCR ou XML). Retorna os dados estruturados.
#--------------------------------------------------------------------
def extrair_dados_via_gpt(conteudo_extraido, tipo_arquivo="xml", modelo_config="gpt-3.5-turbo"):
    conteudo_extraido = str(conteudo_extraido or "").strip()
    conteudo_extraido = limpar_ocr_para_gpt(conteudo_extraido)
    
    print("📄 Texto limpo enviado ao GPT:")
    print(conteudo_extraido)




    try:
        client, modelo_usado, _ = configurar_openai(modelo_config)
    except Exception as e:
        return {
            "status": "erro",
            "mensagem": str(e),
            "origem": "GPT"
        }




    prompt = f"""
        Você é um especialista em leitura de notas fiscais e comprovantes brasileiros, com foco em extração de dados do EMITENTE.

        ⚠️ INSTRUÇÕES IMPORTANTES:
        - Sempre extraia os dados do **EMITENTE** da nota (quem emitiu), e **NUNCA** do destinatário, transportador ou pagador.
        - Ignore dados de quem recebeu a nota, pagou, comprou ou transportou.
        - Se houver mais de um CNPJ ou nome, escolha o que estiver rotulado como **EMITENTE** (ou próximo de termos como "emitente", "fornecedor", "empresa emitente", "emitido por").
        - Utilize o CNPJ e razão social mais próximos da parte superior da nota quando houver dúvida.
        - Use a data mais próxima do título ou identificador da nota como `data_emissao`.

        🎯 Objetivo:
        Com base no conteúdo bruto abaixo, extraia os seguintes campos:

        - **cnpj_emitente** → CNPJ da empresa emitente
        - **razao_social** → Nome/Razão social do emitente
        - **valor_total** → Valor total da nota ou cupom (preferencialmente após “TOTAL”, “TOTAL R$”, “VALOR TOTAL DA NOTA”)
        - **data_emissao** → Data de emissão da nota ou comprovante (padrão ISO: YYYY-MM-DD)
        - **numero_nota** → Número da nota, DANFE, NFC-e ou extrato (não é o número do pedido ou SAT)

        📦 Retorne o resultado em formato JSON com os nomes dos campos **exatamente** em snake_case.

        🔍 Conteúdo bruto da nota fiscal:
        '''{conteudo_extraido}'''
        """


    
    print("📄 Prompt enviado ao GPT:")
    print(prompt)

    try:
        resposta = client.chat.completions.create(
            model=modelo_usado,
            messages=[
                {"role": "system", "content": "Você é um especialista em leitura de notas fiscais brasileiras."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            max_tokens=500
        )
        conteudo_gpt = resposta.choices[0].message.content
        print("🧠 Resposta bruta do GPT:\n", conteudo_gpt)

        conteudo_gpt = conteudo_gpt.strip().strip("`")
        if conteudo_gpt.lower().startswith("json"):
            conteudo_gpt = conteudo_gpt[4:].strip()

        dados_json = json.loads(conteudo_gpt)

        return {
            "cnpj_emitente": dados_json.get("cnpj_emitente") or dados_json.get("cnpj_do_emitente", ""),
            "razao_social_emitente": dados_json.get("razao_social", ""),
            "valor": dados_json.get("valor_total", ""),
            "data": dados_json.get("data_emissao") or dados_json.get("data_de_emissao", ""),
            "documento": dados_json.get("numero_nota") or dados_json.get("numero_da_nota", ""),
            "tipo_documento": "Cupom",
            "chave_nfe": "",
            "status": "ok",
            "origem": "GPT"
        }

    except json.JSONDecodeError:
        current_app.logger.error("⚠️ GPT retornou JSON inválido")
        return {
            "status": "erro",
            "mensagem": "Retorno do GPT inválido",
            "origem": "GPT",
            "resposta_bruta": conteudo_gpt
        }
    except Exception as e:
        current_app.logger.error(f"❌ Erro ao consultar GPT ({modelo_usado}): {e}")
        current_app.logger.debug(f"Prompt usado:\n{prompt}")
        return {
            "status": "erro",
            "mensagem": str(e),
            "origem": "GPT"
        }


#--------------------------------------------------------------------
# Consulta a tabela tbl_config e retorna as configurações relacionadas
# ao uso de GPT para uma empresa específica (id_empresa)
#--------------------------------------------------------------------
def buscar_config_gpt(id_empresa):
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT chave, valor
            FROM tbl_config
            WHERE id_empresa = %s
              AND chave IN ('usar_extracao_gpt', 'modelo_gpt_utilizado')
        """, (id_empresa,))
        resultados = cursor.fetchall()
        config = {linha[0]: linha[1] for linha in resultados}
        return {
            "usar_extracao_gpt": config.get("usar_extracao_gpt", "false").lower() == "true",
            "modelo_gpt_utilizado": config.get("modelo_gpt_utilizado", "gpt-3.5")
        }
    except Exception as e:
        current_app.logger.error(f"Erro ao buscar configurações GPT: {e}")
        return {
            "usar_extracao_gpt": False,
            "modelo_gpt_utilizado": "gpt-3.5"
        }
    finally:
        cursor.close()
        conn.close()
