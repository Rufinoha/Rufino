import threading

def rotina():
    # suas tarefas
    pass

def iniciar_rotina_madrugada():
    thread = threading.Thread(target=rotina, daemon=True)
    thread.start()
