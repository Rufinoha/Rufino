import os
import time
import sqlite3
from datetime import datetime, timedelta
from srotas import Var_ConectarBanco, enviar_email





# Função para buscar configuração no banco de dados
def buscar_config(chave):
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    cursor.execute("SELECT valor FROM tbl_config_global WHERE chave = ?", (chave,))
    resultado = cursor.fetchone()
    conn.close()
    return resultado[0] if resultado else None


# Função para atualizar a data da última execução
def atualizar_ultimo_execucao(data_hoje):
    conn = Var_ConectarBanco()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO tbl_config_global (chave, valor, descricao) 
        VALUES ('ultimo_execucao_rotina', ?, 'Data da última execução da rotina da madrugada')
        ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor
    """, (data_hoje,))
    conn.commit()
    conn.close()


# Função para verificar se a rotina já foi executada hoje
def ja_executou_hoje(data_hoje):
    data_ultimo = buscar_config('ultimo_execucao_rotina')
    return data_ultimo == data_hoje


# Loop principal
def rotina_madrugada():
    while True:
        try:
            agora = datetime.now()
            horario_configurado = buscar_config("rotina_da_madrugada") or "01:00"
            data_hoje = agora.strftime("%Y-%m-%d")
            hora_agora = agora.strftime("%H:%M")

            print(f"🕑 Verificando rotina: Agora {hora_agora} | Configurado: {horario_configurado}")

            if hora_agora == horario_configurado and not ja_executou_hoje(data_hoje):
                print("🚀 Executando rotinas da madrugada...")

                for tarefa in tarefas:
                    tarefa()

                atualizar_ultimo_execucao(data_hoje)
                print("✅ Rotinas da madrugada concluídas.")

            else:
                print("⏳ Aguardando próximo horário...")

            time.sleep(3600)  # A cada 60 minutos

        except Exception as e:
            print("❌ Erro na rotina principal:", e)
            time.sleep(3600)

if __name__ == "__main__":
    rotina_madrugada()


#======================================================================
# Tarefa 1: Enviar e-mail de garantias a vencer
#======================================================================
def tarefa_garantias_a_vencer():
    print("🔍 Verificando garantias a vencer em 15 dias...")

    try:
        conn = Var_ConectarBanco()
        cursor = conn.cursor()
        hoje = datetime.now().date()
        data_limite = hoje + timedelta(days=15)

        cursor.execute("""
            SELECT id, tipo, descricao, fornecedor, nf, valor, vencimento
            FROM tbl_garantia
            WHERE vencimento BETWEEN ? AND ? AND status = 'Vigente'
            ORDER BY vencimento ASC
        """, (hoje, data_limite))

        garantias = cursor.fetchall()
        conn.close()

        if garantias:
            corpo = "Garantias próximas do vencimento:\n\n"
            for idx, v in enumerate(garantias, 1):
                corpo += f"""{idx}) = ID: {v[0]} | Tipo: {v[1]} | - Fornecedor: {v[3]}
Descrição: {v[2]}
NF: {v[4]}  | Valor: R$ {v[5]:,.2f} | Vencimento: {v[6]}
___________________________________________________________
"""
        else:
            corpo = "Nenhuma peças ou produtos em garantia a vencer nos próximos 15 dias\n"

        corpo += """

Atenciosamente,
Equipe FleedGuard

⚠️ Este e-mail é enviado automaticamente e não deve ser respondido.
🔒 Este e-mail foi enviado em conformidade com a LGPD – Lei Geral de Proteção de Dados Pessoais.
📩 Caso tenha dúvidas ou precise de suporte, entre em contato com contato@h74.com.br
"""

        destinatarios = ["frota@variostransportes.com.br", "almoxarifado@variostransportes.com.br"]

        for dest in destinatarios:
            enviar_email(dest, "🚨 Garantias próximas do vencimento", corpo)

        print("✅ E-mail de garantias enviado com sucesso!")

    except Exception as e:
        print("❌ Erro ao processar garantias a vencer:", e)

# Lista de tarefas (adicione mais funções aqui)
tarefas = [
    tarefa_garantias_a_vencer,
]

