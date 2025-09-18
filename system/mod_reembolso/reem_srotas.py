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
@mod_reembolso.route("/reembolso/lanc/dados", methods=["GET"])
@login_obrigatorio()
def reem_lanc_dados():
    import traceback
    conn = cur = None
    try:
        conn = Var_ConectarBanco()
        cur  = conn.cursor()

        id_empresa = session.get("id_empresa")
        id_usuario = session.get("id_usuario")

        def _get_int(name, default):
            v = request.args.get(name)
            try: return int(v) if v is not None else default
            except: return default

        pagina = _get_int("pagina", 1)
        qtd    = _get_int("qtd", 20)
        if qtd <= 0 or qtd > 200: qtd = 20
        if pagina < 1: pagina = 1
        offset = (pagina - 1) * qtd

        descricao = (request.args.get("descricao") or "").strip()
        data_s    = (request.args.get("data") or "").strip()      # yyyy-mm-dd
        status_s  = (request.args.get("status") or "")
        status    = [s.strip().upper() for s in status_s.split(",") if s.strip()]
        somente_minhas = (request.args.get("somente_minhas", "true").lower() == "true")  # ⬅️ vem do switch

        sql_base = """
            SELECT
                d.id_reembolso,
                d.data,
                d.descricao,
                d.valor_total,
                d.status,
                (
                    SELECT COUNT(*)
                      FROM tbl_reem_lancamento_nota n
                     WHERE n.id_reembolso = d.id_reembolso
                       AND n.id_empresa   = d.id_empresa
                ) AS qtd_notas
            FROM tbl_reem_lancamento d
            WHERE d.id_empresa = %s
        """
        vals = [id_empresa]

        if descricao:
            sql_base += " AND d.descricao ILIKE %s"
            vals.append(f"%{descricao}%")

        if data_s:
            sql_base += " AND d.data = %s::date"
            vals.append(data_s)

        if status:
            sql_base += " AND UPPER(d.status) = ANY(%s::text[])"
            vals.append(status)

        if somente_minhas:
            sql_base += " AND d.criado_por = %s"
            vals.append(id_usuario)

        # total
        cur.execute(f"SELECT COUNT(*) FROM ({sql_base}) x", vals)
        total_registros = cur.fetchone()[0] or 0
        total_paginas   = (total_registros + qtd - 1)//qtd if qtd else 1

        # paginação
        cur.execute(sql_base + " ORDER BY d.data DESC, d.id_reembolso DESC LIMIT %s OFFSET %s",
                    vals + [qtd, offset])
        rows = cur.fetchall() or []

        def _fmt_brl(v):
            try:
                return f"R$ {float(v):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
            except:
                return "R$ 0,00"

        itens = []
        for (id_reembolso, dt, desc, valor, st, qtd_notas) in rows:
            itens.append({
                "id": id_reembolso,
                "data": dt.strftime("%d/%m/%Y") if dt else "",
                "descricao": desc or "",
                "valor_total": float(valor or 0),
                "valor_total_fmt": _fmt_brl(valor or 0),
                "status": (st or "").upper(),
                "notas_qtde": int(qtd_notas or 0)
            })

        return jsonify({
            "pagina": pagina,
            "total_paginas": total_paginas or 1,
            "itens": itens
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"erro": f"Erro interno ao tentar acessar a página. {str(e)}"}), 500
    finally:
        try:
            if cur: cur.close()
        except: ...
        try:
            if conn: conn.close()
        except: ...







@mod_reembolso.route("/reembolso/lanc/incluir")
@login_obrigatorio
def reem_lanc_incluir():
    return render_template("frm_reem_lancamentos_apoio.html")




@mod_reembolso.route("/reembolso/lanc/editar")
@login_obrigatorio
def reem_lanc_editar():
    return render_template("frm_reem_lancamentos_apoio.html")



@mod_reembolso.route("/reembolso/lanc/salvar", methods=["POST"])
@login_obrigatorio
def reem_lanc_salvar():
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
                VALUES (%s, %s, %s, %s, %s, 'Aberto', %s, %s)
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
        return jsonify({"mensagem": "reembolso salvo com sucesso!", "id": dados["id"], "status": "Aberto"})


    except Exception as e:
        conn.rollback()
        return jsonify({"erro": f"Erro ao salvar: {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()


@mod_reembolso.route("/reembolso/lanc/apoio/<int:id>")
@login_obrigatorio
def reem_lanc_apoio(id):
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





@mod_reembolso.route("/reembolso/lanc/delete", methods=["POST"])
@login_obrigatorio
def reem_lanc_delete():
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


@mod_reembolso.route("/reembolso/lanc/flags", methods=["GET"])
@login_obrigatorio
def reembolso_lanc_flags():
    conn = cur = None
    try:
        id_usuario = session.get("id_usuario")
        id_empresa = session.get("id_empresa")

        conn = Var_ConectarBanco()
        cur  = conn.cursor()
        cur.execute("""
            SELECT COALESCE(is_developer,false) AS is_developer,
                   COALESCE(is_administrator,false) AS is_administrator
              FROM tbl_usuario
             WHERE id_usuario = %s AND id_empresa = %s
        """, (id_usuario, id_empresa))
        row = cur.fetchone()
        if not row:
            return jsonify({"erro":"Usuário não encontrado"}), 404

        return jsonify({"is_developer": row[0], "is_administrator": row[1]})
    finally:
        try:
            if cur: cur.close()
        except: ...
        try:
            if conn: conn.close()
        except: ...




# --------------------------------------------------
# reembolso itens
# --------------------------------------------------
@mod_reembolso.route("/reembolso/nota/dados", methods=["GET"])
@login_obrigatorio
def reembolso_nota_dados():
    import traceback
    conn = cur = None
    try:
        id_empresa   = session.get("id_empresa")
        id_reembolso = int(request.args.get("id_reembolso") or 0)
        if not id_reembolso:
            return jsonify([])

        conn = Var_ConectarBanco()
        cur  = conn.cursor()
        cur.execute("""
            SELECT
                i.id,
                i.data,
                i.descricao,
                COALESCE(i.valor, 0)                                        AS valor,
                i.anexo_nota,                                               -- coluna existe
                i.documento,                                                -- nº do doc (varchar(20))
                COALESCE(ld.nome_exibicao, NULLIF(i.forma_pagamento, ''))   AS forma_pgto,
                i.razao_social_emitente,
                (SELECT nome_categoria
                   FROM tbl_hub_categoria c
                  WHERE c.id = i.id_categoria)                              AS nome_categoria
            FROM tbl_reem_lancamento_nota i
            LEFT JOIN tbl_hub_livro_diario ld
              ON ld.id = CASE
                           WHEN i.forma_pagamento ~ '^[0-9]+$' THEN i.forma_pagamento::int
                           ELSE NULL
                         END
             AND ld.id_empresa = i.id_empresa
            WHERE i.id_reembolso = %s
              AND i.id_empresa   = %s
            ORDER BY i.data DESC
        """, (id_reembolso, id_empresa))

        cols  = [d[0] for d in cur.description]
        dados = [dict(zip(cols, r)) for r in cur.fetchall()]
        return jsonify(dados)

    except Exception as e:
        traceback.print_exc()
        return jsonify({"erro": f"{e}"}), 500
    finally:
        try: cur and cur.close()
        except: ...
        try: conn and conn.close()
        except: ...





@mod_reembolso.route("/reembolso/nota/incluir")
@login_obrigatorio
def incluir_nota():
    return render_template("/frm_reem_lancamentos_apoio_nota.html")


@mod_reembolso.route("/reembolso/nota/editar")
@login_obrigatorio
def editar_nota():
    return render_template("/frm_reem_lancamentos_apoio_nota.html")



@mod_reembolso.route("/reembolso/nota/salvar", methods=["POST"])
def salvar_nota():
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
        id_nota = form.get("id_nota") or None

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

        if id_nota:
            cur.execute("""
                UPDATE tbl_reem_lancamento_nota
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

                 WHERE id = %(id_nota)s AND id_empresa = %(id_empresa)s
            """, {**dados, "id_nota": id_nota, "id_empresa": id_empresa})
        else:
            cur.execute("""
                INSERT INTO tbl_reem_lancamento_nota
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
        return jsonify({"sucesso": True, "mensagem": "nota salvo com sucesso"})

    return jsonify({"erro": "Anexo não encontrado"}), 400



@mod_reembolso.route("/reembolso/nota/apoio/<int:id>")
@login_obrigatorio
def apoio_nota_reembolso(id):
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
            FROM tbl_reem_lancamento_nota
            WHERE id = %s AND id_empresa = %s
        """, (id, id_empresa))

        dados = cursor.fetchone()
        if not dados:
            return jsonify({"erro": "nota não encontrado"}), 404

        colunas = [desc[0] for desc in cursor.description]
        return jsonify(dict(zip(colunas, dados)))

    except Exception as e:
        print("❌ ERRO AO CARREGAR nota:", str(e))
        return jsonify({"erro": str(e)}), 500

    finally:
        cursor.close()
        conn.close()



@mod_reembolso.route("/reembolso/nota/delete", methods=["POST"])
def excluir_nota():
    id = request.json.get("id")
    id_empresa = session.get("id_empresa")

    conn = Var_ConectarBanco()
    cur = conn.cursor()
    cur.execute("DELETE FROM FROM tbl_reem_lancamento_nota WHERE id = %s AND id_empresa = %s", (id, id_empresa))
    conn.commit()
    conn.close()

    return jsonify({"sucesso": True, "mensagem": "nota excluído com sucesso"})




# exemplo dentro do seu blueprint de reembolso
@mod_reembolso.route("/reembolso/nota/categorias", methods=["GET"])
@login_obrigatorio()
def reem_nota_listar_categorias():
    try:
        id_empresa = request.args.get("id_empresa", type=int)
        if not id_empresa:
            return jsonify({"erro": "id_empresa obrigatório"}), 400

        conn = Var_ConectarBanco()
        cur = conn.cursor()

        # ajuste o nome da tabela/colunas conforme o seu modelo
        cur.execute("""
            SELECT id, nome_categoria
              FROM tbl_hub_categoria
             WHERE id_empresa = %s
               AND (status = 'Ativo' OR status IS NULL)
             ORDER BY nome_categoria
        """, (id_empresa,))
        rows = cur.fetchall()
        conn.close()

        categorias = [{"id": r[0], "nome_categoria": r[1]} for r in rows]
        return jsonify(categorias), 200

    except Exception as e:
        # logue o erro real no server
        return jsonify({"erro": f"Falha ao listar categorias: {str(e)}"}), 500


@mod_reembolso.route("/reembolso/nota/formas_pagamento", methods=["GET"])
@login_obrigatorio()
def reem_nota_listar_formas_pagamento():
    try:
        id_empresa = request.args.get("id_empresa", type=int)
        if not id_empresa:
            return jsonify({"erro": "id_empresa obrigatório"}), 400

        conn = Var_ConectarBanco()
        cur = conn.cursor()

        # Fonte: tbl_hub_livro_diario (só exemplos; ajuste conforme seu dicionário)
        # ideia: listar "formas" distintas cadastradas para a empresa
        cur.execute("""
            SELECT DISTINCT forma_pagamento
              FROM tbl_hub_livro_diario
             WHERE id_empresa = %s
               AND (forma_pagamento IS NOT NULL AND trim(forma_pagamento) <> '')
             ORDER BY forma_pagamento
        """, (id_empresa,))
        rows = cur.fetchall()
        conn.close()

        formas = [{"codigo": r[0], "descricao": r[0]} for r in rows]  # codigo = descricao aqui
        return jsonify(formas), 200

    except Exception as e:
        return jsonify({"erro": f"Falha ao listar formas de pagamento: {str(e)}"}), 500

# -------------------------------------
# Ler nota via AI GPT
# -------------------------------------
@mod_reembolso.route("/reembolso/nota/lernota", methods=["POST"])
def ler_nota_nota():
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





