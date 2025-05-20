from flask import Blueprint, render_template

licencas_bp = Blueprint(
    'mod_licencas',
    __name__,
    template_folder='templates',
    static_folder='static'
)

@licencas_bp.route('/licencas')
def licencas():
    return render_template('mod_licencas/licencas.html')
