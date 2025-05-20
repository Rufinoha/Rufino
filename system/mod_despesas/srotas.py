from flask import Blueprint, render_template

despesas_bp = Blueprint(
    'mod_despesas',
    __name__,
    template_folder='templates',
    static_folder='static'
)

@despesas_bp.route('/despesas')
def despesas():
    return render_template('mod_despesas/despesas.html')
