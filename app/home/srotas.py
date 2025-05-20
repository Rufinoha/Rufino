from flask import Blueprint, render_template, send_from_directory

home_bp = Blueprint(
    'home',
    __name__,
    template_folder='.',          # home.html continua na raiz da pasta
    static_folder='static',       # agora apontando para a pasta static separada
    static_url_path='/home'       # URL base ainda é /home
)

# Rota para chamar a pagina home.html
@home_bp.route('/')
def home():
    return render_template('home.html')


@home_bp.route('/login')
def login():
    return render_template('login.html')
 