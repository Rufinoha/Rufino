from flask import Blueprint, render_template, send_from_directory

main_bp = Blueprint(
    'main',
    __name__,
    template_folder='.',        # HTMLs
    static_folder='static',     # Estáticos dentro de static/
    static_url_path='/main'  # URL pública correta
)



@main_bp.route('/')
def index():
    return render_template('index.html')




 