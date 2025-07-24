# reem_global_util.py
from flask import Blueprint, jsonify, request, session
from global_utils import Var_ConectarBanco

reem_global = Blueprint(
    'reem_global',
    __name__,
    template_folder='tamplates',
    static_folder='static',
    static_url_path='/static/mod_reembolso'
)

def init_app(app):
    app.register_blueprint(reem_global)

# 🔽 Combobox de categorias (onde_usa = 'reembolso')
@reem_global.route("/reembolso/combobox/categorias")
def categorias_reembolso():
    id_empresa = session.get("id_empresa")
    conn = Var_ConectarBanco()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT id, nome_categoria
            FROM tbl_hub_categoria
            WHERE id_empresa = %s AND status = TRUE AND onde_usa = 'reembolso'
            ORDER BY nome_categoria
        """, (id_empresa,))
        dados = [{"id": r[0], "nome_categoria": r[1]} for r in cur.fetchall()]
        return jsonify(dados)
    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    finally:
        cur.close()
        conn.close()

# 🔽 Combobox de contas financeiras (Livro Diário)
@reem_global.route("/reembolso/combobox/livro_diario")
def contas_pagamento():
    id_empresa = session.get("id_empresa")
    conn = Var_ConectarBanco()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT id, descricao
            FROM tbl_hub_livro_diario
            WHERE id_empresa = %s AND status = TRUE
            ORDER BY descricao
        """, (id_empresa,))
        dados = [{"id": r[0], "descricao": r[1]} for r in cur.fetchall()]
        return jsonify(dados)
    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    finally:
        cur.close()
        conn.close()
