# hub_srotas.py
from flask import Blueprint, request, jsonify, session, render_template
from global_utils import (
    login_obrigatorio,
    Var_ConectarBanco
)


mod_hub_bp = Blueprint(
    'mod_hub',
    __name__,
    template_folder='templates',
    static_folder='static',
    static_url_path='/static/hub'
)


def init_app(app):
    app.register_blueprint(mod_hub_bp)


# 🔒 Middleware padrão do projeto
def get_id_empresa():
    return session.get("id_empresa")



# ────────────────────────────────────────────────────────────────────────────
# ROTA GENÉRICA PARA CARREGAMENTO DE PÁGINAS DO MÓDULO HUB
# ────────────────────────────────────────────────────────────────────────────
@mod_hub_bp.route('/abrir_pagina/mod_hub/<pagina>')
@login_obrigatorio
def abrir_pagina_mod_hub(pagina):
    try:
        return render_template(f"frm_{pagina}.html")
    except Exception as e:
        return f"Erro ao abrir página: {str(e)}", 500




# 📘 Exemplo: Listar Plano de Contas
@mod_hub_bp.route("/plano_contas", methods=["GET"])
def listar_plano_contas():
    id_empresa = get_id_empresa()
    conn = Var_ConectarBanco()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, codigo, descricao, tipo, nivel, analitica
        FROM tbl_hub_plano_contas
        WHERE id_empresa = %s
    """, (id_empresa,))

    contas = cursor.fetchall()

    resultado = [{
        "id": c[0],
        "codigo": c[1],
        "descricao": c[2],
        "tipo": c[3],
        "nivel": c[4],
        "analitica": c[5]
    } for c in contas]

    cursor.close()
    conn.close()

    return jsonify(resultado)


# 📘 Exemplo: Criar nova conta contábil
@mod_hub_bp.route("/plano_contas", methods=["POST"])
def criar_plano_contas():
    dados = request.get_json()
    id_empresa = get_id_empresa()

    conn = Var_ConectarBanco()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO tbl_hub_plano_contas (codigo, descricao, tipo, nivel, analitica, id_empresa)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (
        dados["codigo"],
        dados["descricao"],
        dados["tipo"],
        dados["nivel"],
        dados.get("analitica", True),
        id_empresa
    ))

    id_criado = cursor.fetchone()[0]
    conn.commit()

    cursor.close()
    conn.close()

    return jsonify({"mensagem": "Conta criada com sucesso.", "id": id_criado})







# ────────────────────────────────────────────────
# ROTAS: PLANO DE CONTAS (formato padrão funcional)
# ────────────────────────────────────────────────

@mod_hub_bp.route("/plano_contas/dados")
@login_obrigatorio
def plano_contas_dados():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()

    tipo = request.args.get("tipo", "").strip()
    id_empresa = session.get("id_empresa")

    sql = """
        SELECT codigo, descricao, status
        FROM tbl_hub_plano_contas
        WHERE id_empresa = %s
    """
    valores = [id_empresa]

    if tipo:
        sql += " AND plano = %s"
        valores.append(tipo)

    sql += " ORDER BY codigo"

    cursor.execute(sql, valores)
    colunas = [desc[0] for desc in cursor.description]
    dados = [dict(zip(colunas, linha)) for linha in cursor.fetchall()]
    conn.close()

    return jsonify({ "dados": dados })


@mod_hub_bp.route("/plano_contas/editar", methods=["POST"])
@login_obrigatorio
def plano_contas_editar():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    dados = request.get_json()
    id_empresa = session.get("id_empresa")

    try:
        cursor.execute("""
            UPDATE tbl_hub_plano_contas
            SET descricao = %s
            WHERE id_empresa = %s AND codigo = %s
        """, (
            dados.get("descricao"),
            id_empresa,
            dados.get("codigo")
        ))
        conn.commit()
        return jsonify({"mensagem": "Atualizado com sucesso"})

    except Exception as e:
        conn.rollback()
        return jsonify({"erro": f"Erro ao atualizar: {str(e)}"}), 500

    finally:
        conn.close()


@mod_hub_bp.route("/plano_contas/incluir", methods=["POST"])
@login_obrigatorio
def plano_contas_incluir():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    dados = request.get_json()
    id_empresa = session.get("id_empresa")

    try:
        codigo_pai = dados.get("codigo_pai")
        descricao = dados.get("descricao")
        plano = dados.get("plano")

        # Buscar último código filho
        cursor.execute("""
            SELECT codigo FROM tbl_hub_plano_contas
            WHERE id_empresa = %s AND codigo LIKE %s
            ORDER BY codigo DESC LIMIT 1
        """, (id_empresa, f"{codigo_pai}.%"))

        ultimo = cursor.fetchone()
        if ultimo:
            partes = ultimo[0].split(".")
            partes[-1] = str(int(partes[-1]) + 1).zfill(2)
            novo_codigo = ".".join(partes)
        else:
            novo_codigo = f"{codigo_pai}.01"

        # Calcular o nível
        nivel = novo_codigo.count(".") + 1

        if nivel > 5:
            return jsonify({"erro": "Limite máximo de níveis (5) atingido."}), 400

        # Definir tipo com base no nível
        tipo = "Sintética" if nivel <= 3 else "Analítica"

        # Inserir novo plano
        cursor.execute("""
            INSERT INTO tbl_hub_plano_contas (id_empresa, codigo, descricao, tipo, nivel, status, plano)
            VALUES (%s, %s, %s, %s, %s, true, %s)
        """, (id_empresa, novo_codigo, descricao, tipo, nivel, plano))

        conn.commit()
        return jsonify({"codigo": novo_codigo, "descricao": descricao})

    except Exception as e:
        conn.rollback()
        return jsonify({"erro": str(e)}), 500

    finally:
        conn.close()



@mod_hub_bp.route("/plano_contas/ocultar", methods=["POST"])
@login_obrigatorio
def plano_contas_ocultar():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    dados = request.get_json()
    id_empresa = session.get("id_empresa")

    try:
        cursor.execute("""
            UPDATE tbl_hub_plano_contas
            SET status = NOT status
            WHERE id_empresa = %s AND codigo = %s
        """, (id_empresa, dados.get("codigo")))

        conn.commit()
        return jsonify({"mensagem": "Status alterado"})

    except Exception as e:
        conn.rollback()
        return jsonify({"erro": str(e)}), 500

    finally:
        conn.close()


@mod_hub_bp.route("/plano_contas/existe", methods=["GET"])
@login_obrigatorio
def plano_contas_existe():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    id_empresa = session.get("id_empresa")

    cursor.execute("""
        SELECT COUNT(*) FROM tbl_hub_plano_contas WHERE id_empresa = %s
    """, (id_empresa,))
    total = cursor.fetchone()[0]
    return jsonify({"existe": total > 0})



@mod_hub_bp.route("/plano_contas/buscar")
@login_obrigatorio
def buscar_contas_contabeis():
    termo = request.args.get("termo", "").strip()
    tipo_plano = request.args.get("tipo", "").strip()
    id_empresa = session.get("id_empresa")

    if len(termo) < 3:
        return jsonify([])

    conn = Var_ConectarBanco()
    cursor = conn.cursor()

    try:
        # Buscar apenas contas analíticas de nível 5 que atendam aos critérios
        cursor.execute("""
            SELECT id, codigo, descricao
            FROM tbl_hub_plano_contas
            WHERE nivel = 5
              AND tipo = 'Analítica'
              AND status = true
              AND plano = %s
              AND id_empresa = %s
              AND descricao ILIKE %s
        """, (tipo_plano, id_empresa, f"%{termo}%"))

        contas = cursor.fetchall()
        resultados = []

        for id_final, cod_final, desc_final in contas:
            hierarquia = []

            # Separar o código em partes e ir subindo nos níveis
            partes = cod_final.split('.')
            for nivel in range(2, 6):  # níveis 2 a 5
                codigo_nivel = '.'.join(partes[:nivel])
                cursor.execute("""
                    SELECT descricao FROM tbl_hub_plano_contas
                    WHERE codigo = %s AND id_empresa = %s
                """, (codigo_nivel, id_empresa))
                resultado = cursor.fetchone()
                if resultado:
                    hierarquia.append({
                        "nivel": nivel,
                        "descricao": resultado[0]
                    })

            resultados.append({
                "id": id_final,
                "codigo": cod_final,
                "descricao_final": desc_final,
                "hierarquia": hierarquia
            })

        return jsonify(resultados)

    except Exception as e:
        return jsonify([]), 500

    finally:
        cursor.close()
        conn.close()


# ────────────────────────────────────────────────
# Rotas para categoria em HUB
# ────────────────────────────────────────────────
@mod_hub_bp.route("/categoria/dados")
@login_obrigatorio
def categoria_dados():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()

    pagina = int(request.args.get("pagina", 1))
    por_pagina = int(request.args.get("porPagina", 20))
    offset = (pagina - 1) * por_pagina

    id_empresa = session.get("id_empresa")
    nome = request.args.get("nome", "").strip()
    status = request.args.get("status", "")

    sql = """
        SELECT c.id, c.nome_categoria, c.status,
               COUNT(cc.id) AS quantidade_contas
        FROM tbl_hub_categoria c
        LEFT JOIN tbl_hub_categoria_conta cc
          ON cc.id_categoria = c.id AND cc.id_empresa = c.id_empresa
        WHERE c.id_empresa = %s
    """
    valores = [id_empresa]

    if nome:
        sql += " AND c.nome_categoria ILIKE %s"
        valores.append(f"%{nome}%")

    if status:
        sql += " AND c.status = %s"
        valores.append(status == "true")

    sql += """
        GROUP BY c.id, c.nome_categoria, c.status
    """

    sql_total = f"SELECT COUNT(*) FROM ({sql}) AS sub"
    cursor.execute(sql_total, valores)
    total_registros = cursor.fetchone()[0]
    total_paginas = (total_registros + por_pagina - 1) // por_pagina

    sql += " ORDER BY c.id LIMIT %s OFFSET %s"
    valores.extend([por_pagina, offset])

    cursor.execute(sql, valores)
    colunas = [desc[0] for desc in cursor.description]
    registros = [dict(zip(colunas, linha)) for linha in cursor.fetchall()]
    conn.close()

    return jsonify({
        "dados": registros,
        "total_paginas": total_paginas
    })



@mod_hub_bp.route("/categoria/incluir")
@login_obrigatorio
def categoria_incluir():
    return render_template("frm_hub_categoria_apoio.html")


@mod_hub_bp.route("/categoria/editar")
@login_obrigatorio
def categoria_editar():
    return render_template("frm_hub_categoria_apoio.html")

@mod_hub_bp.route("/categoria/contas_apoio")
@login_obrigatorio
def categoria_contas_apoio():
    return render_template("frm_hub_categoria_contas_apoio.html")


@mod_hub_bp.route("/categoria/salvar", methods=["POST"])
@login_obrigatorio
def categoria_salvar():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    dados = request.json
    id_empresa = session.get("id_empresa")

    try:
        if dados.get("id"):
            cursor.execute("""
                UPDATE tbl_hub_categoria
                SET nome_categoria = %s,
                    status = %s,
                    observacoes = %s
                WHERE id = %s AND id_empresa = %s
            """, (
                dados["nome"],
                dados["status"],
                dados["observacoes"],
                dados["id"],
                id_empresa
            ))
            retorno_id = dados["id"]
        else:
            cursor.execute("""
                INSERT INTO tbl_hub_categoria
                    (id_empresa, nome_categoria, status, observacoes)
                VALUES (%s, %s, %s, %s)
            """, (
                id_empresa,
                dados["nome"],
                dados["status"],
                dados["observacoes"]
            ))
            retorno_id = cursor.lastrowid

        conn.commit()
        return jsonify({
            "retorno": True,
            "msg": "Categoria salva com sucesso!",
            "id": retorno_id
        })

    except Exception as e:
        conn.rollback()
        return jsonify({"retorno": False, "msg": f"Erro ao salvar a categoria: {str(e)}"}), 500

    finally:
        cursor.close()
        conn.close()





@mod_hub_bp.route("/categoria/apoio_dados", methods=["POST"])
@login_obrigatorio
def apoio_categoria():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    try:
        id_categoria = request.json.get("id")
        cursor.execute("""
            SELECT id, nome_categoria, status, observacoes
            FROM tbl_hub_categoria
            WHERE id = %s AND id_empresa = %s
        """, (id_categoria, session.get("id_empresa")))
        
        dados = cursor.fetchone()
        if not dados:
            return jsonify({"erro": "Categoria não encontrada."}), 404
        
        colunas = [desc[0] for desc in cursor.description]
        return jsonify(dict(zip(colunas, dados)))
        
    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    finally:
        conn.close()




@mod_hub_bp.route("/categoria/delete", methods=["POST"])
@login_obrigatorio
def categoria_delete():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    dados = request.json
    try:
        cursor.execute("DELETE FROM tbl_hub_categoria WHERE id = %s AND id_empresa = %s", (dados["id"], session.get("id_empresa")))
        conn.commit()
        return jsonify({"status": "sucesso", "mensagem": "Categoria excluída com sucesso."})
    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    finally:
        conn.close()


# ────────────────────────────────────────────
# Rotas para CONTAS CONTÁBEIS em HUB
# ────────────────────────────────────────────

@mod_hub_bp.route("/categoria/conta/dados")
@login_obrigatorio
def categoria_conta_dados():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    id_categoria = request.args.get("id_categoria")

    cursor.execute("""
        SELECT cc.id, cc.onde_usa, cc.tipo_plano, cc.status,
               p.codigo || ' - ' || p.descricao AS descricao_conta
        FROM tbl_hub_categoria_conta cc
        LEFT JOIN tbl_hub_plano_contas p ON p.id = cc.id_conta_contabil AND p.id_empresa = cc.id_empresa
        WHERE cc.id_categoria = %s AND cc.id_empresa = %s
        ORDER BY cc.id
    """, (id_categoria, session.get("id_empresa")))

    colunas = [desc[0] for desc in cursor.description]
    registros = [dict(zip(colunas, linha)) for linha in cursor.fetchall()]
    conn.close()
    return jsonify(registros)



@mod_hub_bp.route("/categoria/conta/apoio")
@login_obrigatorio
def categoria_conta_apoio():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    id_conta = request.args.get("id")

    cursor.execute("""
        SELECT cc.id, cc.onde_usa, cc.tipo_plano, cc.status,
               cc.id_conta_contabil,
               p.codigo || ' - ' || p.descricao AS descricao_conta
        FROM tbl_hub_categoria_conta cc
        LEFT JOIN tbl_hub_plano_contas p ON p.id = cc.id_conta_contabil AND p.id_empresa = cc.id_empresa
        WHERE cc.id = %s AND cc.id_empresa = %s
    """, (id_conta, session.get("id_empresa")))

    dados = cursor.fetchone()
    if not dados:
        return jsonify({"erro": "Conta vinculada não encontrada"}), 404

    colunas = [desc[0] for desc in cursor.description]
    conn.close()
    return jsonify(dict(zip(colunas, dados)))



@mod_hub_bp.route("/categoria/conta/salvar", methods=["POST"])
@login_obrigatorio
def categoria_conta_salvar():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    dados = request.json
    id_empresa = session.get("id_empresa")

    try:
        # Verificação: apenas 1 ativo por onde_usa permitido
        if dados["status"] == True:
            cursor.execute("""
                SELECT COUNT(*) FROM tbl_hub_categoria_conta
                WHERE id_categoria = %s AND id_empresa = %s AND onde_usa ILIKE %s 
                AND status = TRUE
                AND (%s IS NULL OR id <> %s)
            """, (
                dados["id_categoria"], id_empresa, dados["onde_usa"],
                dados.get("id"), dados.get("id")
            ))
            quantidade = cursor.fetchone()[0]
            if quantidade > 0:
                return jsonify({
                    "retorno": False,
                    "msg": "Já existe um vínculo ativo com o mesmo 'Onde Usa'. "
                           "Para incluir outra conta, primeiro exclua ou desative o registro atual."
                }), 400

        # Incluir ou editar
        if dados.get("id"):
            cursor.execute("""
                UPDATE tbl_hub_categoria_conta
                SET onde_usa = %s, tipo_plano = %s, id_conta_contabil = %s, status = %s
                WHERE id = %s AND id_empresa = %s
            """, (
                dados["onde_usa"], dados["tipo_plano"], dados["id_conta_contabil"],
                dados["status"], dados["id"], id_empresa
            ))
        else:
            cursor.execute("""
                INSERT INTO tbl_hub_categoria_conta
                (id_categoria, id_empresa, onde_usa, tipo_plano, id_conta_contabil, status)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                dados["id_categoria"], id_empresa,
                dados["onde_usa"], dados["tipo_plano"], dados["id_conta_contabil"], dados["status"]
            ))

        conn.commit()
        return jsonify({"retorno": True, "msg": "Conta vinculada salva com sucesso!"})

    except Exception as e:
        conn.rollback()
        return jsonify({"retorno": False, "msg": f"Erro: {str(e)}"}), 500
    finally:
        conn.close()



@mod_hub_bp.route("/categoria/conta/delete", methods=["POST"])
@login_obrigatorio
def categoria_conta_delete():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    id_conta = request.json.get("id")
    try:
        cursor.execute("""
            DELETE FROM tbl_hub_categoria_conta
            WHERE id = %s AND id_empresa = %s
        """, (id_conta, session.get("id_empresa")))
        conn.commit()
        return jsonify({"retorno": True, "msg": "Excluído com sucesso!"})
    except Exception as e:
        conn.rollback()
        return jsonify({"retorno": False, "msg": f"Erro: {str(e)}"}), 500
    finally:
        conn.close()



@mod_hub_bp.route("/categoria/conta/ativar", methods=["POST"])
@login_obrigatorio
def categoria_conta_ativar():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    id_empresa = session.get("id_empresa")
    id_conta = request.json.get("id")

    try:
        # Busca status atual
        cursor.execute("""
            SELECT status FROM tbl_hub_categoria_conta
            WHERE id = %s AND id_empresa = %s
        """, (id_conta, id_empresa))
        resultado = cursor.fetchone()

        if not resultado:
            return jsonify({"retorno": False, "msg": "Conta vinculada não encontrada"}), 404

        status_atual = resultado[0]
        novo_status = not status_atual

        cursor.execute("""
            UPDATE tbl_hub_categoria_conta
            SET status = %s
            WHERE id = %s AND id_empresa = %s
        """, (novo_status, id_conta, id_empresa))

        conn.commit()
        status_txt = "ativada" if novo_status else "inativada"
        return jsonify({"retorno": True, "msg": f"Conta {status_txt} com sucesso!"})

    except Exception as e:
        conn.rollback()
        return jsonify({"retorno": False, "msg": f"Erro ao alternar status: {str(e)}"}), 500
    finally:
        conn.close()


# ────────────────────────────────────────────────
# Rotas para FAVORECIDOS em HUB
# ────────────────────────────────────────────────
@mod_hub_bp.route("/favorecido/dados")
@login_obrigatorio
def favorecido_dados():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()

    pagina = int(request.args.get("pagina", 1))
    por_pagina = int(request.args.get("porPagina", 200))
    offset = (pagina - 1) * por_pagina

    id_empresa = session.get("id_empresa")
    documento = request.args.get("documento", "").strip()
    id_categoria = request.args.get("id_categoria", "").strip()
    razao_social = request.args.get("razao_social", "").strip()
    status = request.args.get("status")

    sql = """
        SELECT f.id, f.documento, f.razao_social, f.cidade, f.uf,
               cat.nome_categoria AS categoria_nome,
               f.status
        FROM tbl_hub_favorecido f
        LEFT JOIN tbl_hub_categoria cat ON cat.id = f.id_categoria AND cat.id_empresa = f.id_empresa
        WHERE f.id_empresa = %s
    """
    valores = [id_empresa]

    if documento:
        sql += " AND f.documento ILIKE %s"
        valores.append(f"%{documento}%")

    if id_categoria:
        sql += " AND f.id_categoria::text = %s"
        valores.append(id_categoria)

    if razao_social:
        sql += " AND f.razao_social ILIKE %s"
        valores.append(f"%{razao_social}%")

    if status != "":
        sql += " AND f.status = %s"
        valores.append(status == "true")

    sql_total = f"SELECT COUNT(*) FROM ({sql}) AS sub"
    cursor.execute(sql_total, valores)
    total_registros = cursor.fetchone()[0]
    total_paginas = (total_registros + por_pagina - 1) // por_pagina

    sql += " ORDER BY f.razao_social ASC LIMIT %s OFFSET %s"
    valores.extend([por_pagina, offset])

    cursor.execute(sql, valores)
    colunas = [desc[0] for desc in cursor.description]
    registros = [dict(zip(colunas, linha)) for linha in cursor.fetchall()]
    conn.close()

    return jsonify({
        "dados": registros,
        "total_paginas": total_paginas
    })


@mod_hub_bp.route("/favorecido/incluir")
@login_obrigatorio
def favorecido_incluir():
    return render_template("frm_hub_favorecido_apoio.html")


@mod_hub_bp.route("/favorecido/editar")
@login_obrigatorio
def favorecido_editar():
    return render_template("frm_hub_favorecido_apoio.html")



@mod_hub_bp.route("/favorecido/salvar", methods=["POST"])
@login_obrigatorio
def salvar_favorecido():
    def tratar_data(valor):
        return valor if valor else None

    def tratar_valor(valor):
        return valor if valor not in ("", None) else None

    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    dados = request.json
    id_empresa = session.get("id_empresa")

    try:

        if dados.get("id"):  # UPDATE
            cursor.execute("""
                UPDATE tbl_hub_favorecido
                SET tipo = %s, documento = %s, razao_social = %s, nome = %s, email = %s, telefone = %s,
                    inscricao_estadual = %s, inscricao_municipal = %s, cep = %s, logradouro = %s,
                    numero = %s, complemento = %s, bairro = %s, cidade = %s, uf = %s,
                    data_abertura = %s, natureza_juridica = %s, cnae_principal = %s, cnaes_secundarios = %s,
                    situacao_cadastral = %s, data_situacao = %s, observacoes = %s, id_categoria = %s, status = %s
                WHERE id = %s AND id_empresa = %s
            """, (
                dados.get("tipo"),
                dados.get("documento"),
                dados.get("razao_social"),
                dados.get("nome"),
                dados.get("email"),
                dados.get("telefone"),
                dados.get("inscricao_estadual"),
                dados.get("inscricao_municipal"),
                dados.get("cep"),
                dados.get("logradouro"),
                dados.get("numero"),
                dados.get("complemento"),
                dados.get("bairro"),
                dados.get("cidade"),
                dados.get("uf"),
                tratar_data(dados.get("data_abertura")),
                dados.get("natureza_juridica"),
                dados.get("cnae_principal"),
                dados.get("cnaes_secundarios"),
                dados.get("situacao_cadastral"),
                tratar_data(dados.get("data_situacao")),
                dados.get("observacoes"),
                tratar_valor(dados.get("id_categoria")),
                tratar_valor(dados.get("status")),
                dados.get("id"),
                id_empresa
            ))

        else:  # INSERT
            cursor.execute("""
                INSERT INTO tbl_hub_favorecido (
                    id_empresa, tipo, documento, razao_social, nome, email, telefone,
                    inscricao_estadual, inscricao_municipal, cep, logradouro, numero, complemento,
                    bairro, cidade, uf, data_abertura, natureza_juridica, cnae_principal,
                    cnaes_secundarios, situacao_cadastral, data_situacao, observacoes, id_categoria, status
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                id_empresa,
                dados.get("tipo"),
                dados.get("documento"),
                dados.get("razao_social"),
                dados.get("nome"),
                dados.get("email"),
                dados.get("telefone"),
                dados.get("inscricao_estadual"),
                dados.get("inscricao_municipal"),
                dados.get("cep"),
                dados.get("logradouro"),
                dados.get("numero"),
                dados.get("complemento"),
                dados.get("bairro"),
                dados.get("cidade"),
                dados.get("uf"),
                tratar_data(dados.get("data_abertura")),
                dados.get("natureza_juridica"),
                dados.get("cnae_principal"),
                dados.get("cnaes_secundarios"),
                dados.get("situacao_cadastral"),
                tratar_data(dados.get("data_situacao")),
                dados.get("observacoes"),
                tratar_valor(dados.get("id_categoria")),
                tratar_valor(dados.get("status"))
            ))


        conn.commit()
        return jsonify({"sucesso": True, "mensagem": "Favorecido salvo com sucesso!"})

    except Exception as e:
        conn.rollback()
        return jsonify({"sucesso": False, "mensagem": f"Erro ao salvar favorecido: {str(e)}"}), 500

    finally:
        cursor.close()
        conn.close()




@mod_hub_bp.route("/favorecido/delete", methods=["POST"])
@login_obrigatorio
def favorecido_delete():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    dados = request.json

    try:
        cursor.execute("""
            DELETE FROM tbl_hub_favorecido
            WHERE id = %s AND id_empresa = %s
        """, (dados["id"], session.get("id_empresa")))
        conn.commit()
        return jsonify({"status": "sucesso", "mensagem": "Favorecido excluído com sucesso."})
    except Exception as e:
        conn.rollback()
        return jsonify({"erro": str(e)}), 500
    finally:
        conn.close()


@mod_hub_bp.route("/favorecido/apoio/<int:id>", methods=["GET"])
@login_obrigatorio
def apoio_favorecido(id):
    conn = Var_ConectarBanco()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT 
                f.id,
                f.tipo,
                f.nome,
                f.razao_social,
                f.documento,
                f.inscricao_estadual,
                f.inscricao_municipal,
                f.email,
                f.telefone,
                f.cep,
                f.logradouro,
                f.numero,
                f.complemento,
                f.bairro,
                f.cidade,
                f.uf,
                f.data_abertura,
                f.natureza_juridica,
                f.cnae_principal,
                f.cnaes_secundarios,
                f.situacao_cadastral,
                f.data_situacao,
                f.observacoes,
                f.id_empresa,
                f.status,
                f.id_categoria,
                cat.nome_categoria -- ✅ sem vírgula aqui!
            FROM tbl_hub_favorecido f
            LEFT JOIN tbl_hub_categoria cat ON cat.id = f.id_categoria AND cat.id_empresa = f.id_empresa
            WHERE f.id = %s AND f.id_empresa = %s
        """, (id, session.get("id_empresa")))

        dados = cursor.fetchone()
        if not dados:
            return jsonify({"erro": "Favorecido não encontrado."}), 404

        colunas = [desc[0] for desc in cursor.description]
        return jsonify(dict(zip(colunas, dados)))

    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    finally:
        conn.close()




# ────────────────────────────────────────────────
# Rotas para Livro Diário em HUB
# ────────────────────────────────────────────────
@mod_hub_bp.route("/livro_diario/dados")
@login_obrigatorio
def livro_diario_dados():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()

    pagina = int(request.args.get("pagina", 1))
    por_pagina = int(request.args.get("porPagina", 20))
    offset = (pagina - 1) * por_pagina

    id_empresa = session.get("id_empresa")
    nome = request.args.get("nome", "").strip()
    tipo = request.args.get("tipo_conta", "").strip()
    status = request.args.get("status")

    sql = """
        SELECT ld.*, pc.descricao AS desc_conta_contabil
        FROM tbl_hub_livro_diario ld
        LEFT JOIN tbl_hub_plano_contas pc ON pc.id = ld.id_conta_contabil
        WHERE ld.id_empresa = %s
    """
    valores = [id_empresa]

    if nome:
        sql += " AND ld.nome_exibicao ILIKE %s"
        valores.append(f"%{nome}%")

    if tipo:
        sql += " AND ld.tipo_conta = %s"
        valores.append(tipo)

    if status != "":
        sql += " AND ld.status = %s"
        valores.append(status == "true")

    sql_total = f"SELECT COUNT(*) FROM ({sql}) AS sub"
    cursor.execute(sql_total, valores)
    total_registros = cursor.fetchone()[0]
    total_paginas = (total_registros + por_pagina - 1) // por_pagina

    sql += " ORDER BY ld.id LIMIT %s OFFSET %s"
    valores.extend([por_pagina, offset])

    cursor.execute(sql, valores)
    colunas = [desc[0] for desc in cursor.description]
    registros = [dict(zip(colunas, linha)) for linha in cursor.fetchall()]
    conn.close()

    return jsonify({
        "dados": registros,
        "total_paginas": total_paginas
    })


@mod_hub_bp.route("/livro_diario/incluir")
@login_obrigatorio
def livro_diario_incluir():
    return render_template("frm_hub_livro_diario_apoio.html")


@mod_hub_bp.route("/livro_diario/editar")
@login_obrigatorio
def livro_diario_editar():
    return render_template("frm_hub_livro_diario_apoio.html")


@mod_hub_bp.route("/livro_diario/salvar", methods=["POST"])
@login_obrigatorio
def livro_diario_salvar():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    dados = request.json
    id_empresa = session.get("id_empresa")

    try:
        if dados.get("id"):
            cursor.execute("""
                UPDATE tbl_hub_livro_diario SET
                    nome_exibicao = %s, tipo_conta = %s, status = %s, id_conta_contabil = %s,
                    banco_codigo = %s, agencia_numero = %s, agencia_dv = %s,
                    conta_numero = %s, conta_dv = %s,
                    tipo_plano = %s, bandeira_cartao = %s,
                    possui_integracao = %s, token_integracao = %s, webhook_url = %s
                WHERE id = %s AND id_empresa = %s
            """, (
                dados["nome_exibicao"], dados["tipo_conta"], dados["status"], dados["id_conta_contabil"],
                dados["banco_codigo"], dados["agencia_numero"], dados["agencia_dv"],
                dados["conta_numero"], dados["conta_dv"],
                dados["tipo_plano"], dados["bandeira_cartao"],
                dados["possui_integracao"], dados["token_integracao"], dados["webhook_url"],
                dados["id"], id_empresa
            ))
        else:
            cursor.execute("""
                INSERT INTO tbl_hub_livro_diario (
                    id_empresa, nome_exibicao, tipo_conta, status, id_conta_contabil,
                    banco_codigo, agencia_numero, agencia_dv,
                    conta_numero, conta_dv,
                    tipo_plano, bandeira_cartao,
                    possui_integracao, token_integracao, webhook_url
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                id_empresa, dados["nome_exibicao"], dados["tipo_conta"], dados["status"], dados["id_conta_contabil"],
                dados["banco_codigo"], dados["agencia_numero"], dados["agencia_dv"],
                dados["conta_numero"], dados["conta_dv"],
                dados["tipo_plano"], dados["bandeira_cartao"],
                dados["possui_integracao"], dados["token_integracao"], dados["webhook_url"]
            ))

        conn.commit()
        return jsonify({"mensagem": "Conta salva com sucesso!"})

    except Exception as e:
        conn.rollback()
        return jsonify({"erro": str(e)}), 500

    finally:
        conn.close()



@mod_hub_bp.route("/livro_diario/apoio/<int:id>")
@login_obrigatorio
def apoio_livro_diario(id):
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT ld.*, pc.descricao AS desc_conta_contabil, pc.codigo AS codigo_conta_contabil
            FROM tbl_hub_livro_diario ld
            LEFT JOIN tbl_hub_plano_contas pc ON pc.id = ld.id_conta_contabil AND pc.id_empresa = ld.id_empresa
            WHERE ld.id = %s AND ld.id_empresa = %s
        """, (id, session.get("id_empresa")))

        dados = cursor.fetchone()
        if not dados:
            return jsonify({"erro": "Conta não encontrada."}), 404

        colunas = [desc[0] for desc in cursor.description]
        return jsonify(dict(zip(colunas, dados)))

    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    finally:
        conn.close()


@mod_hub_bp.route("/livro_diario/delete", methods=["POST"])
@login_obrigatorio
def livro_diario_delete():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    dados = request.json
    try:
        cursor.execute("DELETE FROM tbl_hub_livro_diario WHERE id = %s AND id_empresa = %s", (dados["id"], session.get("id_empresa")))
        conn.commit()
        return jsonify({"status": "sucesso", "mensagem": "Conta excluída com sucesso."})
    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    finally:
        conn.close()




# ────────────────────────────────────────────────
# Rotas para Grupos de Usuario
# ────────────────────────────────────────────────
@mod_hub_bp.route("/usuario/grupo/dados")
@login_obrigatorio
def usuario_grupo_dados():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    id_empresa = session.get("id_empresa")

    pagina = int(request.args.get("pagina", 1))
    por_pagina = int(request.args.get("porPagina", 20))
    offset = (pagina - 1) * por_pagina

    nome = request.args.get("nome", "").strip()
    aprovador = request.args.get("aprovador")

    sql = "SELECT * FROM tbl_usuario_grupo WHERE id_empresa = %s"
    valores = [id_empresa]

    if nome:
        sql += " AND nome_grupo ILIKE %s"
        valores.append(f"%{nome}%")

    if aprovador not in [None, ""]:
        sql += " AND aprovador = %s"
        valores.append(aprovador == "true")

    sql_total = f"SELECT COUNT(*) FROM ({sql}) AS sub"
    cursor.execute(sql_total, valores)
    total_registros = cursor.fetchone()[0]
    total_paginas = (total_registros + por_pagina - 1) // por_pagina

    sql += " ORDER BY id LIMIT %s OFFSET %s"
    valores.extend([por_pagina, offset])
    cursor.execute(sql, valores)
    colunas = [desc[0] for desc in cursor.description]
    registros = [dict(zip(colunas, linha)) for linha in cursor.fetchall()]

    conn.close()
    return jsonify({"dados": registros, "total_paginas": total_paginas})




# TELAS DE APOIO HTML
@mod_hub_bp.route("/usuario/grupo/incluir")
@login_obrigatorio
def usuario_grupo_incluir():
    return render_template("frm_usuario_grupo_apoio.html")

@mod_hub_bp.route("/usuario/grupo/editar")
@login_obrigatorio
def usuario_grupo_editar():
    return render_template("frm_usuario_grupo_apoio.html")

@mod_hub_bp.route("/usuario/grupo/editar_modulo")
@login_obrigatorio
def usuario_grupo_editar_modulo():
    return render_template("frm_usuario_modulo_apoio.html")


# SALVAR GRUPO
@mod_hub_bp.route("/usuario/grupo/salvar", methods=["POST"])
@login_obrigatorio
def usuario_grupo_salvar():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    dados = request.json
    id_empresa = session.get("id_empresa")

    try:
        if dados.get("id"):
            cursor.execute("""
                UPDATE tbl_usuario_grupo SET nome_grupo = %s, descricao = %s, aprovador = %s
                WHERE id = %s AND id_empresa = %s
            """, (dados["nome_grupo"], dados.get("descricao", ""), dados.get("aprovador", False), dados["id"], id_empresa))
            retorno_id = dados["id"]
        else:
            cursor.execute("""
                INSERT INTO tbl_usuario_grupo (id_empresa, nome_grupo, descricao, aprovador)
                VALUES (%s, %s, %s, %s)
            """, (id_empresa, dados["nome_grupo"], dados.get("descricao", ""), dados.get("aprovador", False)))
            retorno_id = cursor.lastrowid
        conn.commit()
        return jsonify({"status": "sucesso", "mensagem": "Grupo salvo com sucesso!", "id": retorno_id})
    except Exception as e:
        conn.rollback()
        return jsonify({"erro": str(e)}), 500
    finally:
        conn.close()


# EXCLUIR GRUPO
@mod_hub_bp.route("/usuario/grupo/delete", methods=["POST"])
@login_obrigatorio
def usuario_grupo_delete():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    dados = request.json
    try:
        cursor.execute("DELETE FROM tbl_usuario_grupo WHERE id = %s AND id_empresa = %s", (dados["id"], session.get("id_empresa")))
        conn.commit()
        return jsonify({"status": "sucesso", "mensagem": "Grupo excluído com sucesso."})
    except Exception as e:
        conn.rollback()
        return jsonify({"erro": str(e)}), 500
    finally:
        conn.close()



@mod_hub_bp.route("/usuario/grupo/apoio1/<int:id>")
@login_obrigatorio
def usuario_grupo_apoio1(id):
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT * FROM tbl_usuario_grupo
            WHERE id = %s AND id_empresa = %s
        """, (id, session.get("id_empresa")))

        dados = cursor.fetchone()
        if not dados:
            return jsonify({"erro": "Grupo não encontrado."}), 404

        colunas = [desc[0] for desc in cursor.description]
        return jsonify(dict(zip(colunas, dados)))

    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    finally:
        conn.close()




@mod_hub_bp.route("/usuario/grupo/apoio2/<int:id_grupo>")
@login_obrigatorio
def usuario_grupo_apoio2(id_grupo):
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    id_empresa = session.get("id_empresa")

    try:
        # Primeiro, busca os menus principais
        cursor.execute("""
            SELECT m.id, m.nome_menu, m.assinatura_app
            FROM tbl_menu m
            WHERE m.local_menu = 'lateral'
              AND m.ativo = true
              AND m.parent_id IS NULL
             AND (
                m.assinatura_app = false OR
                EXISTS (
                    SELECT 1 FROM tbl_assinatura_cliente ac
                    WHERE ac.id_modulo = m.id
                    AND ac.id_empresa = %s
                    AND ac.status = 'Ativo'
                )
            )

            ORDER BY m.ordem
        """, (id_empresa,))
        menus_principais = cursor.fetchall()

        resultado = []

        # Busca todas as permissões do grupo UMA ÚNICA VEZ
        cursor.execute("""
            SELECT id_menu FROM tbl_usuario_modulo
            WHERE id_empresa = %s AND id_usuario_grupo = %s
        """, (id_empresa, id_grupo))
        permissoes = [linha[0] for linha in cursor.fetchall()]

        for menu in menus_principais:
            id_menu, nome_menu, assinatura_app = menu

            # Buscar submenus vinculados ao menu principal
            cursor.execute("""
                SELECT sm.id, sm.nome_menu, sm.assinatura_app
                FROM tbl_menu sm
                WHERE sm.parent_id = %s
                  AND sm.local_menu = 'lateral'
                  AND sm.ativo = true
                  AND (
                    sm.assinatura_app = false OR
                    EXISTS (
                        SELECT 1 FROM tbl_assinatura_cliente ac
                        WHERE ac.id_modulo = sm.id
                        AND ac.id_empresa = %s
                        AND ac.status = 'Ativo'
                    )
                )

                ORDER BY sm.ordem
            """, (id_menu, id_empresa))
            submenus = cursor.fetchall()

            checked_principal = id_menu in permissoes

            submenus_list = []
            for id_sub, nome_sub, assinatura_app_sub in submenus:
                checked_sub = id_sub in permissoes
                submenus_list.append({
                    "id_menu": id_sub,
                    "nome_menu": nome_sub,
                    "checked": checked_sub,
                    "parent_id": id_menu
                })

            resultado.append({
                "id_menu": id_menu,
                "nome_menu": nome_menu,
                "checked": checked_principal,
                "parent_id": None,
                "submenus": submenus_list
            })

        return jsonify({
            "menus": resultado,
            "permissoes": permissoes
        })

    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    finally:
        conn.close()






# ─────────────────────────────────────────────────────────────────────────────
# Rotas para Funcionários no HUB
# ─────────────────────────────────────────────────────────────────────────────
@mod_hub_bp.route("/funcionarios/dados")
@login_obrigatorio
def funcionarios_dados():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()

    pagina = int(request.args.get("pagina", 1))
    por_pagina = int(request.args.get("porPagina", 20))
    offset = (pagina - 1) * por_pagina

    id_empresa = session.get("id_empresa")

    # Busca id_categoria do Funcionário
    cursor.execute("""
        SELECT id FROM tbl_hub_categoria
        WHERE nome_categoria = 'Funcionário' AND id_empresa = %s
    """, (id_empresa,))
    id_categoria = cursor.fetchone()
    if not id_categoria:
        cursor.execute("""
            INSERT INTO tbl_hub_categoria (id_empresa, nome_categoria, origem, status)
            VALUES (%s, 'Funcionário', 'Hub', TRUE) RETURNING id
        """, (id_empresa,))
        id_categoria = cursor.fetchone()
        conn.commit()
    id_categoria = id_categoria[0]

    nome = request.args.get("nome", "").strip()
    departamento = request.args.get("departamento", "").strip()
    funcao = request.args.get("funcao", "").strip()
    status = request.args.get("status", "")

    sql = """
        SELECT id, documento, nome, departamento, funcao, email, telefone, status
        FROM tbl_hub_favorecido
        WHERE id_empresa = %s AND id_categoria = %s
    """
    valores = [id_empresa, id_categoria]

    if nome:
        sql += " AND nome ILIKE %s"
        valores.append(f"%{nome}%")
    if departamento:
        sql += " AND departamento ILIKE %s"
        valores.append(f"%{departamento}%")
    if funcao:
        sql += " AND funcao ILIKE %s"
        valores.append(f"%{funcao}%")
    if status != "":
        sql += " AND status = %s"
        valores.append(status == "true")

    sql_total = f"SELECT COUNT(*) FROM ({sql}) AS sub"
    cursor.execute(sql_total, valores)
    total_registros = cursor.fetchone()[0]
    total_paginas = (total_registros + por_pagina - 1) // por_pagina

    sql += " ORDER BY id LIMIT %s OFFSET %s"
    valores.extend([por_pagina, offset])
    cursor.execute(sql, valores)
    colunas = [desc[0] for desc in cursor.description]
    registros = [dict(zip(colunas, linha)) for linha in cursor.fetchall()]
    conn.close()

    return jsonify({"dados": registros, "total_paginas": total_paginas})


@mod_hub_bp.route("/funcionarios/incluir")
@login_obrigatorio
def funcionarios_incluir():
    return render_template("frm_hub_funcionarios_apoio.html")


@mod_hub_bp.route("/funcionarios/editar")
@login_obrigatorio
def funcionarios_editar():
    return render_template("frm_hub_funcionarios_apoio.html")


@mod_hub_bp.route("/funcionarios/apoio/<int:id>")
@login_obrigatorio
def funcionarios_apoio(id):
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    id_empresa = session.get("id_empresa")

    cursor.execute("""
        SELECT * FROM tbl_hub_favorecido
        WHERE id = %s AND id_empresa = %s
    """, (id, id_empresa))
    dados = cursor.fetchone()
    if not dados:
        conn.close()
        return jsonify({"erro": "Funcionário não encontrado."}), 404

    colunas = [desc[0] for desc in cursor.description]
    conn.close()
    return jsonify(dict(zip(colunas, dados)))




@mod_hub_bp.route("/funcionarios/salvar", methods=["POST"])
@login_obrigatorio
def funcionarios_salvar():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    dados = request.json
    id_empresa = session.get("id_empresa")

    # Verifica se categoria Funcionário existe
    cursor.execute("""
        SELECT id FROM tbl_hub_categoria
        WHERE nome_categoria = 'Funcionário' AND id_empresa = %s
    """, (id_empresa,))
    categoria = cursor.fetchone()

    if not categoria:
        conn.close()
        return jsonify({"erro": "A categoria 'Funcionário' não está cadastrada. Cadastre primeiro antes de lançar funcionários."}), 400

    id_categoria = categoria[0]

    campos = [
        "documento", "nome", "departamento", "funcao", "email", "telefone",
        "data_abertura", "data_situacao", "cep", "logradouro", "numero", "complemento",
        "bairro", "cidade", "uf", "observacoes", "status"
    ]

    def tratar_data(valor):
        return valor if valor else None

    try:
        if dados.get("id"):
            sql = f"""
                UPDATE tbl_hub_favorecido SET
                    {", ".join([f"{c} = %s" for c in campos])},
                    tipo = 'F',
                    razao_social = %s
                WHERE id = %s AND id_empresa = %s AND id_categoria = %s
            """
            valores = [
                dados["documento"], dados["nome"], dados["departamento"], dados["funcao"],
                dados["email"], dados["telefone"],
                tratar_data(dados["data_abertura"]), tratar_data(dados["data_situacao"]),
                dados["cep"], dados["logradouro"], dados["numero"], dados["complemento"],
                dados["bairro"], dados["cidade"], dados["uf"], dados["observacoes"],
                dados["status"],
                dados["nome"], dados["id"], id_empresa, id_categoria
            ]
            cursor.execute(sql, valores)
        else:
            sql = f"""
                INSERT INTO tbl_hub_favorecido (
                    id_empresa, id_categoria, tipo, razao_social, {", ".join(campos)}
                ) VALUES (%s, %s, 'F', %s, {', '.join(['%s'] * len(campos))})
            """
            valores = [
                id_empresa, id_categoria, dados["nome"]
            ] + [
                dados[c] if not c.startswith("data_") else tratar_data(dados[c]) for c in campos
            ]
            cursor.execute(sql, valores)

        conn.commit()
        return jsonify({"mensagem": "Funcionário salvo com sucesso!"})

    except Exception as e:
        conn.rollback()
        return jsonify({"erro": str(e)}), 500

    finally:
        conn.close()

        



@mod_hub_bp.route("/funcionarios/delete", methods=["POST"])
@login_obrigatorio
def funcionarios_delete():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    dados = request.json
    id_empresa = session.get("id_empresa")

    try:
        cursor.execute("""
            DELETE FROM tbl_hub_favorecido
            WHERE id = %s AND id_empresa = %s
        """, (dados["id"], id_empresa))
        conn.commit()
        return jsonify({"status": "sucesso", "mensagem": "Funcionário excluído com sucesso."})
    except Exception as e:
        conn.rollback()
        return jsonify({"erro": str(e)}), 500
    finally:
        conn.close()



@mod_hub_bp.route("/departamentos/ativos")
@login_obrigatorio
def departamentos_ativos():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    id_empresa = session.get("id_empresa")

    try:
        cursor.execute("""
            SELECT id, nome
            FROM tbl_hub_departamentos
            WHERE id_empresa = %s AND status = TRUE
            ORDER BY nome
        """, (id_empresa,))
        resultados = cursor.fetchall()
        dados = [{"id": row[0], "nome": row[1]} for row in resultados]
        return jsonify(dados)
    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    finally:
        conn.close()




# ─────────────────────────────────────────────────────────────────────────────
# Rotas para Funcionários no HUB
# ─────────────────────────────────────────────────────────────────────────────
@mod_hub_bp.route("/departamentos/dados")
@login_obrigatorio
def departamentos_dados():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()

    id_empresa = session.get("id_empresa")
    pagina = int(request.args.get("pagina", 1))
    por_pagina = int(request.args.get("porPagina", 20))
    offset = (pagina - 1) * por_pagina
    nome = request.args.get("nome", "").strip()
    status = request.args.get("status", "")

    sql = """
        SELECT id, nome, status, obs
        FROM tbl_hub_departamentos
        WHERE id_empresa = %s
    """
    valores = [id_empresa]

    if nome:
        sql += " AND nome ILIKE %s"
        valores.append(f"%{nome}%")
    if status:
        sql += " AND status = %s"
        valores.append(status == "true")

    sql_total = f"SELECT COUNT(*) FROM ({sql}) AS sub"
    cursor.execute(sql_total, valores)
    total = cursor.fetchone()[0]
    total_paginas = (total + por_pagina - 1) // por_pagina

    sql += " ORDER BY nome LIMIT %s OFFSET %s"
    valores.extend([por_pagina, offset])
    cursor.execute(sql, valores)
    colunas = [desc[0] for desc in cursor.description]
    dados = [dict(zip(colunas, linha)) for linha in cursor.fetchall()]
    conn.close()

    return jsonify({"dados": dados, "total_paginas": total_paginas})



@mod_hub_bp.route("/departamentos/incluir")
@login_obrigatorio
def departamentos_incluir():
    return render_template("frm_hub_departamentos_apoio.html")

@mod_hub_bp.route("/departamentos/editar")
@login_obrigatorio
def departamentos_editar():
    return render_template("frm_hub_departamentos_apoio.html")



@mod_hub_bp.route("/departamentos/salvar", methods=["POST"])
@login_obrigatorio
def departamentos_salvar():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    dados = request.json
    id_empresa = session.get("id_empresa")

    try:
        if dados.get("id"):
            cursor.execute("""
                UPDATE tbl_hub_departamentos
                SET nome = %s, status = %s, obs = %s
                WHERE id = %s AND id_empresa = %s
            """, (dados["nome"], dados["status"], dados["obs"], dados["id"], id_empresa))
            retorno_id = dados["id"]
        else:
            cursor.execute("""
                INSERT INTO tbl_hub_departamentos (id_empresa, nome, status, obs)
                VALUES (%s, %s, %s, %s)
            """, (id_empresa, dados["nome"], dados["status"], dados["obs"]))
            retorno_id = cursor.lastrowid

        conn.commit()
        return jsonify({"retorno": True, "msg": "Departamento salvo com sucesso!", "id": retorno_id})

    except Exception as e:
        conn.rollback()
        erro_str = str(e)

        if "unq_departamento_empresa" in erro_str.lower():
            return jsonify({
                "retorno": False,
                "msg": "Este nome de departamento já está cadastrado para esta empresa. Verifique antes de tentar novamente."
            }), 400

        return jsonify({"retorno": False, "msg": f"Erro ao salvar: {erro_str}"}), 500
    finally:
        conn.close()




# APOIO - CARREGAR DADOS POR ID
@mod_hub_bp.route("/departamentos/apoio_dados", methods=["POST"])
@login_obrigatorio
def departamentos_apoio_dados():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    id_empresa = session.get("id_empresa")
    id = request.json.get("id")

    try:
        cursor.execute("""
            SELECT id, nome, status, obs
            FROM tbl_hub_departamentos
            WHERE id = %s AND id_empresa = %s
        """, (id, id_empresa))
        dados = cursor.fetchone()
        if not dados:
            return jsonify({"erro": "Departamento não encontrado"}), 404

        colunas = [desc[0] for desc in cursor.description]
        return jsonify(dict(zip(colunas, dados)))
    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    finally:
        conn.close()



# DELETE
@mod_hub_bp.route("/departamentos/delete", methods=["POST"])
@login_obrigatorio
def departamentos_delete():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    id_empresa = session.get("id_empresa")
    id = request.json.get("id")

    try:
        cursor.execute("""
            DELETE FROM tbl_hub_departamentos
            WHERE id = %s AND id_empresa = %s
        """, (id, id_empresa))
        conn.commit()
        return jsonify({"retorno": True, "msg": "Departamento excluído com sucesso."})
    except Exception as e:
        conn.rollback()
        return jsonify({"retorno": False, "msg": str(e)}), 500
    finally:
        conn.close()


# ─────────────────────────────────────────────────────────────────────────────
# Rotas para Projetos no HUB
# ─────────────────────────────────────────────────────────────────────────────
@mod_hub_bp.route("/projetos/dados")
@login_obrigatorio
def projetos_dados():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()

    id_empresa = session.get("id_empresa")
    pagina = int(request.args.get("pagina", 1))
    por_pagina = int(request.args.get("porPagina", 20))
    offset = (pagina - 1) * por_pagina
    nome = request.args.get("nome", "").strip()
    status = request.args.get("status", "")

    sql = """
        SELECT id, nome, status, obs
        FROM tbl_hub_projetos
        WHERE id_empresa = %s
    """
    valores = [id_empresa]

    if nome:
        sql += " AND nome ILIKE %s"
        valores.append(f"%{nome}%")
    if status:
        sql += " AND status = %s"
        valores.append(status == "true")

    sql_total = f"SELECT COUNT(*) FROM ({sql}) AS sub"
    cursor.execute(sql_total, valores)
    total = cursor.fetchone()[0]
    total_paginas = (total + por_pagina - 1) // por_pagina

    sql += " ORDER BY nome LIMIT %s OFFSET %s"
    valores.extend([por_pagina, offset])
    cursor.execute(sql, valores)
    colunas = [desc[0] for desc in cursor.description]
    dados = [dict(zip(colunas, linha)) for linha in cursor.fetchall()]
    conn.close()

    return jsonify({"dados": dados, "total_paginas": total_paginas})


@mod_hub_bp.route("/projetos/incluir")
@login_obrigatorio
def projetos_incluir():
    return render_template("frm_hub_projetos_apoio.html")


@mod_hub_bp.route("/projetos/editar")
@login_obrigatorio
def projetos_editar():
    return render_template("frm_hub_projetos_apoio.html")


@mod_hub_bp.route("/projetos/salvar", methods=["POST"])
@login_obrigatorio
def projetos_salvar():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    dados = request.json
    id_empresa = session.get("id_empresa")

    try:
        if dados.get("id"):
            cursor.execute("""
                UPDATE tbl_hub_projetos
                SET nome = %s, status = %s, obs = %s
                WHERE id = %s AND id_empresa = %s
            """, (dados["nome"], dados["status"], dados["obs"], dados["id"], id_empresa))
            retorno_id = dados["id"]
        else:
            cursor.execute("""
                INSERT INTO tbl_hub_projetos (id_empresa, nome, status, obs)
                VALUES (%s, %s, %s, %s)
            """, (id_empresa, dados["nome"], dados["status"], dados["obs"]))
            retorno_id = cursor.lastrowid

        conn.commit()
        return jsonify({"retorno": True, "msg": "Projeto salvo com sucesso!", "id": retorno_id})

    except Exception as e:
        conn.rollback()
        erro_str = str(e)

        if "unq_projeto_empresa" in erro_str.lower():
            return jsonify({
                "retorno": False,
                "msg": "Este nome de projeto já está cadastrado para esta empresa. Verifique antes de tentar novamente."
            }), 400

        return jsonify({"retorno": False, "msg": f"Erro ao salvar: {erro_str}"}), 500
    finally:
        conn.close()


@mod_hub_bp.route("/projetos/apoio_dados", methods=["POST"])
@login_obrigatorio
def projetos_apoio_dados():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    id_empresa = session.get("id_empresa")
    id = request.json.get("id")

    try:
        cursor.execute("""
            SELECT id, nome, status, obs
            FROM tbl_hub_projetos
            WHERE id = %s AND id_empresa = %s
        """, (id, id_empresa))
        dados = cursor.fetchone()
        if not dados:
            return jsonify({"erro": "Projeto não encontrado"}), 404

        colunas = [desc[0] for desc in cursor.description]
        return jsonify(dict(zip(colunas, dados)))
    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    finally:
        conn.close()


@mod_hub_bp.route("/projetos/delete", methods=["POST"])
@login_obrigatorio
def projetos_delete():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    id_empresa = session.get("id_empresa")
    id = request.json.get("id")

    try:
        cursor.execute("""
            DELETE FROM tbl_hub_projetos
            WHERE id = %s AND id_empresa = %s
        """, (id, id_empresa))
        conn.commit()
        return jsonify({"retorno": True, "msg": "Projeto excluído com sucesso."})
    except Exception as e:
        conn.rollback()
        return jsonify({"retorno": False, "msg": str(e)}), 500
    finally:
        conn.close()
