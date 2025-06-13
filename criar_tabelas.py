from extensoes import criar_app, db
import modelos  # importa as tabelas

app = criar_app()

with app.app_context():
    db.drop_all()
    db.create_all()
    print("✅ Tabelas criadas com sucesso no banco bd_rufino.")

