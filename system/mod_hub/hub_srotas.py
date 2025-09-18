# hub_srotas.py
from flask import Blueprint, request, jsonify, session, render_template, current_app
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





#Cadastro de plano de contas padrão para cliente novo
@mod_hub_bp.route('/cadastro/planocontas', methods=['POST'])
@login_obrigatorio()
def cadastrar_plano_padrao():
   # Tenta primeiro via sessão (prioritário)
    id_empresa = session.get("id_empresa")

    # Se não estiver na sessão (ex: chamada externa), tenta via corpo JSON
    if not id_empresa:
        dados = request.get_json(silent=True) or {}
        id_empresa = dados.get("id_empresa")

    if not id_empresa:
        return jsonify({"success": False, "mensagem": "id_empresa é obrigatório."}), 400
    
    modelo_itg = [
    {"codigo": "1", "descricao": "Ativo", "tipo": "Sintética", "plano": "Ativo"},
    {"codigo": "1.1", "descricao": "Ativo Circulante", "tipo": "Sintética", "plano": "Ativo"},
    {"codigo": "1.1.1", "descricao": "Disponibilidades", "tipo": "Sintética", "plano": "Ativo"},
    {"codigo": "1.1.1.01", "descricao": "Caixa", "tipo": "Sintética", "plano": "Ativo"},
    {"codigo": "1.1.1.01.01", "descricao": "Caixa", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.1.01.02", "descricao": "Fundo Fixo de Caixa", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.1.02", "descricao": "Depósitos Bancários à Vista", "tipo": "Sintética", "plano": "Ativo"},
    {"codigo": "1.1.1.02.01", "descricao": "Bancos Conta Movimento", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.1.03", "descricao": "Aplicações Financeiras", "tipo": "Sintética", "plano": "Ativo"},
    {"codigo": "1.1.1.03.01", "descricao": "Aplicação Financeira de Liquidez Imediata", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.2", "descricao": "Créditos", "tipo": "Sintética", "plano": "Ativo"},
    {"codigo": "1.1.2.01", "descricao": "Recebíveis de clientes", "tipo": "Sintética", "plano": "Ativo"},
    {"codigo": "1.1.2.01.01", "descricao": "Contas a Receber", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.2.01.02", "descricao": "PECLD", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.2.02", "descricao": "Créditos de Colaboradores", "tipo": "Sintética", "plano": "Ativo"},
    {"codigo": "1.1.2.02.01", "descricao": "Adiantamento Quinzenal", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.2.02.02", "descricao": "Empréstimos a colaboradores", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.2.02.03", "descricao": "Antecipação de Salários", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.2.02.04", "descricao": "Antecipação de Férias", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.2.02.05", "descricao": "Antecipação de 13º Salário", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.2.03", "descricao": "Créditos de Fornecedores", "tipo": "Sintética", "plano": "Ativo"},
    {"codigo": "1.1.2.03.01", "descricao": "Adiantamentos a Fornecedores", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.2.04", "descricao": "Tributos Retidos na Fonte", "tipo": "Sintética", "plano": "Ativo"},
    {"codigo": "1.1.2.04.01", "descricao": "IRRF", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.2.04.02", "descricao": "CSLL Retida na Fonte", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.2.04.03", "descricao": "PIS Retido na fonte", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.2.04.04", "descricao": "COFINS Retida na Fonte", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.2.04.05", "descricao": "INSS Retido na Fonte", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.2.05", "descricao": "Tributos a Recuperar", "tipo": "Sintética", "plano": "Ativo"},
    {"codigo": "1.1.2.05.01", "descricao": "IPI a Recuperar", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.2.05.02", "descricao": "ICMS a Recuperar", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.2.05.03", "descricao": "PIS a Recuperar - Crédito Básico", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.2.05.04", "descricao": "PIS a Recuperar - Crédito Presumido", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.2.05.05", "descricao": "COFINS a Recuperar - Crédito Básico", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.2.05.06", "descricao": "COFINS a Recuperar - Crédito Presumido", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.2.05.07", "descricao": "CIDE a Recuperar", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.2.05.08", "descricao": "Outros Impostos e Contribuições a Recuperar", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.2.05.09", "descricao": "Saldo Negativo - IRPJ", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.2.05.10", "descricao": "Saldo Negativo - CSLL", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.2.06", "descricao": "Tributos a Compensar", "tipo": "Sintética", "plano": "Ativo"},
    {"codigo": "1.1.2.06.01", "descricao": "IRPJ Estimativa", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.2.06.02", "descricao": "CSLL Estimativa", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.2.06.03", "descricao": "COFINS a Compensar", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.2.06.04", "descricao": "PIS/PASEP a Compensar", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.2.06.05", "descricao": "IPI a Compensar", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.2.06.06", "descricao": "INSS a compensar", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.3", "descricao": "Estoques", "tipo": "Sintética", "plano": "Ativo"},
    {"codigo": "1.1.3.01", "descricao": "Estoques de Mercadorias", "tipo": "Sintética", "plano": "Ativo"},
    {"codigo": "1.1.3.01.01", "descricao": "Mercadorias para Revenda", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.3.01.02", "descricao": "(-) Perda por Ajuste ao Valor Realizável Líquido - Estoque Mercadorias", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.3.02", "descricao": "Estoques de Produtos", "tipo": "Sintética", "plano": "Ativo"},
    {"codigo": "1.1.3.02.01", "descricao": "Insumos (materiais diretos)", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.3.02.02", "descricao": "Outros Materiais", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.3.02.03", "descricao": "Produtos em Elaboração", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.3.02.04", "descricao": "Produtos Acabados", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.3.02.05", "descricao": "(-) Perda por Ajuste ao Valor Realizável Líquido - Estoque Produtos", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.3.03", "descricao": "Outros Estoques", "tipo": "Sintética", "plano": "Ativo"},
    {"codigo": "1.1.3.03.01", "descricao": "Materiais para Consumo", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.3.03.02", "descricao": "Materiais para Reposição", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.4", "descricao": "Despesas Pagas Antecipadamente", "tipo": "Sintética", "plano": "Ativo"},
    {"codigo": "1.1.4.01", "descricao": "Despesas do Exercício Seguinte", "tipo": "Sintética", "plano": "Ativo"},
    {"codigo": "1.1.4.01.01", "descricao": "Aluguéis e Arredamentos Pagos Antecipadamente", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.4.01.02", "descricao": "Prêmios de Seguros a Apropriar", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.1.6.01.99", "descricao": "Outras Despesas Antecipadas", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2", "descricao": "Ativo Não Circulante", "tipo": "Sintética", "plano": "Ativo"},
    {"codigo": "1.2.1", "descricao": "Realizável a Longo Prazo", "tipo": "Sintética", "plano": "Ativo"},
    {"codigo": "1.2.1.01", "descricao": "Créditos de Longo Prazo", "tipo": "Sintética", "plano": "Ativo"},
    {"codigo": "1.2.1.01.01", "descricao": "Clientes - Longo Prazo", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.1.01.02", "descricao": "PCLD Longo Prazo", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.1.01.03", "descricao": "Juros a apropriar Clientes LP", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.1.01.04", "descricao": "Empréstimos de LP", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.1.01.05", "descricao": "Juros a apropriar Empréstimos LP", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.1.02", "descricao": "Ativos Fiscais Diferidos", "tipo": "Sintética", "plano": "Ativo"},
    {"codigo": "1.2.1.01.01", "descricao": "IRPJ Diferido", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.1.01.02", "descricao": "CSLL Diferido", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.2", "descricao": "Investimentos", "tipo": "Sintética", "plano": "Ativo"},
    {"codigo": "1.2.2.01", "descricao": "Investimentos Societários", "tipo": "Sintética", "plano": "Ativo"},
    {"codigo": "1.2.2.01.01", "descricao": "Investimentos em Controladas", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.2.01.02", "descricao": "Ágio pago pela mais valia", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.2.01.03", "descricao": "Ágio pago por Goodwill", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.2.01.04", "descricao": "Investimentos em Coligadas", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.2.01.05", "descricao": "Investimentos em Joint Ventures", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.3", "descricao": "Imobilizado", "tipo": "Sintética", "plano": "Ativo"},
    {"codigo": "1.2.3.01", "descricao": "Imobilizado - Aquisição", "tipo": "Sintética", "plano": "Ativo"},
    {"codigo": "1.2.3.01.10", "descricao": "Terrenos", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.3.01.11", "descricao": "Impairment Terrenos", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.3.01.20", "descricao": "Edifícios e Construções", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.3.01.21", "descricao": "Impairment Edifícios e Construções", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.3.01.30", "descricao": "Benfeitorias em Imóveis de Terceiros", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.3.01.31", "descricao": "Impairment Benfeitorias em Imóveis de Terceiros", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.3.01.40", "descricao": "Máquinas, Equipamentos e Instalações Industriais", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.3.01.41", "descricao": "Impairment Máquinas, Equipamentos e Instalações Industriais", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.3.01.50", "descricao": "Móveis, Utensílios e Instalações Comerciais", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.3.01.51", "descricao": "Impairment Móveis, Utensílios e Instalações Comerciais", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.3.01.60", "descricao": "Veículos", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.3.01.61", "descricao": "Impairment Veículos", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.3.02", "descricao": "Imobilizado - Depreciação Acumulada", "tipo": "Sintética", "plano": "Ativo"},
    {"codigo": "1.2.3.02.20", "descricao": "Depreciação Acumulada - Edifícios e Construções", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.3.02.30", "descricao": "Depreciação Acumulada - Benfeitorias em Imóveis de Terceiros", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.3.02.40", "descricao": "Depreciação Acumulada - Máquinas, Equipamentos e Instalações Industriais", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.3.02.50", "descricao": "Depreciação Acumulada - Móveis, Utensílios e Instalações Comerciais", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.3.02.51", "descricao": "Depreciação Acumulada - Veículos", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.3.01", "descricao": "Propriedades para Investimento", "tipo": "Sintética", "plano": "Ativo"},
    {"codigo": "1.2.3.01.10", "descricao": "Terrenos para Investimento - Custo", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.3.01.20", "descricao": "Edifícios para Investimento - Custo", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.3.01.21", "descricao": "Edifícios para Investimento - Depreciação", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.4", "descricao": "Intangível", "tipo": "Sintética", "plano": "Ativo"},
    {"codigo": "1.2.4.01", "descricao": "Intangível - Aquisição", "tipo": "Sintética", "plano": "Ativo"},
    {"codigo": "1.2.4.01.10", "descricao": "Softwares", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.4.01.11", "descricao": "Impairment - Softwares", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.4.01.20", "descricao": "Marcas", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.4.01.21", "descricao": "Impairment - Marcas", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.4.01.30", "descricao": "Patentes e Segredos Industriais", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.4.01.31", "descricao": "Impairment - Patentes e Segredos Industriais", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.4.01.40", "descricao": "Goodwill", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.4.02", "descricao": "Intangível - Amortização", "tipo": "Sintética", "plano": "Ativo"},
    {"codigo": "1.2.4.02.10", "descricao": "Amortização Acumulada - Softwares", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.4.02.20", "descricao": "Amortização Acumulada - Marcas", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "1.2.4.02.30", "descricao": "Amortização Acumulada - Patentes e Segredos Industriais", "tipo": "Analítica", "plano": "Ativo"},
    {"codigo": "2", "descricao": "Passivo", "tipo": "Sintética", "plano": "Passivo"},
    {"codigo": "2.1", "descricao": "Passivo Circulante", "tipo": "Sintética", "plano": "Passivo"},
    {"codigo": "2.1.1", "descricao": "Obrigações Trabalhistas", "tipo": "Sintética", "plano": "Passivo"},
    {"codigo": "2.1.1.01", "descricao": "Obrigações com Pessoal", "tipo": "Sintética", "plano": "Passivo"},
    {"codigo": "2.1.1.01.01", "descricao": "Salários e Remunerações a Pagar", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.1.1.01.02", "descricao": "Participações no Resultado a Pagar", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.1.1.01.03", "descricao": "INSS a Recolher", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.1.1.01.04", "descricao": "FGTS a Recolher", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.1.1.01.05", "descricao": "INSS desoneração da folha", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.1.1.01.06", "descricao": "Férias", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.1.1.01.07", "descricao": "13º Salário", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.1.1.01.08", "descricao": "INSS - Férias", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.1.1.01.09", "descricao": "FGTS - Férias", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.1.1.01.10", "descricao": "INSS - 13º Salário", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.1.1.01.11", "descricao": "FGTS - 13º Salário", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.1.2", "descricao": "Obrigações com Terceiros", "tipo": "Sintética", "plano": "Passivo"},
    {"codigo": "2.1.2.01", "descricao": "Fornecedores", "tipo": "Sintética", "plano": "Passivo"},
    {"codigo": "2.1.2.01.01", "descricao": "Fornecedores Nacionais", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.1.2.01.02", "descricao": "Fornecedores Exterior", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.1.2.02", "descricao": "Contas a Pagar", "tipo": "Sintética", "plano": "Passivo"},
    {"codigo": "2.1.2.02.01", "descricao": "Aluguéis e Arrendamentos a Pagar", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.1.2.02.02", "descricao": "Adiantamento de Clientes", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.1.2.02.03", "descricao": "Outras Contas a Pagar", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.1.3", "descricao": "Empréstimos e Financiamentos (CP)", "tipo": "Sintética", "plano": "Passivo"},
    {"codigo": "2.1.3.01", "descricao": "Empréstimos de Terceiros", "tipo": "Sintética", "plano": "Passivo"},
    {"codigo": "2.1.3.01.01", "descricao": "Duplicatas Descontadas", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.1.3.01.02", "descricao": "Empréstimos e Financiamentos", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.1.4", "descricao": "Obrigações Fiscais", "tipo": "Sintética", "plano": "Passivo"},
    {"codigo": "2.1.4.01", "descricao": "Retenções a Recolher", "tipo": "Sintética", "plano": "Passivo"},
    {"codigo": "2.1.4.01.01", "descricao": "IRRF", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.1.4.01.02", "descricao": "CSRF", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.1.4.01.03", "descricao": "ISS retido na Fonte", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.1.4.01.04", "descricao": "INSS retido na Fonte", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.1.4.02", "descricao": "Impostos a Pagar", "tipo": "Sintética", "plano": "Passivo"},
    {"codigo": "2.1.4.02.01", "descricao": "IRPJ", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.1.4.02.02", "descricao": "CSLL", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.1.4.02.03", "descricao": "PIS", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.1.4.02.04", "descricao": "COFINS", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.1.4.02.05", "descricao": "IPI", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.1.4.02.06", "descricao": "ICMS", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.1.4.02.07", "descricao": "IOF", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.1.4.02.08", "descricao": "ISS", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.1.4.02.09", "descricao": "Tributos Municipais", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.1.4.02.10", "descricao": "Simples Nacional", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.1.4.03", "descricao": "Parcelamentos Fiscais", "tipo": "Sintética", "plano": "Passivo"},
    {"codigo": "2.1.4.03.01", "descricao": "Tributos Federais", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.1.4.03.02", "descricao": "Tributos Estaduais e Municipais", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.1.5", "descricao": "Provisões", "tipo": "Sintética", "plano": "Passivo"},
    {"codigo": "2.1.5.01", "descricao": "Provisões Tributárias", "tipo": "Sintética", "plano": "Passivo"},
    {"codigo": "2.1.5.01.01", "descricao": "IRPJ", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.1.5.01.02", "descricao": "CSLL", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.1.6", "descricao": "Outras Obrigações", "tipo": "Sintética", "plano": "Passivo"},
    {"codigo": "2.1.6.01", "descricao": "Obrigações com Sócios", "tipo": "Sintética", "plano": "Passivo"},
    {"codigo": "2.1.6.01.01", "descricao": "Lucros a Pagar", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.1.6.01.02", "descricao": "Mútuo com Partes Relacionadas", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.2", "descricao": "Passivo Não Circulante", "tipo": "Sintética", "plano": "Passivo"},
    {"codigo": "2.2.1", "descricao": "Obrigações com Terceiros LP", "tipo": "Sintética", "plano": "Passivo"},
    {"codigo": "2.2.1.01", "descricao": "Fornecedores LP", "tipo": "Sintética", "plano": "Passivo"},
    {"codigo": "2.2.1.01.01", "descricao": "Fornecedores Nacionais", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.2.1.01.02", "descricao": "Fornecedores Exterior", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.2.1.01.03", "descricao": "Juros a apropriar Obrigações LP", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.2.1.02", "descricao": "Empréstimos e Financiamentos LP", "tipo": "Sintética", "plano": "Passivo"},
    {"codigo": "2.2.1.02.01", "descricao": "Empréstimos e Financiamentos LP", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.2.1.02.02", "descricao": "Duplicatas Descontadas LP", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.2.1.02.03", "descricao": "Juros a apropriar Empréstimos LP", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.2.2", "descricao": "Obrigações Fiscais (LP)", "tipo": "Sintética", "plano": "Passivo"},
    {"codigo": "2.2.2.01", "descricao": "Parcelamentos Fiscais (LP)", "tipo": "Sintética", "plano": "Passivo"},
    {"codigo": "2.2.2.01.01", "descricao": "Tributos Federais LP", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.2.2.01.02", "descricao": "Tributos Estaduais e Municipais LP", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.2.2.01", "descricao": "Tributos Diferidos", "tipo": "Sintética", "plano": "Passivo"},
    {"codigo": "2.2.2.01.01", "descricao": "IRPJ Diferido", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.2.2.01.02", "descricao": "CSLL Diferido", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.2.3", "descricao": "Outras Obrigações de LP", "tipo": "Sintética", "plano": "Passivo"},
    {"codigo": "2.2.3.01", "descricao": "Obrigações com Partes Relacionadas", "tipo": "Sintética", "plano": "Passivo"},
    {"codigo": "2.2.2.01.01", "descricao": "Empréstimos de Sócios", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.2.2.01.02", "descricao": "Mútuos com Partes Relacionadas", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.2.2.01.03", "descricao": "Juros a Apropriar Partes Relacionadas", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.3", "descricao": "Patrimônio Líquido", "tipo": "Sintética", "plano": "Passivo"},
    {"codigo": "2.3.1", "descricao": "Capital Social Integralizado", "tipo": "Sintética", "plano": "Passivo"},
    {"codigo": "2.3.1.01", "descricao": "Capital Social Subscrito", "tipo": "Sintética", "plano": "Passivo"},
    {"codigo": "2.3.1.01.01", "descricao": "Capital Social Subscrito", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.8.1.02", "descricao": "Capital Social a Integralizar", "tipo": "Sintética", "plano": "Passivo"},
    {"codigo": "2.8.1.02.01", "descricao": "Capital Social a Integralizar", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.8.2", "descricao": "Reservas de Capital", "tipo": "Sintética", "plano": "Passivo"},
    {"codigo": "2.8.2.01", "descricao": "Adiantamento de Capital", "tipo": "Sintética", "plano": "Passivo"},
    {"codigo": "2.8.2.01.01", "descricao": "Adiantamento para Futuro Aumento de Capital", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.8.3", "descricao": "Reservas de Lucro", "tipo": "Sintética", "plano": "Passivo"},
    {"codigo": "2.8.3.01", "descricao": "Lucros a Distribuir", "tipo": "Sintética", "plano": "Passivo"},
    {"codigo": "2.8.3.01.01", "descricao": "Lucros a Distribuir", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.8.8", "descricao": "Resultados Acumulados", "tipo": "Sintética", "plano": "Passivo"},
    {"codigo": "2.8.8.01", "descricao": "Lucros Acumulados", "tipo": "Sintética", "plano": "Passivo"},
    {"codigo": "2.8.8.01.01", "descricao": "Lucros Acumulados", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "2.8.8.02", "descricao": "Prejuízos Acumulados", "tipo": "Sintética", "plano": "Passivo"},
    {"codigo": "2.8.8.02.01", "descricao": "Prejuízos Acumulados", "tipo": "Analítica", "plano": "Passivo"},
    {"codigo": "3", "descricao": "Resultado", "tipo": "Sintética", "plano": "Resultado"},
    {"codigo": "3.1", "descricao": "RECEITAS", "tipo": "Sintética", "plano": "Resultado"},
    {"codigo": "3.1.1", "descricao": "RECEITA BRUTA", "tipo": "Sintética", "plano": "Resultado"},
    {"codigo": "3.1.1.01", "descricao": "RECEITA BRUTA OPERACIONAL", "tipo": "Sintética", "plano": "Resultado"},
    {"codigo": "3.1.1.01.01", "descricao": "Serviços Prestados", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.1.1.01.02", "descricao": "Mercadorias Vendidas", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.1.1.01.03", "descricao": "Produtos Vendidos", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.1.2", "descricao": "DEDUÇÕES DA RECEITA BRUTA", "tipo": "Sintética", "plano": "Resultado"},
    {"codigo": "3.1.2.01", "descricao": "IMPOSTOS S/ FATURAMENTO", "tipo": "Sintética", "plano": "Resultado"},
    {"codigo": "3.1.2.01.01", "descricao": "PIS", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.1.2.01.02", "descricao": "COFINS", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.1.2.01.03", "descricao": "ISS", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.1.2.01.04", "descricao": "ICMS", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.1.2.01.05", "descricao": "SIMPLES NACIONAL", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.1.2.02", "descricao": "OUTRAS DEDUÇÕES DA RECEITA BRUTA", "tipo": "Sintética", "plano": "Resultado"},
    {"codigo": "3.1.2.02.01", "descricao": "DESCONTOS E ABATIMENTOS", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.1.2.02.02", "descricao": "DEVOLUÇÕES", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.1.2.02.03", "descricao": "JUROS DE AVP", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.2", "descricao": "Custos", "tipo": "Sintética", "plano": "Resultado"},
    {"codigo": "3.2.1", "descricao": "Custos dos bens e serviços", "tipo": "Sintética", "plano": "Resultado"},
    {"codigo": "3.2.1.01", "descricao": "Custos dos bens e serviços vendidos", "tipo": "Sintética", "plano": "Resultado"},
    {"codigo": "3.2.1.01.01", "descricao": "Custos dos Produtos Vendidos", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.2.1.01.02", "descricao": "Custos das Mercadorias Vendidas", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.2.1.01.03", "descricao": "Custos dos Serviços Prestados", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3", "descricao": "Despesas Operacionais", "tipo": "Sintética", "plano": "Resultado"},
    {"codigo": "3.3.1", "descricao": "Despesas com Vendas", "tipo": "Sintética", "plano": "Resultado"},
    {"codigo": "3.3.1.01", "descricao": "Despesas com Pessoal", "tipo": "Sintética", "plano": "Resultado"},
    {"codigo": "3.3.1.01.01", "descricao": "Salários", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.1.01.02", "descricao": "Gratificações", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.1.01.03", "descricao": "Férias", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.1.01.04", "descricao": "13º Salário", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.1.01.05", "descricao": "INSS", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.1.01.06", "descricao": "FGTS", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.1.01.07", "descricao": "Vale Refeição/Refeitório", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.1.01.08", "descricao": "Vale Transporte", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.1.01.09", "descricao": "Assistência Médica", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.1.01.10", "descricao": "Seguro de Vida", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.1.01.11", "descricao": "Treinamento", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.1.02", "descricao": "Outras Despesas com Vendas", "tipo": "Sintética", "plano": "Resultado"},
    {"codigo": "3.3.1.02.01", "descricao": "Comissões sobre Vendas", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.1.02.02", "descricao": "Propaganda e publicidade", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.1.02.03", "descricao": "Brindes e material promocional", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.2", "descricao": "Despesas Administrativas", "tipo": "Sintética", "plano": "Resultado"},
    {"codigo": "3.3.2.01", "descricao": "Despesas com Pessoal", "tipo": "Sintética", "plano": "Resultado"},
    {"codigo": "3.3.2.01.01", "descricao": "Salários", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.2.01.02", "descricao": "Gratificações", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.2.01.03", "descricao": "Férias", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.2.01.04", "descricao": "13º Salário", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.2.01.05", "descricao": "INSS", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.2.01.06", "descricao": "FGTS", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.2.01.07", "descricao": "Vale Refeiçãoo/Refeitório", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.2.01.08", "descricao": "Vale Transporte", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.2.01.09", "descricao": "Assistência Médica", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.2.01.10", "descricao": "Seguro de Vida", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.2.01.11", "descricao": "Treinamento", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.2.01.12", "descricao": "Pro Labore", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.2.02", "descricao": "Despesas Gerais", "tipo": "Sintética", "plano": "Resultado"},
    {"codigo": "3.3.2.02.01", "descricao": "Aluguéis e Arrendamentos", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.2.02.02", "descricao": "Condomínios e Estacionamentos", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.2.02.03", "descricao": "Despesas com Veículos", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.2.02.04", "descricao": "Depreciação", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.2.02.05", "descricao": "Amortização", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.2.02.06", "descricao": "Serviços Profissionais Contratados", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.2.02.07", "descricao": "Energia", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.2.02.08", "descricao": "Água e Esgoto", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.2.02.09", "descricao": "Telefone e Internet", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.2.02.10", "descricao": "Correios e Malotes", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.2.02.11", "descricao": "Seguros", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.2.02.12", "descricao": "Multas", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.2.02.13", "descricao": "Bens de Pequeno Valor", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.2.02.14", "descricao": "Material de Escritório", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.2.03", "descricao": "Tributos e Contribuições", "tipo": "Sintética", "plano": "Resultado"},
    {"codigo": "3.3.2.03.01", "descricao": "Taxas e Tributos Municipais", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.2.03.02", "descricao": "PIS s/ Outras Receitas", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.2.03.03", "descricao": "COFINS s/ Outras Receitas", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.9", "descricao": "Outros Resultados Operacionais", "tipo": "Sintética", "plano": "Resultado"},
    {"codigo": "3.3.9.01", "descricao": "Ganhos e Perdas de Capital", "tipo": "Sintética", "plano": "Resultado"},
    {"codigo": "3.3.9.01.01", "descricao": "Receita na Venda de Imobilizado", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.9.01.02", "descricao": "Custo do Imobilizado Baixado", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.9.02", "descricao": "Perdas", "tipo": "Sintética", "plano": "Resultado"},
    {"codigo": "3.3.9.02.01", "descricao": "PECLD", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.9.02.02", "descricao": "Perda de recuperabilidade (Impairment)", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.9.03", "descricao": "Resultado de Participação em Outras Sociedades", "tipo": "Sintética", "plano": "Resultado"},
    {"codigo": "3.3.9.03.01", "descricao": "Resultado Positivo de Equivalência Patrimonial", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.3.9.03.02", "descricao": "Resultado Negativo de Equivalência Patrimonial", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.4", "descricao": "Resultado Financeiro", "tipo": "Sintética", "plano": "Resultado"},
    {"codigo": "3.4.1", "descricao": "Encargos Financeiros Líquidos", "tipo": "Sintética", "plano": "Resultado"},
    {"codigo": "3.4.1.01", "descricao": "Despesas Financeiras", "tipo": "Sintética", "plano": "Resultado"},
    {"codigo": "3.4.1.01.01", "descricao": "Juros Passivos", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.4.1.01.02", "descricao": "Despesas Bancárias", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.4.1.01.03", "descricao": "IOF", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.4.1.01.04", "descricao": "Descontos Concedidos", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.4.1.01.05", "descricao": "Variação Cambial Passiva", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.4.1.02", "descricao": "Receitas Financeiras", "tipo": "Sintética", "plano": "Resultado"},
    {"codigo": "3.4.1.02.01", "descricao": "Rendimentos de Aplicação Financeira", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.4.1.02.02", "descricao": "Juros Ativos", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.4.1.02.03", "descricao": "Descontos Obtidos", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.4.1.02.04", "descricao": "Variação Cambial Ativa", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.8", "descricao": "Provisão de Impostos", "tipo": "Sintética", "plano": "Resultado"},
    {"codigo": "3.8.1", "descricao": "Tributos sobre Lucro", "tipo": "Sintética", "plano": "Resultado"},
    {"codigo": "3.8.1.01", "descricao": "Impostos", "tipo": "Sintética", "plano": "Resultado"},
    {"codigo": "3.8.1.01.01", "descricao": "IRPJ Corrente", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.8.1.01.02", "descricao": "CSLL Corrente", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.8.1.01.03", "descricao": "IRPJ Diferido", "tipo": "Analítica", "plano": "Resultado"},
    {"codigo": "3.8.1.01.04", "descricao": "CSLL Diferido", "tipo": "Analítica", "plano": "Resultado"},
]

    try:
        conn = Var_ConectarBanco()
        cursor = conn.cursor()

        for conta in modelo_itg:
            nivel = conta["codigo"].count('.') + 1

            # Verifica se já existe o código para a empresa
            cursor.execute("""
                SELECT 1 FROM tbl_hub_plano_contas
                WHERE id_empresa = %s AND codigo = %s
            """, (id_empresa, conta["codigo"]))

            if cursor.fetchone():
                continue  # pula se já existe

            cursor.execute("""
                INSERT INTO tbl_hub_plano_contas
                (codigo, descricao, tipo, nivel, id_empresa, status, plano)
                VALUES (%s, %s, %s, %s, %s, TRUE, %s)
                ON CONFLICT (id_empresa, plano, codigo) DO NOTHING
            """, (
                conta["codigo"], conta["descricao"], conta["tipo"],
                nivel, id_empresa, conta["plano"]
            ))


        conn.commit()
        return jsonify({"success": True, "mensagem": "Plano de contas padrão criado com sucesso."})

    except Exception as e:
        conn.rollback()
        print("❌ Erro:", e)
        return jsonify({"success": False, "mensagem": "Erro ao cadastrar plano padrão."}), 500


# ────────────────────────────────────────────────
# Rotas para categoria em HUB
# ────────────────────────────────────────────────
@mod_hub_bp.route("/categoria/dados")
@login_obrigatorio
def categoria_dados():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()

    # --- sessão / multiempresa ---
    id_empresa = session.get("id_empresa")
    if not id_empresa:
        conn.close()
        return jsonify({"sucesso": False, "mensagem": "Sessão inválida"}), 401

    # --- query params (front manda 1-based) ---
    try:
        pagina = int(request.args.get("pagina", 1))
    except (TypeError, ValueError):
        pagina = 1

    try:
        por_pagina = int(request.args.get("porPagina", 20))
    except (TypeError, ValueError):
        por_pagina = 20

    # clamps
    if pagina < 1:
        pagina = 1
    if por_pagina < 1:
        por_pagina = 20
    if por_pagina > 200:
        por_pagina = 200

    nome = (request.args.get("nome", "") or "").strip()
    status_raw = (request.args.get("status", "") or "").strip().lower()

    # aceita "true/false" ou "1/0"
    status_val = None
    if status_raw in ("1", "true", "t", "ativo"):
        status_val = True
    elif status_raw in ("0", "false", "f", "inativo"):
        status_val = False
    # se None, não filtra por status

    # --- SQL base (sem paginação) ---
    sql_base = """
        SELECT
            c.id,
            c.nome_categoria,
            c.status,
            COUNT(cc.id) AS quantidade_contas
        FROM tbl_hub_categoria c
        LEFT JOIN tbl_hub_categoria_conta cc
          ON cc.id_categoria = c.id
         AND cc.id_empresa   = c.id_empresa
        WHERE c.id_empresa = %s
    """
    valores = [id_empresa]

    if nome:
        sql_base += " AND c.nome_categoria ILIKE %s"
        valores.append(f"%{nome}%")

    if status_val is not None:
        sql_base += " AND c.status = %s"
        valores.append(status_val)

    sql_group = " GROUP BY c.id, c.nome_categoria, c.status "

    # --- total ---
    sql_total = f"SELECT COUNT(*) FROM ({sql_base + sql_group}) AS sub"
    cursor.execute(sql_total, valores)
    total_registros = cursor.fetchone()[0] or 0
    total_paginas = max(1, (total_registros + por_pagina - 1) // por_pagina) if total_registros else 1

    # se a página pedida estourou, ajusta para a última válida
    if pagina > total_paginas:
        pagina = total_paginas

    # --- paginação segura ---
    offset = (pagina - 1) * por_pagina  # com pagina>=1, nunca negativo

    # --- consulta paginada ---
    sql_page = (
        sql_base
        + sql_group
        + " ORDER BY c.id DESC "
        + " LIMIT %s OFFSET %s "
    )
    valores_page = valores + [por_pagina, offset]

    cursor.execute(sql_page, valores_page)
    colunas = [desc[0] for desc in cursor.description]
    registros = [dict(zip(colunas, linha)) for linha in cursor.fetchall()]

    conn.close()

    return jsonify({
        "sucesso": True,
        "pagina": pagina,                 # 1-based
        "por_pagina": por_pagina,
        "total_registros": total_registros,
        "total_paginas": total_paginas,
        "dados": registros
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
@login_obrigatorio()
def categoria_salvar():
    from flask import current_app, jsonify, request, session
    import psycopg2
    from psycopg2 import errorcodes

    id_empresa = session.get("id_empresa")
    if not id_empresa:
        return jsonify({"sucesso": False, "mensagem": "Sessão expirada."}), 401

    conn = None
    try:
        d = request.get_json(silent=True) or {}
        cid   = int(d.get("id") or 0)
        nome  = (d.get("nome") or "").strip()

        # normaliza boolean (aceita "true"/"false", 1/0, t/f)
        raw_status = str(d.get("status", "true")).strip().lower()
        status = raw_status in ("true", "1", "t", "on", "yes", "y")

        observ = (d.get("observacoes") or "").strip()

        if len(nome) < 3:
            return jsonify({"sucesso": False, "mensagem": "Nome inválido."}), 400

        conn = Var_ConectarBanco()
        cur  = conn.cursor()

        if cid:
            # UPDATE (pode disparar 23505 se trocar p/ nome já existente na mesma empresa)
            cur.execute("""
                UPDATE tbl_hub_categoria
                   SET nome_categoria = %s,
                       status         = %s,
                       observacoes    = %s
                 WHERE id = %s
                   AND id_empresa = %s
            """, (nome, status, observ, cid, id_empresa))
            if cur.rowcount == 0:
                return jsonify({"sucesso": False, "mensagem": "Categoria não encontrada."}), 404
        else:
            # INSERT (pode disparar 23505 se já existir)
            cur.execute("""
                INSERT INTO tbl_hub_categoria
                    (id_empresa, nome_categoria, status, observacoes)
                VALUES (%s, %s, %s, %s)
                RETURNING id
            """, (id_empresa, nome, status, observ))
            cid = cur.fetchone()[0]

        conn.commit()
        return jsonify({"sucesso": True, "mensagem": "Categoria salva com sucesso.", "id": cid})

    except psycopg2.IntegrityError as e:
        # Violações de integridade (inclui UNIQUE)
        if conn:
            try: conn.rollback()
            except: pass

        if getattr(e, "pgcode", None) == errorcodes.UNIQUE_VIOLATION:
            # Constraint: UNIQUE (id_empresa, nome_categoria)
            return jsonify({
                "sucesso": False,
                "mensagem": "Já existe uma categoria com este nome para sua empresa."
            }), 409

        current_app.logger.exception("IntegrityError ao salvar categoria: %s", e)
        return jsonify({"sucesso": False, "mensagem": "Erro de integridade ao salvar."}), 500

    except Exception as e:
        if conn:
            try: conn.rollback()
            except: pass
        current_app.logger.exception("Erro ao salvar categoria: %s", e)
        return jsonify({"sucesso": False, "mensagem": "Erro inesperado ao salvar."}), 500

    finally:
        if conn:
            try: conn.close()
            except: pass




@mod_hub_bp.route("/categoria/apoio", methods=["POST"])
@login_obrigatorio()
def categoria_apoio():
    from flask import current_app, jsonify, request, session

    id_empresa = session.get("id_empresa")
    if not id_empresa:
        return jsonify({"sucesso": False, "mensagem": "Sessão expirada."}), 401

    dados = request.get_json(silent=True) or {}
    try:
        cid = int(dados.get("id") or 0)
    except (TypeError, ValueError):
        return jsonify({"sucesso": False, "mensagem": "ID inválido."}), 400
    if cid <= 0:
        return jsonify({"sucesso": False, "mensagem": "ID não informado."}), 400

    conn = None
    try:
        conn = Var_ConectarBanco(); cur = conn.cursor()
        cur.execute("""
            SELECT id, nome_categoria, status, observacoes
              FROM tbl_hub_categoria
             WHERE id = %s
               AND id_empresa = %s
        """, (cid, id_empresa))
        r = cur.fetchone()
        if not r:
            return jsonify({"sucesso": False, "mensagem": "Categoria não encontrada."}), 404

        status_val = r[2]
        status_bool = (
            True if status_val is True else
            False if status_val is False else
            str(status_val).strip().lower() in ("1", "true", "ativo")
        )

        return jsonify({
            "sucesso": True,
            "dados": {
                "id": r[0],
                "nome_categoria": r[1],
                "status": status_bool,
                "observacoes": r[3] or ""
            }
        })
    except Exception as e:
        current_app.logger.exception("Erro ao carregar categoria: %s", e)
        return jsonify({"sucesso": False, "mensagem": "Erro ao carregar categoria."}), 500
    finally:
        try:
            if conn: conn.close()
        except: pass





# 
@mod_hub_bp.route("/categoria/delete", methods=["POST"])
@login_obrigatorio()
def categoria_delete():
    from flask import current_app

    id_empresa = session.get("id_empresa")
    if not id_empresa:
        return jsonify({"sucesso": False, "mensagem": "Sessão expirada."}), 401

    dados = request.get_json(silent=True) or {}
    try:
        cid = int(dados.get("id") or 0)
    except (TypeError, ValueError):
        return jsonify({"sucesso": False, "mensagem": "ID inválido."}), 400
    if cid <= 0:
        return jsonify({"sucesso": False, "mensagem": "ID não informado."}), 400

    conn = Var_ConectarBanco()
    cur  = conn.cursor()
    try:
        cur.execute(
            "DELETE FROM tbl_hub_categoria WHERE id = %s AND id_empresa = %s",
            (cid, id_empresa)
        )
        conn.commit()
        return jsonify({"sucesso": True, "mensagem": "Categoria excluída com sucesso."})
    except Exception as e:
        current_app.logger.exception("Erro ao excluir categoria: %s", e)
        try: conn.rollback()
        except: pass
        return jsonify({"sucesso": False, "mensagem": "Erro ao excluir."}), 500
    finally:
        try: conn.close()
        except: pass






@mod_hub_bp.route("/categoria/Combobox/ondeusa", methods=["GET"])
@login_obrigatorio()
def categoria_combobox_ondeusa():
    conn = Var_ConectarBanco(); cur = conn.cursor()
    cur.execute("""
        SELECT id, nome_menu
          FROM tbl_menu
         WHERE pai = TRUE
           AND COALESCE(status, TRUE) = TRUE
         ORDER BY nome_menu ASC
    """)
    out = [{"id": r[0], "nome": r[1]} for r in cur.fetchall()]
    conn.close()
    return jsonify(out)



# ────────────────────────────────────────────
# Rotas para CONTAS CONTÁBEIS em HUB
# ────────────────────────────────────────────

@mod_hub_bp.route("/categoria/conta/dados")
@login_obrigatorio
def categoria_conta_dados():
    conn = None
    try:
        id_empresa = session.get("id_empresa")
        if not id_empresa:
            return jsonify([]), 401

        id_categoria = request.args.get("id_categoria", type=int)
        if not id_categoria:
            return jsonify([])

        conn = Var_ConectarBanco()
        cur  = conn.cursor()

        sql = """
        SELECT v.id,
               v.id_menu_onde_usa,
               v.tipo_plano,
               v.id_conta_contabil,
               v.status,
               m.nome_menu AS onde_usa,            -- <- aqui
               pc.codigo   AS codigo_conta,
               pc.descricao AS descricao_conta
          FROM tbl_hub_categoria_conta v
          LEFT JOIN tbl_menu m
                 ON m.id = v.id_menu_onde_usa
                AND m.pai = TRUE                 -- só menus “pai”
                AND m.status = TRUE              -- (opcional, mas recomendado)
          LEFT JOIN tbl_hub_plano_contas pc
                 ON pc.id = v.id_conta_contabil
                AND pc.id_empresa = v.id_empresa
         WHERE v.id_empresa   = %s
           AND v.id_categoria = %s
         ORDER BY v.id DESC
        """
        cur.execute(sql, (id_empresa, id_categoria))
        rows = cur.fetchall()

        lista = []
        for (id_, id_onde, tipo_plano, id_pc, status, onde_usa, cod, desc) in rows:
            lista.append({
                "id": id_,
                "id_menu_onde_usa": id_onde,
                "onde_usa": onde_usa or "",
                "tipo_plano": tipo_plano,
                "id_conta_contabil": id_pc,
                "codigo_conta": cod,
                "descricao_conta": desc,
                "status": bool(status),
            })
        return jsonify(lista)
    except Exception as e:
        import traceback, sys
        print("ERRO /categoria/conta/dados:", e, file=sys.stderr)
        traceback.print_exc()
        return jsonify([]), 200
    finally:
        if conn:
            conn.close()



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
@login_obrigatorio()
def categoria_conta_salvar():
    id_empresa = session.get("id_empresa")
    d = request.get_json() or {}
    id_categoria = int(d.get("id_categoria") or 0)
    id_menu     = int(d.get("id_menu_onde_usa") or 0)
    id_conta    = int(d.get("id_conta_contabil") or 0)
    tipo_plano  = (d.get("tipo_plano") or "").strip()
    status      = bool(d.get("status", True))

    if not id_categoria or not id_menu or not id_conta or not tipo_plano:
        return jsonify({"retorno": False, "msg": "Preencha todos os campos obrigatórios."}), 400

    conn = Var_ConectarBanco(); cur = conn.cursor()

    # valida menu (tbl_menu é genérica; sem filtro por empresa)
    cur.execute("SELECT 1 FROM tbl_menu WHERE id=%s AND pai=TRUE", (id_menu,))
    if not cur.fetchone():
        conn.close(); return jsonify({"retorno": False, "msg": "Menu inválido."}), 400

    # (se quiser impedir duplicidade por categoria/menu)
    cur.execute("""
        SELECT 1 FROM tbl_hub_categoria_conta
         WHERE id_empresa=%s AND id_categoria=%s AND id_menu_onde_usa=%s AND id_conta_contabil=%s
    """, (id_empresa, id_categoria, id_menu, id_conta))
    if cur.fetchone():
        conn.close(); return jsonify({"retorno": False, "msg": "Vínculo já existe para esta conta."}), 409

    cur.execute("""
        INSERT INTO tbl_hub_categoria_conta
            (id_categoria, id_menu_onde_usa, id_conta_contabil, tipo_plano, id_empresa, status)
        VALUES (%s, %s, %s, %s, %s, %s)
    """, (id_categoria, id_menu, id_conta, tipo_plano, id_empresa, status))
    conn.commit(); conn.close()
    return jsonify({"retorno": True, "msg": "Vínculo salvo com sucesso."})




@mod_hub_bp.route("/categoria/conta/ativar", methods=["POST"])
@login_obrigatorio()
def categoria_conta_ativar():
    id_empresa = session.get("id_empresa")
    _id = (request.get_json() or {}).get("id")
    conn = Var_ConectarBanco(); cur = conn.cursor()
    cur.execute("""
        UPDATE tbl_hub_categoria_conta
           SET status = NOT status
         WHERE id = %s AND id_empresa = %s
        RETURNING status
    """, (_id, id_empresa))
    row = cur.fetchone(); conn.commit(); conn.close()
    if not row: return jsonify({"retorno": False, "msg": "Registro não encontrado."}), 404
    return jsonify({"retorno": True, "msg": ("Ativado" if row[0] else "Inativado") + " com sucesso."})


@mod_hub_bp.route("/categoria/conta/delete", methods=["POST"])
@login_obrigatorio()
def categoria_conta_delete():
    id_empresa = session.get("id_empresa")
    _id = (request.get_json() or {}).get("id")
    conn = Var_ConectarBanco(); cur = conn.cursor()
    cur.execute("DELETE FROM tbl_hub_categoria_conta WHERE id=%s AND id_empresa=%s", (_id, id_empresa))
    apagados = cur.rowcount; conn.commit(); conn.close()
    if not apagados: return jsonify({"retorno": False, "msg": "Registro não encontrado."}), 404
    return jsonify({"retorno": True, "msg": "Vínculo excluído com sucesso."})




# COMBOBOX: Plano de Contas (autocomplete, nível 5 + ancestrais)
@mod_hub_bp.route("/categoria/combobox/plano_contas", methods=["POST"])
@login_obrigatorio
def combobox_plano_contas():
    conn = None
    try:
        id_empresa = session.get("id_empresa")
        if not id_empresa:
            return jsonify({"retorno": False, "msg": "Sessão expirada"}), 401

        dados   = request.get_json(silent=True) or {}
        termo   = (dados.get("q") or "").strip()
        limite  = int(dados.get("limite") or 20)
        plano   = (request.args.get("tipo") or dados.get("tipo") or "").strip()  # Ativo/Passivo/Resultado

        if len(termo) < 3 or not plano:
            return jsonify({"retorno": True, "itens": []})

        conn = Var_ConectarBanco()
        cur  = conn.cursor()

        # checa unaccent
        cur.execute("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname='unaccent')")
        usa_unaccent = cur.fetchone()[0]

        filtro_desc = "p.descricao ILIKE %s"
        termo_desc  = f"%{termo}%"
        termo_cod   = f"%{termo}%"
        if usa_unaccent:
            filtro_desc = "unaccent(p.descricao) ILIKE unaccent(%s)"

        sql = f"""
        WITH RECURSIVE folhas AS (
            SELECT p.id, p.codigo, p.descricao, p.nivel
              FROM tbl_hub_plano_contas p
             WHERE p.id_empresa = %s
               AND p.plano      = %s
               AND p.nivel      = 5
               AND p.status     = TRUE
               AND (
                    {filtro_desc}
                 OR p.codigo ILIKE %s
               )
             ORDER BY p.codigo
             LIMIT %s
        ),
        arvore (id_folha, codigo_item, nivel_item, ordem) AS (
            -- termo base: padroniza tipos
            SELECT f.id::int,
                   f.codigo::text,
                   f.nivel::int,
                   1::int
              FROM folhas f
            UNION ALL
            -- termo recursivo: remove o último ".segmento"
            SELECT a.id_folha,
                   regexp_replace(a.codigo_item, E'\\.[^.]+$', '')::text,
                   (a.nivel_item - 1)::int,
                   (a.ordem + 1)::int
              FROM arvore a
             WHERE a.nivel_item > 1
        )
        SELECT a.id_folha,
               p.codigo,
               p.descricao,
               a.nivel_item,
               a.ordem
          FROM arvore a
          JOIN tbl_hub_plano_contas p
            ON p.id_empresa = %s
           AND p.plano      = %s
           AND p.codigo::text = a.codigo_item
         ORDER BY a.id_folha, a.ordem;
        """
        params = (id_empresa, plano, termo_desc, termo_cod, limite, id_empresa, plano)
        cur.execute(sql, params)
        rows = cur.fetchall()

        itens = []
        atual_id = None
        linhas = []
        codigo_folha = None
        desc_folha = None

        def push_item():
            if not linhas:
                return
            payload = {
                "id": atual_id,
                "codigo": codigo_folha,
                "descricao_final": desc_folha
            }
            # monta n5, n4, n3, n2 (ordem já vem do recursivo)
            for idx, txt in enumerate(linhas[:5], start=0):
                payload[f"n{5 - idx}"] = txt
            itens.append(payload)

        for id_folha, codigo, desc, nivel, ordem in rows:
            if atual_id is None:
                atual_id = id_folha
                linhas = []
                codigo_folha = None
                desc_folha = None

            if id_folha != atual_id:
                push_item()
                atual_id = id_folha
                linhas = []
                codigo_folha = None
                desc_folha = None

            linhas.append(f"{codigo} - {desc}")
            if nivel == 5:
                codigo_folha = codigo
                desc_folha = desc

        push_item()
        return jsonify({"retorno": True, "itens": itens})

    except Exception as e:
        import traceback, sys
        print("ERRO combobox_plano_contas:", e, file=sys.stderr)
        traceback.print_exc()
        return jsonify({"retorno": False, "msg": "Erro ao buscar plano de contas"}), 500
    finally:
        if conn:
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
    conn = None
    try:
        id_empresa = session.get("id_empresa")
        if not id_empresa:
            return jsonify({"erro": "Sessão expirada"}), 401  # fail-fast

        conn = Var_ConectarBanco()
        cursor = conn.cursor()

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
                COALESCE(cat.nome_categoria, '') AS categoria_nome  
            FROM tbl_hub_favorecido f
            LEFT JOIN tbl_hub_categoria cat
                   ON cat.id = f.id_categoria
                  AND cat.id_empresa = f.id_empresa
            WHERE f.id = %s
              AND f.id_empresa = %s
        """, (id, id_empresa))

        row = cursor.fetchone()
        if not row:
            return jsonify({"erro": "Favorecido não encontrado."}), 404

        colunas = [desc[0] for desc in cursor.description]
        return jsonify(dict(zip(colunas, row)))

    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    finally:
        if conn:
            conn.close()



@mod_hub_bp.route("/hub/categoria/lookup", methods=["POST"])
@login_obrigatorio
def hub_categoria_lookup():
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    id_empresa = session.get("id_empresa")

    dados = request.get_json(silent=True) or {}
    q = (dados.get("q") or "").strip()
    limite = int(dados.get("limite") or 20)

    if len(q) < 2:
        return jsonify({"retorno": True, "itens": []})

    cursor.execute("""
        SELECT id, nome_categoria
          FROM tbl_hub_categoria
         WHERE id_empresa = %s
           AND status = TRUE
           AND unaccent(nome_categoria) ILIKE unaccent(%s)
         ORDER BY nome_categoria
         LIMIT %s
    """, (id_empresa, f"%{q}%", limite))

    itens = [{"id": r[0], "nome_categoria": r[1]} for r in cursor.fetchall()]
    return jsonify({"retorno": True, "itens": itens})




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
    return render_template("frm_hub_funcionario_apoio.html")


@mod_hub_bp.route("/funcionarios/editar")
@login_obrigatorio
def funcionarios_editar():
    return render_template("frm_hub_funcionario_apoio.html")


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




# ────────────────────────────────────────────────────────────────────────────
# HUB DEPARTAMENTOS
# ────────────────────────────────────────────────────────────────────────────
@mod_hub_bp.route("/hub_departamentos/dados", methods=["GET"])
@login_obrigatorio
def departamentos_dados():
    conn = None
    try:
        id_empresa = session.get("id_empresa")
        if not id_empresa:
            return jsonify({"erro": "Sessão expirada"}), 401

        dep_filtro = request.args.get("departamento", "").strip()
        status_filtro = request.args.get("status", "").strip()

        pagina = int(request.args.get("pagina", 1))
        por_pagina = int(request.args.get("porPagina", 20))
        offset = (pagina - 1) * por_pagina

        conn = Var_ConectarBanco()
        cur = conn.cursor()

        base_where = "WHERE id_empresa = %s"
        params = [id_empresa]

        if dep_filtro:
            base_where += " AND departamento ILIKE %s"
            params.append(f"%{dep_filtro}%")

        if status_filtro in ["true", "false"]:
            base_where += " AND status = %s"
            params.append(status_filtro == "true")

        # total
        cur.execute(f"SELECT COUNT(*) FROM tbl_hub_departamentos {base_where}", params)
        total_registros = cur.fetchone()[0]

        sql = f"""
            SELECT id, id_empresa, departamento, status, obs
              FROM tbl_hub_departamentos
              {base_where}
             ORDER BY departamento ASC
             LIMIT %s OFFSET %s
        """
        cur.execute(sql, params + [por_pagina, offset])
        linhas = cur.fetchall()

        lista = [
            {
                "id": l[0],
                "id_empresa": l[1],
                "departamento": l[2],
                "status": l[3],
                "obs": l[4] or ""
            } for l in linhas
        ]

        total_paginas = (total_registros // por_pagina) + (1 if total_registros % por_pagina else 0)

        return jsonify({
            "dados": lista,
            "total_paginas": total_paginas,
            "pagina_atual": pagina
        })
    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    finally:
        if conn: conn.close()




@mod_hub_bp.route("/hub_departamentos/novo")
@login_obrigatorio
def departamentos_novo():
    return render_template("frm_hub_departamentos_apoio.html")


@mod_hub_bp.route("/hub_departamentos/editar")
@login_obrigatorio
def departamentos_editar():
    return render_template("frm_hub_departamentos_apoio.html")



@mod_hub_bp.route("/hub_departamentos/apoio", methods=["POST"])
@login_obrigatorio
def departamentos_apoio():
    conn = None
    try:
        id_empresa = session.get("id_empresa")
        if not id_empresa:
            return jsonify({"erro": "Sessão expirada"}), 401

        id_dep = (request.get_json() or {}).get("id")
        if not id_dep:
            return jsonify({"erro": "ID não informado"}), 400

        conn = Var_ConectarBanco()
        cur = conn.cursor()
        cur.execute("""
            SELECT id, departamento, status, obs
              FROM tbl_hub_departamentos
             WHERE id = %s AND id_empresa = %s
        """, (id_dep, id_empresa))

        d = cur.fetchone()
        if not d:
            return jsonify({"erro": "Departamento não encontrado"}), 404

        return jsonify({
            "id": d[0],
            "departamento": d[1],
            "status": d[2],
            "obs": d[3] or ""
        })
    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    finally:
        if conn: conn.close()




@mod_hub_bp.route("/hub_departamentos/salvar", methods=["POST"])
@login_obrigatorio
def departamentos_salvar():
    conn = None
    try:
        id_empresa = session.get("id_empresa")
        if not id_empresa:
            return jsonify({"erro": "Sessão expirada"}), 401

        dados = request.get_json() or {}
        id_dep = dados.get("id")
        departamento = (dados.get("departamento") or "").strip().upper()
        status = bool(dados.get("status", True))
        obs = (dados.get("obs") or "").strip()

        if not departamento:
            return jsonify({"erro": "Campo 'departamento' é obrigatório"}), 400

        conn = Var_ConectarBanco()
        cur = conn.cursor()

        # checar duplicidade (unique id_empresa+departamento)
        cur.execute("""
            SELECT id FROM tbl_hub_departamentos
             WHERE departamento = %s AND id_empresa = %s
               AND (%s IS NULL OR id <> %s)
        """, (departamento, id_empresa, id_dep, id_dep))
        duplicado = cur.fetchone()
        if duplicado:
            return jsonify({"erro": "Já existe um departamento com esse nome nesta empresa."}), 409

        if id_dep:
            cur.execute("""
                UPDATE tbl_hub_departamentos
                   SET departamento=%s, status=%s, obs=%s
                 WHERE id=%s AND id_empresa=%s
            """, (departamento, status, obs, id_dep, id_empresa))
        else:
            cur.execute("""
                INSERT INTO tbl_hub_departamentos (id_empresa, departamento, status, obs)
                VALUES (%s, %s, %s, %s)
            """, (id_empresa, departamento, status, obs))

        conn.commit()
        return jsonify({"mensagem": "Departamento salvo com sucesso!"})
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"erro": str(e)}), 500
    finally:
        if conn: conn.close()



@mod_hub_bp.route("/hub_departamentos/excluir", methods=["POST"])
@login_obrigatorio
def departamentos_excluir():
    conn = None
    try:
        id_empresa = session.get("id_empresa")
        if not id_empresa:
            return jsonify({"erro": "Sessão expirada"}), 401

        id_dep = (request.get_json() or {}).get("id")
        if not id_dep:
            return jsonify({"erro": "ID não informado"}), 400

        conn = Var_ConectarBanco()
        cur = conn.cursor()
        cur.execute("""
            DELETE FROM tbl_hub_departamentos
             WHERE id=%s AND id_empresa=%s
        """, (id_dep, id_empresa))
        conn.commit()

        if cur.rowcount == 0:
            return jsonify({"erro": "Departamento não encontrado"}), 404

        return jsonify({"mensagem": "Departamento excluído com sucesso."})
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"erro": str(e)}), 500
    finally:
        if conn: conn.close()


# ────────────────────────────────────────────────────────────────────────────
# HUB PROJETOS
# ────────────────────────────────────────────────────────────────────────────

@mod_hub_bp.route("/projetos/dados", methods=["GET"])
@login_obrigatorio
def projetos_dados():
    conn = None
    try:
        id_empresa = session.get("id_empresa")
        if not id_empresa:
            return jsonify({"erro": "Sessão expirada"}), 401

        pagina = int(request.args.get("pagina", 1))
        por_pagina = int(request.args.get("porPagina", 20))
        offset = (pagina - 1) * por_pagina

        nome = (request.args.get("nome") or "").strip()
        status = (request.args.get("status") or "").strip()   # "true" | "false" | ""

        wh = ["id_empresa = %s"]
        params = [id_empresa]

        if nome:
            wh.append("nome_projeto ILIKE %s")
            params.append(f"%{nome}%")

        if status in ("true", "false"):
            wh.append("status = %s")
            params.append(True if status == "true" else False)

        where_sql = "WHERE " + " AND ".join(wh)

        conn = Var_ConectarBanco()
        cur = conn.cursor()

        # total
        cur.execute(f"SELECT COUNT(*) FROM tbl_hub_projetos {where_sql}", params)
        total = cur.fetchone()[0]

        # página
        cur.execute(f"""
            SELECT id, nome_projeto, obs, status
              FROM tbl_hub_projetos
            {where_sql}
            ORDER BY nome_projeto ASC
            LIMIT %s OFFSET %s
        """, params + [por_pagina, offset])

        linhas = cur.fetchall()
        dados = [{
            "id": r[0],
            "nome_projeto": r[1],
            "obs": r[2],
            "status": bool(r[3])
        } for r in linhas]

        total_paginas = (total // por_pagina) + (1 if total % por_pagina else 0) or 1

        return jsonify({
            "dados": dados,
            "total_paginas": total_paginas,
            "pagina_atual": pagina
        })

    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    finally:
        if conn:
            conn.close()



@mod_hub_bp.route("/projetos/novo")
@login_obrigatorio
def projetos_novo():
    return render_template("frm_hub_projetos_apoio.html")

@mod_hub_bp.route("/projetos/editar")
@login_obrigatorio
def projetos_editar():
    return render_template("frm_hub_projetos_apoio.html")



@mod_hub_bp.route("/projetos/apoio", methods=["POST"])
@login_obrigatorio
def projetos_apoio():
    conn = None
    try:
        id_empresa = session.get("id_empresa")
        if not id_empresa:
            return jsonify({"erro": "Sessão expirada"}), 401

        payload = request.get_json() or {}
        id_reg = payload.get("id")
        if not id_reg:
            return jsonify({"erro": "ID não informado."}), 400

        conn = Var_ConectarBanco()
        cur = conn.cursor()
        cur.execute("""
            SELECT id, nome_projeto, obs, status
              FROM tbl_hub_projetos
             WHERE id = %s AND id_empresa = %s
        """, (id_reg, id_empresa))
        r = cur.fetchone()
        if not r:
            return jsonify({"erro": "Projeto não encontrado."}), 404

        return jsonify({
            "id": r[0],
            "nome_projeto": r[1],
            "obs": r[2],
            "status": bool(r[3])
        })

    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    finally:
        if conn:
            conn.close()



# SALVAR (INSERIR/ATUALIZAR)
@mod_hub_bp.route("/projetos/salvar", methods=["POST"])
@login_obrigatorio
def projetos_salvar():
    conn = None
    try:
        id_empresa = session.get("id_empresa")
        if not id_empresa:
            return jsonify({"erro": "Sessão expirada"}), 401

        d = request.get_json() or {}
        id_reg = d.get("id")
        nome_projeto = (d.get("nome_projeto") or "").strip()
        obs = (d.get("obs") or "").strip()

        # status pode vir boolean ou string "Ativo"/"Inativo"
        st = d.get("status")
        if isinstance(st, str):
            status_bool = (st.lower() == "ativo" or st.lower() == "true")
        else:
            status_bool = bool(st)

        if not nome_projeto:
            return jsonify({"erro": "Campo obrigatório: nome_projeto"}), 400

        conn = Var_ConectarBanco()
        cur = conn.cursor()

        # checa unicidade por empresa (desconsidera o próprio id em edição)
        if id_reg:
            cur.execute("""
                SELECT 1 FROM tbl_hub_projetos
                 WHERE id_empresa = %s
                   AND lower(nome_projeto) = lower(%s)
                   AND id <> %s
            """, (id_empresa, nome_projeto, id_reg))
        else:
            cur.execute("""
                SELECT 1 FROM tbl_hub_projetos
                 WHERE id_empresa = %s
                   AND lower(nome_projeto) = lower(%s)
            """, (id_empresa, nome_projeto))
        if cur.fetchone():
            return jsonify({"erro": "Já existe um projeto com esse nome nesta empresa."}), 409

        if id_reg:
            cur.execute("""
                UPDATE tbl_hub_projetos
                   SET nome_projeto = %s,
                       obs = %s,
                       status = %s
                 WHERE id = %s AND id_empresa = %s
            """, (nome_projeto, obs, status_bool, id_reg, id_empresa))
        else:
            cur.execute("""
                INSERT INTO tbl_hub_projetos (id_empresa, nome_projeto, obs, status)
                VALUES (%s, %s, %s, %s)
            """, (id_empresa, nome_projeto, obs, status_bool))

        conn.commit()
        return jsonify({"mensagem": "Projeto salvo com sucesso!"})

    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"erro": str(e)}), 500
    finally:
        if conn:
            conn.close()



# EXCLUIR
@mod_hub_bp.route("/projetos/excluir", methods=["POST"])
@login_obrigatorio
def projetos_excluir():
    conn = None
    try:
        id_empresa = session.get("id_empresa")
        if not id_empresa:
            return jsonify({"erro": "Sessão expirada"}), 401

        d = request.get_json() or {}
        id_reg = d.get("id")
        if not id_reg:
            return jsonify({"erro": "ID não informado."}), 400

        conn = Var_ConectarBanco()
        cur = conn.cursor()
        cur.execute("""
            DELETE FROM tbl_hub_projetos
             WHERE id = %s AND id_empresa = %s
        """, (id_reg, id_empresa))
        conn.commit()

        if cur.rowcount == 0:
            return jsonify({"erro": "Projeto não encontrado."}), 404

        return jsonify({"mensagem": "Projeto excluído com sucesso."})

    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"erro": str(e)}), 500
    finally:
        if conn:
            conn.close()
