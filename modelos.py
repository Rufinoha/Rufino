from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import CheckConstraint
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from extensoes import db
from sqlalchemy import Column, Integer, String, Boolean, Date, Text, Enum, ForeignKey


class TblAssinaturaCliente(db.Model):
    __tablename__ = "tbl_assinatura_cliente"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    id_empresa = db.Column(db.Integer, nullable=False)
    id_modulo = db.Column(db.Integer, nullable=False)
    dt_inicio = db.Column(db.Date, default=datetime.utcnow)
    dt_fim = db.Column(db.Date)
    status = db.Column(db.String, default='Ativo')
    obs = db.Column(db.Text)
    forma_pagamento = db.Column(db.Text)
    __table_args__ = (
        CheckConstraint("status IN ('Ativo', 'Inativo', 'Cancelado')"),
    )


class TblChamado(db.Model):
    __tablename__ = "tbl_chamado"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    id_usuario = db.Column(db.Integer, nullable=False)
    id_empresa = db.Column(db.Integer, nullable=False)
    categoria = db.Column(db.String, nullable=False)
    status = db.Column(db.String, default="Pendente")
    situacao = db.Column(db.String, default="Aberto")
    titulo = db.Column(db.Text, nullable=False)
    ocorrencia = db.Column(db.Text, nullable=False)
    criado_em = db.Column(db.DateTime, default=datetime.utcnow)
    __table_args__ = (
        CheckConstraint("categoria IN ('Dúvidas', 'Problemas Técnicos', 'Sugestões', 'Financeiro', 'API')"),
        CheckConstraint("status IN ('Pendente', 'Concluído')"),
        CheckConstraint("situacao IN ('Aberto', 'Em Análise', 'Em Desenvolvimento', 'Em Orçamento', 'Fechado')"),
    )


class TblChamadoMensagem(db.Model):
    __tablename__ = "tbl_chamado_mensagem"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    id_chamado = db.Column(db.Integer, db.ForeignKey("tbl_chamado.id"), nullable=False)
    id_usuario = db.Column(db.Integer, nullable=False)
    mensagem = db.Column(db.Text, nullable=False)
    origem = db.Column(db.String, default="sistema")
    criado_em = db.Column(db.DateTime, default=datetime.utcnow)
    __table_args__ = (
        CheckConstraint("origem IN ('sistema', 'whatsapp')"),
    )


class TblChamadoMensagemAnexo(db.Model):
    __tablename__ = "tbl_chamado_mensagem_anexo"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    id_mensagem = db.Column(db.Integer, db.ForeignKey("tbl_chamado_mensagem.id"), nullable=False)
    nome_arquivo = db.Column(db.Text, nullable=False)
    caminho = db.Column(db.Text, nullable=False)
    criado_em = db.Column(db.DateTime, default=datetime.utcnow)


class TblConfig(db.Model):
    __tablename__ = "tbl_config"
    id_config = db.Column(db.Integer, primary_key=True, autoincrement=True)
    id_empresa = db.Column(db.Integer, nullable=False)
    chave = db.Column(db.Text, nullable=False)
    valor = db.Column(db.Text, nullable=False)
    descricao = db.Column(db.Text)
    atualizado_em = db.Column(db.DateTime, default=datetime.utcnow)


class TblEmailEnvio(db.Model):
    __tablename__ = "tbl_email_envio"
    id_envio = db.Column(db.Integer, primary_key=True, autoincrement=True)
    tag_email = db.Column(db.Text, unique=True, nullable=False)
    assunto = db.Column(db.Text, nullable=False)
    corpo = db.Column(db.Text)
    dt_envio = db.Column(db.DateTime, default=datetime.utcnow)
    id_empresa = db.Column(db.Integer)


class TblEmailDestinatario(db.Model):
    __tablename__ = "tbl_email_destinatario"
    id_destinatario = db.Column(db.Integer, primary_key=True, autoincrement=True)
    id_envio = db.Column(db.Integer, db.ForeignKey("tbl_email_envio.id_envio"), nullable=False)
    email = db.Column(db.Text, nullable=False)
    status_atual = db.Column(db.Text, default='Aguardando')
    dt_ultimo_evento = db.Column(db.DateTime)
    tag_email = db.Column(db.Text)
    id_empresa = db.Column(db.Integer)


class TblEmailEvento(db.Model):
    __tablename__ = "tbl_email_evento"
    id_evento = db.Column(db.Integer, primary_key=True, autoincrement=True)
    id_destinatario = db.Column(db.Integer, db.ForeignKey("tbl_email_destinatario.id_destinatario"), nullable=False)
    tipo_evento = db.Column(db.Text, nullable=False)  # sent, delivered, opened, error, etc.
    data_evento = db.Column(db.DateTime)
    mensagem_erro = db.Column(db.Text)
    id_empresa = db.Column(db.Integer)


class TblEmailLog(db.Model):
    __tablename__ = "tbl_email_log"
    id_log = db.Column(db.Integer, primary_key=True, autoincrement=True)
    assunto = db.Column(db.Text, nullable=False)
    corpo = db.Column(db.Text, nullable=False)
    destinatario = db.Column(db.Text, nullable=False)
    status = db.Column(db.Text, nullable=False)
    tag = db.Column(db.Text)
    id_empresa = db.Column(db.Integer)
    data_envio = db.Column(db.DateTime, default=datetime.utcnow)


class TblEmpresa(db.Model):
    __tablename__ = "tbl_empresa"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    tipo = db.Column(db.Text, nullable=False)
    cnpj = db.Column(db.Text, nullable=False, unique=True)
    nome_empresa = db.Column(db.Text, nullable=False)
    endereco = db.Column(db.Text, nullable=False)
    numero = db.Column(db.Text, nullable=False)
    bairro = db.Column(db.Text, nullable=False)
    cidade = db.Column(db.Text, nullable=False)
    uf = db.Column(db.Text, nullable=False)
    cep = db.Column(db.Text)
    ie = db.Column(db.Text)
    tipofavorecido = db.Column(db.Text, nullable=False)
    status = db.Column(db.Text, nullable=False)
    forma_pagamento_padrao = db.Column(db.Text, default='boleto')
    contato_financeiro = db.Column(db.Text)
    email_financeiro = db.Column(db.Text)
    whatsapp_financeiro = db.Column(db.Text)
    obs_faturamento = db.Column(db.Text)
    __table_args__ = (
        CheckConstraint("tipo IN ('Física', 'Juridica')"),
        CheckConstraint("status IN ('Ativo', 'Inativo')"),
    )


class TblFatura(db.Model):
    __tablename__ = "tbl_fatura"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    id_empresa = db.Column(db.Integer, nullable=False)
    vencimento = db.Column(db.Date, nullable=False)
    valor_total = db.Column(db.Float, nullable=False)
    desconto = db.Column(db.Float, default=0)
    acrescimo = db.Column(db.Float, default=0)
    forma_pagamento = db.Column(db.Text, nullable=False)
    id_efi_cobranca = db.Column(db.Text)
    status_pagamento = db.Column(db.Text, default='Pendente')
    obs = db.Column(db.Text)
    competencia = db.Column(db.Text)
    link_efi_pagamento = db.Column(db.Text)
    qrcode_efi = db.Column(db.Text)
    dt_efi_cobranca_gerada = db.Column(db.Text)
    __table_args__ = (
        CheckConstraint("status_pagamento IN ('Pendente', 'Pago', 'Cancelado')"),
    )


class TblFaturaAssinatura(db.Model):
    __tablename__ = "tbl_fatura_assinatura"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    id_empresa = db.Column(db.Integer, nullable=False)
    id_modulo = db.Column(db.Integer, nullable=False)
    nome_modulo = db.Column(db.Text, nullable=False)
    periodo_inicio = db.Column(db.Date, nullable=False)
    periodo_fim = db.Column(db.Date)
    valor = db.Column(db.Float, nullable=False)
    status = db.Column(db.Text, default='Ativo')
    __table_args__ = (
        CheckConstraint("status IN ('Ativo', 'Cancelado')"),
    )


class TblMenu(db.Model):
    __tablename__ = "tbl_menu"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    nome_menu = db.Column(db.Text, nullable=False)
    descricao = db.Column(db.Text)
    rota = db.Column(db.Text)
    data_page = db.Column(db.Text)
    icone = db.Column(db.Text)
    link_detalhe = db.Column(db.Text)
    tipo_abrir = db.Column(db.Text, default='index')
    ordem = db.Column(db.Integer, default=0)
    parent_id = db.Column(db.Integer, db.ForeignKey('tbl_menu.id'))
    ativo = db.Column(db.Boolean, default=True)
    local_menu = db.Column(db.Text, default='lateral')
    valor = db.Column(db.Float)
    obs = db.Column(db.Text)
    assinatura_app = db.Column(db.Boolean, default=False)
    __table_args__ = (
        CheckConstraint("tipo_abrir IN ('index', 'nova_aba', 'popup')"),
    )


class TblNovidades(db.Model):
    __tablename__ = "tbl_novidades"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    emissao = db.Column(db.Date, nullable=False)
    modulo = db.Column(db.Text, nullable=False)
    descricao = db.Column(db.Text, nullable=False)
    link = db.Column(db.Text)


class TblUsuario(db.Model):
    __tablename__ = "tbl_usuario"
    id_usuario = db.Column(db.Integer, primary_key=True, autoincrement=True)
    id_empresa = db.Column(db.Integer)
    nome = db.Column(db.Text, nullable=False)
    nome_completo = db.Column(db.Text, nullable=False)
    email = db.Column(db.Text, nullable=False, unique=True)
    senha = db.Column(db.Text, nullable=False)
    grupo = db.Column(db.Text, nullable=False)
    departamento = db.Column(db.Text)
    whatsapp = db.Column(db.Text)
    status = db.Column(db.Text, nullable=False)  # CHECK ['Ativo', 'Inativo'] — tratar via aplicação
    ultimo_login = db.Column(db.DateTime)
    data_criacao = db.Column(db.DateTime)
    trocasenha_em = db.Column(db.DateTime)
    token_redefinicao = db.Column(db.Text)
    expira_em = db.Column(db.Date)
    imagem = db.Column(db.Text)
    consentimento_lgpd = db.Column(db.Boolean)
    consentimento_marketing = db.Column(db.Boolean)
    bloqueado_em = db.Column(db.DateTime)
    criador = db.Column(db.Boolean)
    id_grupo = db.Column(db.Integer)
    id_ultima_novidade_visualizada = db.Column(db.Integer, default=0)



# 🔹 Grupo de usuário por empresa
class TblUsuarioGrupo(db.Model):
    __tablename__ = "tbl_usuario_grupo"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    id_empresa = db.Column(db.Integer, nullable=False)
    nome_grupo = db.Column(db.Text, nullable=False)
    descricao = db.Column(db.Text)
    criado_em = db.Column(db.DateTime)




# 🔹 Permissão de menu por grupo
class TblUsuarioPermissaoGrupo(db.Model):
    __tablename__ = "tbl_usuario_permissao_grupo"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    id_empresa = db.Column(db.Integer, nullable=False)
    id_grupo = db.Column(db.Integer, nullable=False)
    id_menu = db.Column(db.Integer, nullable=False)

    __table_args__ = (
        db.UniqueConstraint('id_empresa', 'id_grupo', 'id_menu', name='tbl_usuario_permissao_grupo_id_empresa_id_grupo_id_menu_key'),
        db.ForeignKeyConstraint(['id_empresa'], ['tbl_empresa.id'], name='tbl_usuario_permissao_grupo_id_empresa_fkey'),
        db.ForeignKeyConstraint(['id_grupo'], ['tbl_usuario_grupo.id'], name='tbl_usuario_permissao_grupo_id_grupo_fkey'),
        db.ForeignKeyConstraint(['id_menu'], ['tbl_menu.id'], name='tbl_usuario_permissao_grupo_id_menu_fkey'),
    )






#===============================================================================================================
# TABELAS para o HUB
#===============================================================================================================

# Plano de Contas
class TblHubPlanoContas(db.Model):
    __tablename__ = "tbl_hub_plano_contas"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    codigo = db.Column(db.String(20), nullable=False)
    descricao = db.Column(db.String(100), nullable=False)
    tipo = db.Column(db.String(20), nullable=False)
    nivel = db.Column(db.Integer, nullable=False)
    id_empresa = db.Column(db.Integer, nullable=False)
    status = db.Column(db.Boolean, nullable=False, default=True)
    plano = db.Column(db.String(20), nullable=False)
    cod_integracao = db.Column(db.String(100))

    __table_args__ = (
        db.UniqueConstraint('id_empresa', 'codigo', name='unq_empresa_codigo'),
    )




# Categorias
class TblHubCategoria(db.Model):
    __tablename__ = "tbl_hub_categoria"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    nome_categoria = db.Column(db.String(100), nullable=False)
    onde_usa = db.Column(db.String(20), nullable=False)
    id_conta_contabil = db.Column(db.Integer, db.ForeignKey('tbl_hub_plano_contas.id'), nullable=False)
    id_empresa = db.Column(db.Integer, nullable=False)
    status = db.Column(db.Boolean, nullable=False, default=True)
    tipo_plano = db.Column(db.String(20))  # CHECK: valores possíveis controlados via aplicação



# Favorecido
class TblHubFavorecido(db.Model):
    __tablename__ = "tbl_hub_favorecido"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    tipo = db.Column(db.String(2), nullable=False)  # CHECK ('F', 'J') – validar via aplicação
    nome = db.Column(db.String(100))
    razao_social = db.Column(db.String(100))
    documento = db.Column(db.String(20), nullable=False)
    inscricao_estadual = db.Column(db.String(20))
    inscricao_municipal = db.Column(db.String(20))
    email = db.Column(db.String(100))
    telefone = db.Column(db.String(20))
    cep = db.Column(db.String(10))
    logradouro = db.Column(db.String(100))
    numero = db.Column(db.String(10))
    complemento = db.Column(db.String(50))
    bairro = db.Column(db.String(50))
    cidade = db.Column(db.String(100))
    uf = db.Column(db.String(2))
    data_abertura = db.Column(db.Date)
    natureza_juridica = db.Column(db.String(100))
    cnae_principal = db.Column(db.String(100))
    cnaes_secundarios = db.Column(db.Text)
    situacao_cadastral = db.Column(db.String(50))
    data_situacao = db.Column(db.Date)
    observacoes = db.Column(db.Text)
    id_empresa = db.Column(db.Integer, nullable=False)
    status = db.Column(db.Boolean, nullable=False, default=True)
    id_categoria = db.Column(db.Integer)

    __table_args__ = (
        db.UniqueConstraint('id_empresa', 'documento', name='unq_empresa_documento'),
    )



# Livro Diário
class TblHubLivroDiario(db.Model):
    __tablename__ = "tbl_hub_livro_diario"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    nome_exibicao = db.Column(db.String(100), nullable=False)
    tipo_conta = db.Column(db.String(20), nullable=False)  # CHECK (Banco, Caixa, Aplicacao) → validar via aplicação
    id_conta_contabil = db.Column(db.Integer, db.ForeignKey('tbl_hub_plano_contas.id'), nullable=False)
    banco_codigo = db.Column(db.String(10))
    agencia = db.Column(db.String(10))
    conta = db.Column(db.String(20))
    tipo_operacao = db.Column(db.String(20))
    documento_vinculado = db.Column(db.String(20))
    possui_integracao = db.Column(db.Boolean, default=False)
    token_integracao = db.Column(db.Text)
    webhook_url = db.Column(db.String(255))
    status = db.Column(db.Boolean, default=True)
    id_empresa = db.Column(db.Integer, nullable=False)





