// ---------------------------------------------------------------
// ✅ VERIFICA SE EmailLog JÁ EXISTE E CRIA SE NÃO EXISTIR
// ---------------------------------------------------------------
if (typeof window.EmailLog === "undefined") {
  window.EmailLog = {
    // 🔠 Traduções amigáveis para eventos técnicos do Brevo
    MAPA_EVENTO: {
      sent: "Enviado",
      delivered: "Entregue",
      opened: "Aberto",
      unique_opened: "Email Aberto",
      error: "Erro no envio",
      bounce: "Não entregue (erros)",
      request: "Aguardando envio",
      complaint: "Marcado como spam",
      blocked: "Bloqueado",
      rejected: "Rejeitado pelo servidor",
      reenviado: "Reenviado",
    },

    MAPA_ERROS: {
      "Mailbox full": "📭 Caixa de e-mail cheia",
      "Temporary error": "⏳ Erro temporário no servidor do destinatário",
      "Email address does not exist": "❌ Endereço de e-mail inválido",
      "User unknown": "❌ Usuário de e-mail desconhecido",
      "Blocked due to spam": "🚫 Bloqueado por suspeita de spam",
      "Domain blacklisted": "🚫 Domínio bloqueado pelo provedor de destino",
      "Marked as spam": "🚫 Marcado como spam pelo destinatário",
      "Invalid email": "❌ E-mail mal formatado",
      "Unsubscribed user": "🔕 Usuário descadastrado da lista",
      "Soft bounce - Relay not permitted": "🚫 Erro temporário: Rejeição pelo servidor do destinatário",
      "Hard bounce - Content rejected": "🚫 Conteúdo rejeitado pelo servidor",
      "Blocked (policy)": "🚫 Política de entrega bloqueou a mensagem",
    },
    

    configurarEventos: function () {
      const tbody = document.getElementById("tbodyLogs");
      const statusSelect = document.getElementById("filtroStatus");
      const dataInicio = document.getElementById("dataInicio");
      const dataFim = document.getElementById("dataFim");
      const filtroEmail = document.getElementById("filtroDestinatario");
      const btnFiltrar = document.getElementById("btnFiltrar");

      async function carregarLogs() {
        const params = new URLSearchParams({
          status: statusSelect.value,
          data_inicio: dataInicio.value,
          data_fim: dataFim.value,
          destinatario: filtroEmail.value,
        });

        const resposta = await fetch(`/email/dados?${params.toString()}`);
        const dados = await resposta.json();

        tbody.innerHTML = "";

        if (!dados.length) {
          tbody.innerHTML = `<tr><td colspan="6">Nenhum log encontrado.</td></tr>`;
          return;
        }

        dados.forEach((item) => {
          const linha = document.createElement("tr");

          const lista = item.destinatario.split(",");
          const visivel = lista.slice(0, 2).join(", ");
          const restante = lista.length > 2 ? ` e mais ${lista.length - 2}` : "";

          const podeReenviar = ["Falha", "Aguardando"].includes(item.status);
          const btnReenviar = podeReenviar ? `<button class="btn-reenviar" data-tag="${item.tag}">🔁</button>` : "";

          linha.innerHTML = `
            <td>${item.id_log}</td>
            <td title="${item.assunto}">${item.assunto}</td>
            <td>${visivel}${restante}</td>
            <td>${EmailLog.formatarDataHora(item.data_envio)}</td>
            <td><span class="status ${item.status.toLowerCase()}">${item.status}</span></td>
            <td>
              <button class="btn-detalhes" data-tag="${item.tag}">🔍</button>
              ${btnReenviar}
            </td>
          `;

          tbody.appendChild(linha);
        });
      }

      tbody.addEventListener("click", async (e) => {
        const tag = e.target.dataset.tag;

        if (e.target.classList.contains("btn-detalhes")) {
          const resposta = await fetch(`/email/log/detalhes/${tag}`);
          const detalhes = await resposta.json();

          if (!detalhes.length) {
            Swal.fire("Sem dados", "Nenhum evento encontrado para este envio.", "info");
            return;
          }

          let html = "";
          detalhes.forEach(dest => {
            const statusAmigavel = EmailLog.MAPA_EVENTO[dest.status_atual?.toLowerCase()] || dest.status_atual;

            html += `<div class="destinatario-bloco">
            <strong>${dest.email} = ultimo Status: ${statusAmigavel}</strong><br/><br>`;
            
            dest.eventos.forEach(ev => {
             const nomeEventoAmigavel = EmailLog.MAPA_EVENTO[ev.tipo_evento?.toLowerCase()] || ev.tipo_evento;
            html += `<span class="linha-evento">
                - ${EmailLog.formatarDataHora(ev.data_evento)} - ${nomeEventoAmigavel}
            ${ev.mensagem_erro ? `<br/><span class="erro-evento">🛈 ${ev.mensagem_erro}</span>` : ""}
            </span><br/>`;

            });
            html += `</div><hr/>`;
          });

          Swal.fire({
            title: "📬 Detalhes do Envio",
            html: `<div class="swal-log">${html}</div>`,
            width: 600,
            confirmButtonText: "Fechar"
          });
        }

        if (e.target.classList.contains("btn-reenviar")) {
          const confirmar = await Swal.fire({
            title: "Reenviar e-mail?",
            text: "Deseja reenviar os e-mails com falha ou aguardando?",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Sim, reenviar",
            cancelButtonText: "Cancelar"
          });

          if (confirmar.isConfirmed) {
            const resp = await fetch(`/email/log/reenviar/${tag}`, { method: "POST" });
            const res = await resp.json();
            Swal.fire(res.titulo, res.mensagem, res.status);
            carregarLogs();
          }
        }
      });

      btnFiltrar.addEventListener("click", () => {
        carregarLogs();
      });

      // Botão Voltar
      const btnVoltar = document.getElementById("ob_btnVoltar");
      if (btnVoltar) {
        btnVoltar.addEventListener("click", () => {
          carregarPagina("configuracoes");
        });
      }

      carregarLogs();
    },

    formatarDataHora: function (data) {
      if (!data) return "";
      const d = new Date(data);
      return d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
        });

    }
  };
} else {
  console.warn("⚠️ A variável EmailLog já está declarada.");
}

// Inicialização
if (window.EmailLog && typeof window.EmailLog.configurarEventos === "function") {
  window.EmailLog.configurarEventos();
}


