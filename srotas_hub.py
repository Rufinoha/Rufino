# Srotas_hub.py
from flask import Blueprint, request, jsonify
from modelos import db, TblHubPlanoContas, TblHubCategoria, TblHubFavorecido, TblHubLivroDiario, TblHubCentroCusto
from flask import session

hub_bp = Blueprint(
    'hub',
    __name__,
    template_folder='../templates',
    static_folder='../static',
    static_url_path='/static'
)



# 🔒 Middleware padrão do projeto
def get_id_empresa():
    return session.get("id_empresa")

# 📘 Exemplo: Listar Plano de Contas
@hub_bp.route("/plano_contas", methods=["GET"])
def listar_plano_contas():
    id_empresa = get_id_empresa()
    contas = TblHubPlanoContas.query.filter_by(id_empresa=id_empresa).all()
    resultado = [{
        "id": c.id,
        "codigo": c.codigo,
        "descricao": c.descricao,
        "tipo": c.tipo,
        "nivel": c.nivel,
        "analitica": c.analitica
    } for c in contas]
    return jsonify(resultado)

# 📘 Exemplo: Criar nova conta contábil
@hub_bp.route("/plano_contas", methods=["POST"])
def criar_plano_contas():
    dados = request.get_json()
    conta = TblHubPlanoContas(
        codigo=dados["codigo"],
        descricao=dados["descricao"],
        tipo=dados["tipo"],
        nivel=dados["nivel"],
        analitica=dados.get("analitica", True),
        id_empresa=get_id_empresa()
    )
    db.session.add(conta)
    db.session.commit()
    return jsonify({"mensagem": "Conta criada com sucesso.", "id": conta.id})
from flask import Blueprint, request, jsonify, session
from modelos import db, TblHubPlanoContas, TblHubCategoria, TblHubFavorecido, TblHubLivroDiario, TblHubCentroCusto

hub_bp = Blueprint(
    'hub',
    __name__,
    template_folder='../templates',
    static_folder='../static',
    static_url_path='/static'
)

# 🔒 Middleware padrão do projeto
def get_id_empresa():
    return session.get("id_empresa")


# ------------------------------------------------------------
# ROTAS PLANO DE CONTAS
# ------------------------------------------------------------

@hub_bp.route("/plano_contas/dados", methods=["GET"])
def plano_contas_dados():
    id_empresa = get_id_empresa()
    contas = TblHubPlanoContas.query.filter_by(id_empresa=id_empresa).all()
    resultado = [{
        "id": c.id,
        "codigo": c.codigo,
        "descricao": c.descricao,
        "tipo": c.tipo,
        "nivel": c.nivel,
        "analitica": c.analitica
    } for c in contas]
    return jsonify(resultado)


@hub_bp.route("/plano_contas/salvar", methods=["POST"])
def plano_contas_salvar():
    dados = request.get_json()
    id_empresa = get_id_empresa()
    id_conta = dados.get("id")

    if id_conta:
        conta = TblHubPlanoContas.query.filter_by(id=id_conta, id_empresa=id_empresa).first()
        if not conta:
            return jsonify({"erro": "Conta não encontrada."}), 404
    else:
        conta = TblHubPlanoContas(id_empresa=id_empresa)

    conta.codigo = dados["codigo"]
    conta.descricao = dados["descricao"]
    conta.tipo = dados["tipo"]
    conta.nivel = dados["nivel"]
    conta.analitica = dados.get("analitica", True)

    db.session.add(conta)
    db.session.commit()

    return jsonify({"status": "sucesso", "mensagem": "Conta salva com sucesso.", "id": conta.id})


@hub_bp.route("/plano_contas/delete", methods=["POST"])
def plano_contas_delete():
    dados = request.get_json()
    id_conta = dados.get("id")
    id_empresa = get_id_empresa()

    if not id_conta:
        return jsonify({"erro": "ID da conta não informado."}), 400

    conta = TblHubPlanoContas.query.filter_by(id=id_conta, id_empresa=id_empresa).first()
    if not conta:
        return jsonify({"erro": "Conta não encontrada."}), 404

    db.session.delete(conta)
    db.session.commit()

    return jsonify({"status": "sucesso", "mensagem": "Conta excluída com sucesso."})


@hub_bp.route("/plano_contas/apoio", methods=["GET"])
def plano_contas_apoio():
    id_conta = request.args.get("id")
    id_empresa = get_id_empresa()

    if not id_conta:
        return jsonify({"erro": "ID da conta não informado."}), 400

    conta = TblHubPlanoContas.query.filter_by(id=id_conta, id_empresa=id_empresa).first()
    if not conta:
        return jsonify({"erro": "Conta não encontrada."}), 404

    return jsonify({
        "id": conta.id,
        "codigo": conta.codigo,
        "descricao": conta.descricao,
        "tipo": conta.tipo,
        "nivel": conta.nivel,
        "analitica": conta.analitica
    })
