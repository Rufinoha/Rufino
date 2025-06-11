from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
import requests
import os
from pathlib import Path
import sqlite3
import json

# Blueprint do WhatsApp
Var_RotaWhats = Blueprint("Var_RotaWhats", __name__)

# Função para conectar ao banco de dados
def Var_ConectarBanco():
    # Verifica se está rodando em produção (VPS)
    if os.getenv("MODO_PRODUCAO", "False") == "True":
        banco_path = Path("/srv/fleedguard/database/bd_fleedguard.db")
    else:
        banco_path = Path(__file__).resolve().parent / "database" / "bd_fleedguard.db"

    if not banco_path.exists():
        raise FileNotFoundError(f"Banco de dados não encontrado: {banco_path}")

    conn = sqlite3.connect(banco_path, timeout=10)
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


# Função auxiliar para carregar as configurações globais
def carregar_configuracoes():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    cursor.execute("SELECT chave, valor FROM tbl_config_global")
    configs = dict(cursor.fetchall())
    conn.close()
    return configs

# Rota: Enviar mensagem WhatsApp
@Var_RotaWhats.route("/whatsapp/enviar", methods=["POST"])
def enviar_mensagem_whatsapp():
    try:
        try:
            if request.is_json:
                dados = request.get_json()
            else:
                dados = json.loads(request.data)
        except Exception as e:
            return jsonify({"erro": f"Erro ao processar JSON: {str(e)}"}), 400

        id_ocorrencia = dados.get("id")
        if not id_ocorrencia:
            return jsonify({"erro": "ID da ocorrência é obrigatório."}), 400

        # Buscar dados da ocorrência
        conn = Var_ConectarBanco()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, placa, driver_nome, status
            FROM tbl_ontracker_telemetria
            WHERE id = ?
        """, (id_ocorrencia,))
        row = cursor.fetchone()
        if not row:
            return jsonify({"erro": "Ocorrência não encontrada."}), 404

        id_db, placa, driver_nome, status_atual = row

        if status_atual == "Cancelado":
            return jsonify({"erro": "Não é possível enviar mensagem para uma ocorrência cancelada."}), 400

        # Carregar configurações da Z-API
        configs = carregar_configuracoes()
        api_url = configs.get("whatsapp_api_url")
        numero_remetente = configs.get("whatsapp_remetente_numero")
        nome_remetente = configs.get("whatsapp_remetente_nome")

        # Montar mensagem
        mensagem = f"Olá {driver_nome}, identificamos um evento de telemetria na placa {placa}. Favor verificar. Atenciosamente, {nome_remetente}."

        # Número do motorista (exemplo, buscar do banco depois)
        numero_motorista = "5511993861460"

        # Enviar via Z-API
        payload = {
            "phone": numero_motorista,
            "message": mensagem
        }

        response = requests.post(f"{api_url}/send-text", json=payload)
        response.raise_for_status()

        # Atualizar status e prazo_retorno no banco
        novo_status = "Em Análise"
        prazo_retorno = (datetime.now() + timedelta(hours=24)).isoformat()
        cursor.execute("""
            UPDATE tbl_ontracker_telemetria
            SET status = ?, prazo_retorno = ?, datahora_importado = ?
            WHERE id = ?
        """, (novo_status, prazo_retorno, datetime.now().isoformat(), id_ocorrencia))

        # Gravar mensagem no tbl_ontracker_whatsapp
        cursor.execute("""
            INSERT INTO tbl_ontracker_whatsapp (id_ocorrencia, remetente, mensagem, datahora)
            VALUES (?, ?, ?, ?)
        """, (id_ocorrencia, nome_remetente, mensagem, datetime.now().isoformat()))

        conn.commit()
        conn.close()

        return jsonify({"status": "ok", "mensagem": "Mensagem enviada com sucesso.", "prazo_retorno": prazo_retorno}), 200

    except requests.exceptions.RequestException as e:
        return jsonify({"erro": f"Erro ao enviar mensagem via WhatsApp: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"erro": f"Erro ao processar requisição: {str(e)}"}), 500


# Rota: Buscar conversas vinculadas a uma ocorrência
@Var_RotaWhats.route("/whatsapp/conversas/<int:id_ocorrencia>", methods=["GET"])
def obter_conversas_ocorrencia(id_ocorrencia):
    try:
        conn = Var_ConectarBanco()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT remetente, mensagem, datahora
            FROM tbl_ontracker_whatsapp
            WHERE id_ocorrencia = ?
            ORDER BY datahora ASC
        """, (id_ocorrencia,))
        rows = cursor.fetchall()
        conn.close()

        conversas = [{"remetente": r[0], "mensagem": r[1], "datahora": r[2]} for r in rows]

        return jsonify({"status": "ok", "conversas": conversas}), 200

    except Exception as e:
        return jsonify({"erro": f"Erro ao buscar conversas: {str(e)}"}), 500
