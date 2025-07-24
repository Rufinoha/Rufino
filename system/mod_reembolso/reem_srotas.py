# reem_srotas.py
from flask import Blueprint, render_template, session, redirect, url_for, jsonify, request, current_app
from functools import wraps
from global_utils import Var_ConectarBanco, login_obrigatorio
import os
import tempfile
import requests
from werkzeug.utils import secure_filename
from srotas_api_ocr import verificar_ou_criar_empresa, ler_xml
from datetime import datetime
from srotas_api_gpt import extrair_dados_via_gpt, buscar_config_gpt


mod_reembolso = Blueprint(
    'mod_reembolso',
    __name__,
    template_folder='templates',
    static_folder='static',
    static_url_path='/static/reembolso'
)

def init_app(app):
    app.register_blueprint(mod_reembolso)




# ────────────────────────────────────────────────────────────────────────────
# ROTA GENÉRICA PARA CARREGAMENTO DE PÁGINAS DO MÓDULO HUB
# ────────────────────────────────────────────────────────────────────────────
@mod_reembolso.route('/abrir_pagina/mod_reembolso/<pagina>')
@login_obrigatorio
def abrir_pagina_mod_hub(pagina):
    try:
        return render_template(f"frm_{pagina}.html")
    except Exception as e:
        print(f"[ERRO] Falha ao abrir página mod_hub/{pagina}: {str(e)}")
        return f"Erro ao abrir página: {str(e)}", 500



# Rota para carregar resumo do dashboard
@mod_reembolso.route("/reembolso/dashboard/resumo")
@login_obrigatorio
def resumo_dashboard():
    id_empresa = session.get("id_empresa")
    conn = Var_ConectarBanco()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT
                COALESCE(SUM(valor_total), 0) AS total_mes,
                (SELECT COUNT(*) FROM tbl_reem_lancamento WHERE id_empresa = %s AND status = 'RETORNADA') AS retornadas,
                (SELECT COUNT(*) FROM tbl_reem_lancamento WHERE id_empresa = %s AND EXTRACT(MONTH FROM data) = EXTRACT(MONTH FROM CURRENT_DATE)) AS total_enviadas
            FROM tbl_reem_lancamento
            WHERE id_empresa = %s
            AND EXTRACT(MONTH FROM data) = EXTRACT(MONTH FROM CURRENT_DATE)
        """, (id_empresa, id_empresa, id_empresa))

        total_mes, retornadas, total_enviadas = cur.fetchone()

        cur.execute("SELECT COALESCE(valor_atual, 0) FROM tbl_caixinha_empresa WHERE id_empresa = %s LIMIT 1", (id_empresa,))
        saldo_caixinha = cur.fetchone()

        return {
            "total_mes": float(total_mes),
            "retornadas": retornadas,
            "total_enviadas": total_enviadas,
            "pendentes": retornadas,
            "saldo_caixinha": float(saldo_caixinha[0]) if saldo_caixinha else 0.00
        }
    except Exception as e:
        print("Erro no dashboard:", e)
        return {"erro": "Erro ao carregar dashboard"}
    finally:
        cur.close()
        conn.close()





# =====================================================================
# ==================== ROTA DE DADOS PARA LISTAGEM ====================
# =====================================================================
@mod_reembolso.route("/reembolso/dados")
@login_obrigatorio
def reembolso_dados():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()

    id_empresa = session.get("id_empresa")
    id_usuario = session.get("id_usuario")
    grupo = session.get("grupo", "user").lower()

    pagina = int(request.args.get("pagina", 1))
    por_pagina = int(request.args.get("porPagina", 20))
    offset = (pagina - 1) * por_pagina

    descricao = request.args.get("descricao", "").strip()
    data = request.args.get("data")
    status = request.args.get("status", "").split(",")
    somente_minhas = request.args.get("somente_minhas", "true") == "true"

    # SQL base
    sql = """
        SELECT d.id_reembolso, d.data, d.descricao, d.valor_total, d.status,
            (SELECT COUNT(*) FROM tbl_reem_lancamento_item i WHERE i.id_reembolso = d.id_reembolso) as qtd_itens
        FROM tbl_reem_lancamento d
        WHERE d.id_empresa = %s
    """
    valores = [id_empresa]

    # Filtros dinâmicos
    if descricao:
        sql += " AND d.descricao ILIKE %s"
        valores.append(f"%{descricao}%")

    if data:
        sql += " AND d.data = %s"
        valores.append(data)

    if status and status != ['']:
        sql += " AND d.status = ANY(%s)"
        valores.append(status)

    if somente_minhas or grupo != "admin":
        sql += " AND d.criado_por = %s"
        valores.append(id_usuario)

    # Total de registros com filtros aplicados
    sql_total = f"SELECT COUNT(*) FROM ({sql}) AS sub"
    cursor.execute(sql_total, valores)
    total_registros = cursor.fetchone()[0]
    total_paginas = (total_registros + por_pagina - 1) // por_pagina

    # Adiciona paginação
    sql += " ORDER BY d.data DESC LIMIT %s OFFSET %s"
    valores.extend([por_pagina, offset])

    cursor.execute(sql, valores)
    colunas = [desc[0] for desc in cursor.description]
    registros = [dict(zip(colunas, linha)) for linha in cursor.fetchall()]

    cursor.close()
    conn.close()

    return jsonify({
        "dados": registros,
        "total_paginas": total_paginas
    })


@mod_reembolso.route("/reembolso/incluir")
@login_obrigatorio
def reembolso_incluir():
    return render_template("frm_reem_lancamentos_apoio.html")




@mod_reembolso.route("/reembolso/editar")
@login_obrigatorio
def reembolso_editar():
    return render_template("frm_reem_lancamentos_apoio.html")



@mod_reembolso.route("/reembolso/salvar", methods=["POST"])
@login_obrigatorio
def reembolso_salvar():
    dados = request.json
    id_empresa = session.get("id_empresa")
    id_usuario = session.get("id_usuario")

    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    try:
        if dados.get("id"):
            cursor.execute("""
                UPDATE tbl_reem_lancamento
                SET descricao = %s,
                    data = %s,
                    id_adiantamento = %s,
                    obs = %s,
                    valor_total = %s
                WHERE id_reembolso = %s AND id_empresa = %s
            """, (
                dados["descricao"],
                dados["data"],
                dados.get("id_adiantamento"),
                dados.get("obs"),
                dados.get("valor_total", 0),
                dados["id"],
                id_empresa
            ))
        else:
            cursor.execute("""
                INSERT INTO tbl_reem_lancamento
                (id_empresa, descricao, data, id_adiantamento, obs, status, criado_por, valor_total)
                VALUES (%s, %s, %s, %s, %s, 'Pendente', %s, %s)
                RETURNING id_reembolso
            """, (
                id_empresa,
                dados["descricao"],
                dados["data"],
                dados.get("id_adiantamento"),
                dados.get("obs"),
                id_usuario,
                dados.get("valor_total", 0)
            ))
            dados["id"] = cursor.fetchone()[0]


        conn.commit()
        return jsonify({"mensagem": "reembolso salva com sucesso!", "id": dados["id"]})

    except Exception as e:
        conn.rollback()
        return jsonify({"erro": f"Erro ao salvar: {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()


@mod_reembolso.route("/reembolso/apoio/<int:id>")
@login_obrigatorio
def apoio_reembolso(id):
    """Carrega os dados do reembolso para edição no apoio"""
    id_empresa = session.get("id_empresa")
    conn = Var_ConectarBanco()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT 
                id_reembolso,
                descricao,
                data,
                id_adiantamento,
                obs,
                valor_total,
                criado_em,
                status    
            FROM tbl_reem_lancamento
            WHERE id_reembolso = %s AND id_empresa = %s
        """, (id, id_empresa))

        dados = cursor.fetchone()

        if not dados:
            return jsonify({"erro": "Reembolso não encontrado."}), 404

        colunas = [desc[0] for desc in cursor.description]
        resultado = dict(zip(colunas, dados))

        return jsonify(resultado)

    except Exception as e:
        print("❌ ERRO AO CARREGAR REEMBOLSO:", str(e))
        return jsonify({"erro": "Erro interno ao buscar reembolso."}), 500

    finally:
        cursor.close()
        conn.close()





@mod_reembolso.route("/reembolso/delete", methods=["POST"])
@login_obrigatorio
def reembolso_delete():
    dados = request.json
    id_empresa = session.get("id_empresa")
    try:
        conn = Var_ConectarBanco()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM tbl_reem_lancamento WHERE id_reembolso = %s AND id_empresa = %s",(dados["id"], id_empresa))
        conn.commit()
        return jsonify({"status": "sucesso", "mensagem": "reembolso excluída com sucesso."})
    except Exception as e:
        return jsonify({"erro": str(e)}), 500



# --------------------------------------------------
# reembolso itens
# --------------------------------------------------
@mod_reembolso.route("/reembolso/item/dados")
def dados_itens():
    id_reembolso = request.args.get("id_reembolso")
    id_empresa = session.get("id_empresa")

    conn = Var_ConectarBanco()
    cur = conn.cursor()

    cur.execute("""
        SELECT 
            i.id, i.data, i.descricao, i.valor, i.documento,
            ld.nome_exibicao AS forma_pgto, 
            i.razao_social_emitente,
            (SELECT nome_categoria FROM tbl_hub_categoria WHERE id = i.id_categoria) AS categoria
        FROM tbl_reem_lancamento_item i
        LEFT JOIN tbl_hub_livro_diario ld 
            ON ld.id = i.forma_pagamento::INTEGER AND ld.id_empresa = i.id_empresa
        WHERE i.id_reembolso = %s AND i.id_empresa = %s
        ORDER BY i.data DESC
    """, (id_reembolso, id_empresa))

    colunas = [desc[0] for desc in cur.description]
    dados = [dict(zip(colunas, row)) for row in cur.fetchall()]

    conn.close()
    return jsonify(dados)



@mod_reembolso.route("/reembolso/item/incluir")
@login_obrigatorio
def incluir_item():
    return render_template("/frm_reem_lancamentos_apoio_item.html")


@mod_reembolso.route("/reembolso/item/editar")
@login_obrigatorio
def editar_item():
    return render_template("/frm_reem_lancamentos_apoio_item.html")



@mod_reembolso.route("/reembolso/item/salvar", methods=["POST"])
def salvar_item():
    id_empresa = session.get("id_empresa")

    if "anexo" in request.files:
        anexo = request.files["anexo"]

        # Configurações
        id_empresa = session.get("id_empresa")
        id_reembolso = request.form.get("id_reembolso")


        # Garante que id_empresa é string formatada (ex: 04)
        id_empresa_str = str(id_empresa).zfill(2)

        # Cria pasta final: /system/mod_reembolso/static/uploadnf/notas{id_empresa}
        pasta_base = os.path.join("system", "mod_reembolso", "static", "uploadnf")
        pasta_empresa = os.path.join(pasta_base, f"notas{id_empresa_str}")
        os.makedirs(pasta_empresa, exist_ok=True)

        # Gera nome padronizado do arquivo
        ext = anexo.filename.rsplit(".", 1)[-1].lower()  # extensão segura
        timestamp = datetime.now().strftime("%Y%m%dT%H%M%S")
        nome_seguro = f"nota_{id_empresa_str}_{timestamp}.{ext}"

        # Caminho completo final
        caminho = os.path.join(pasta_empresa, nome_seguro)

        # Salva o arquivo
        anexo.save(caminho)


        # Campos do formulário
        form = request.form
        id_item = form.get("id_item") or None

        dados = {
            "data": form.get("data"),
            "descricao": form.get("descricao"),
            "valor": form.get("valor"),
            "id_categoria": form.get("id_categoria"),
            "forma_pagamento": form.get("forma_pagamento"),
            "cidade": form.get("cidade"),
            "uf": form.get("uf"),
            "cnpj_emitente": form.get("cnpj_emitente"),
            "razao_social_emitente": form.get("razao_social_emitente"),
            "tipo_documento": form.get("tipo_documento"),
            "chave_nfe": form.get("chave_nfe"),
            "anexo_nota": caminho,
            "documento": form.get("documento")

        }

        # VERIFICAÇÃO DE CNPJ E CRIAÇÃO AUTOMÁTICA
        cnpj = form.get("cnpj_emitente", "").replace(".", "").replace("/", "").replace("-", "")
        categoria_id = dados.get("id_categoria")

        if cnpj and len(cnpj) == 14:
            empresa_resultado = verificar_ou_criar_empresa(
                cnpj=cnpj,
                id_empresa=id_empresa,
                id_categoria=categoria_id  # envia para salvar também na tbl_hub_favorecido
            )
            print("📌 Verificação de Empresa:", empresa_resultado["mensagem"])

        conn = Var_ConectarBanco()
        cur = conn.cursor()

        if id_item:
            cur.execute("""
                UPDATE tbl_reem_lancamento_item
                   SET data = %(data)s,
                       descricao = %(descricao)s,
                       valor = %(valor)s,
                       id_categoria = %(id_categoria)s,
                       forma_pagamento = %(forma_pagamento)s,
                       cidade = %(cidade)s,
                       uf = %(uf)s,
                       cnpj_emitente = %(cnpj_emitente)s,
                       razao_social_emitente = %(razao_social_emitente)s,
                       tipo_documento = %(tipo_documento)s,
                       chave_nfe = %(chave_nfe)s,
                       anexo_nota = %(anexo_nota)s,
                       documento = %(documento)s

                 WHERE id = %(id_item)s AND id_empresa = %(id_empresa)s
            """, {**dados, "id_item": id_item, "id_empresa": id_empresa})
        else:
            cur.execute("""
                INSERT INTO tbl_reem_lancamento_item
                    (id_reembolso, id_empresa, data, descricao, valor, id_categoria,
                    forma_pagamento, cidade, uf, cnpj_emitente, razao_social_emitente,
                    tipo_documento, chave_nfe, anexo_nota, documento)

                VALUES (%(id_reembolso)s, %(id_empresa)s, %(data)s, %(descricao)s, %(valor)s, %(id_categoria)s,
                        %(forma_pagamento)s, %(cidade)s, %(uf)s, %(cnpj_emitente)s,
                        %(razao_social_emitente)s, %(tipo_documento)s, %(chave_nfe)s, %(anexo_nota)s, %(documento)s)
            """, {
                **dados,
                "id_reembolso": id_reembolso,
                "id_empresa": id_empresa
            })


        conn.commit()
        conn.close()
        return jsonify({"sucesso": True, "mensagem": "Item salvo com sucesso"})

    return jsonify({"erro": "Anexo não encontrado"}), 400



@mod_reembolso.route("/reembolso/item/apoio/<int:id>")
@login_obrigatorio
def apoio_item_reembolso(id):
    id_empresa = session.get("id_empresa")
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT 
                id,
                id_reembolso,
                data,
                descricao,
                valor,
                id_categoria,
                forma_pagamento,
                cidade,
                uf,
                cnpj_emitente,
                razao_social_emitente,
                tipo_documento,
                chave_nfe,
                anexo_nota,
                documento
            FROM tbl_reem_lancamento_item
            WHERE id = %s AND id_empresa = %s
        """, (id, id_empresa))

        dados = cursor.fetchone()
        if not dados:
            return jsonify({"erro": "Item não encontrado"}), 404

        colunas = [desc[0] for desc in cursor.description]
        return jsonify(dict(zip(colunas, dados)))

    except Exception as e:
        print("❌ ERRO AO CARREGAR ITEM:", str(e))
        return jsonify({"erro": str(e)}), 500

    finally:
        cursor.close()
        conn.close()



@mod_reembolso.route("/reembolso/item/delete", methods=["POST"])
def excluir_item():
    id = request.json.get("id")
    id_empresa = session.get("id_empresa")

    conn = Var_ConectarBanco()
    cur = conn.cursor()
    cur.execute("DELETE FROM FROM tbl_reem_lancamento_item WHERE id = %s AND id_empresa = %s", (id, id_empresa))
    conn.commit()
    conn.close()

    return jsonify({"sucesso": True, "mensagem": "Item excluído com sucesso"})



# -------------------------------------
# Ler nota via AI GPT
# -------------------------------------
@mod_reembolso.route("/reembolso/item/lernota", methods=["POST"])
def ler_nota_item():
    try:
        id_empresa = session.get("id_empresa")
        arquivo = request.files.get("arquivo")

        if not arquivo:
            return jsonify({"erro": "Arquivo não enviado"}), 400

        # Encaminha para o endpoint OCR central
        resposta = requests.post(
            url="http://localhost:5000/api/ocr/lernota",  # ajuste porta se necessário
            files={"anexo": (arquivo.filename, arquivo.stream, arquivo.mimetype)},
            data={"id_empresa": id_empresa}
        )

        return jsonify(resposta.json()), resposta.status_code

    except Exception as e:
        current_app.logger.error(f"❌ Erro ao encaminhar nota para OCR: {e}")
        return jsonify({"erro": "Erro interno ao processar a nota."}), 500





