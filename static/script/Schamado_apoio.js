document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const chamadoId = params.get("id");

  configurarEventos(); // sempre configura os botões

  if (chamadoId) {
    document.getElementById("ob_id").value = chamadoId;
    carregarChamado(chamadoId);
    document.getElementById("ob_btnConversar").style.display = "inline-block";
  } else {
    document.getElementById("ob_btnConversar").style.display = "none";
  }
});



function configurarEventos() {
  document.getElementById("ob_btnSalvar").addEventListener("click", salvarChamado);
}

function salvarChamado() {
  const id = document.getElementById("ob_id").value.trim();
  const titulo = document.getElementById("ob_titulo").value.trim();
  const categoria = document.getElementById("ob_categoria").value;
  const status = document.getElementById("ob_status").value;
  const situacao = document.getElementById("ob_situacao").value;
  const ocorrencia = document.getElementById("ob_ocorrencia").value.trim();
  const anexos = document.getElementById("ob_anexos").files;

  if (!titulo || !categoria || !ocorrencia) {
    Swal.fire("Atenção", "Preencha todos os campos obrigatórios.", "warning");
    return;
  }

  const formData = new FormData();
  formData.append("id", id || "");
  formData.append("titulo", titulo);
  formData.append("categoria", categoria);
  formData.append("status", status || "Pendente");
  formData.append("situacao", situacao || "Aberto");
  formData.append("ocorrencia", ocorrencia);

  Array.from(anexos).slice(0, 3).forEach((f, i) => {
    formData.append(`anexo${i + 1}`, f);
  });

  fetch("/chamado/salvar", {
    method: "POST",
    body: formData
  })
    .then(resp => resp.json())
    .then(data => {
      if (data.sucesso) {
        if (data.id && !id) {
          document.getElementById("ob_id").value = data.id;
          document.getElementById("ob_btnConversar").style.display = "inline-block";
        }
        Swal.fire("Sucesso", "Chamado salvo com sucesso!", "success").then(() => {
          window.opener?.Chamado?.carregarChamados?.(); // Atualiza lista da principal
          window.close(); // Fecha a janela
        });
      } else {
        Swal.fire("Erro", data.erro || "Falha ao salvar chamado.", "error");
      }
    })
    .catch(err => {
      console.error("Erro ao salvar:", err);
      Swal.fire("Erro", "Erro inesperado ao salvar chamado.", "error");
    });
}



function carregarChamado(id) {
  fetch(`/chamado/detalhes/${id}`)
    .then(resp => resp.json())
    .then(data => {
      document.getElementById("ob_id").value = data.id;
      document.getElementById("ob_titulo").value = data.titulo;
      document.getElementById("ob_categoria").value = data.categoria;
      document.getElementById("ob_status").value = data.status;
      document.getElementById("ob_situacao").value = data.situacao;
      document.getElementById("ob_ocorrencia").value = data.ocorrencia;
      renderizarMensagens(data.mensagens);
    });
}

function renderizarMensagens(mensagens = []) {
  const container = document.getElementById("listaMensagens");
  container.innerHTML = "";

  mensagens.forEach(msg => {
    const bloco = document.createElement("div");
    bloco.className = "mensagem-bloco";

    const temAnexoInicial = msg.mensagem.includes("[anexo inicial]") && msg.anexos && msg.anexos.length > 0;

    // 🧱 Cabeçalho
    bloco.innerHTML = `
      <div class="mensagem-topo">
        <strong>${msg.nome_usuario}</strong> - ${Util.formatarDataHora(msg.criado_em)} (${msg.origem})
      </div>
    `;

    if (temAnexoInicial) {
      // ✅ Só exibe "Anexo inicial" + anexos
      bloco.innerHTML += `
        <div class="mensagem-anexos-inline">
          <span class="mensagem-referencia">📌 Anexo inicial</span>
          ${msg.anexos.map(ax => {
            const ext = ax.caminho.split('.').pop().toLowerCase();
            if (["jpg", "jpeg", "png"].includes(ext)) {
              return `<img src="/static/imge/anexochamado/${ax.caminho}" class="anexo-img" alt="anexo">`;
            } else {
              return `<a href="/static/imge/anexochamado/${ax.caminho}" target="_blank">${ax.nome_arquivo}</a>`;
            }
          }).join(" ")}
        </div>
      `;
    } else {
      // ❌ Exibe mensagem completa e, se houver, os anexos
      bloco.innerHTML += `<div class="mensagem-corpo">${msg.mensagem}</div>`;

      if (msg.anexos && msg.anexos.length > 0) {
        const anexosHtml = msg.anexos.map(ax => {
          const ext = ax.caminho.split('.').pop().toLowerCase();
          if (["jpg", "jpeg", "png"].includes(ext)) {
            return `<img src="/static/imge/anexochamado/${ax.caminho}" class="anexo-img" alt="anexo">`;
          } else {
            return `<a href="/static/imge/anexochamado/${ax.caminho}" target="_blank">${ax.nome_arquivo}</a>`;
          }
        }).join(" ");
        bloco.innerHTML += `<div class="mensagem-anexos-inline">${anexosHtml}</div>`;
      }
    }

    container.appendChild(bloco);
  });
}



function salvarResposta(id) {
  const msg = document.getElementById("ob_mensagem").value.trim();
  const anexos = document.getElementById("ob_anexos").files;
  if (!msg && anexos.length === 0) {
    Swal.fire("Atenção", "Escreva uma mensagem ou adicione um anexo.", "info");
    return;
  }

  const formData = new FormData();
  formData.append("id_chamado", id);
  formData.append("mensagem", msg);
  Array.from(anexos).slice(0, 3).forEach((f, i) => formData.append(`anexo${i+1}`, f));

  fetch("/chamado/mensagem/incluir", {
    method: "POST",
    body: formData
  })
    .then(resp => resp.json())
    .then(data => {
      if (data.sucesso) {
        document.getElementById("ob_mensagem").value = "";
        document.getElementById("ob_anexos").value = "";
        carregarChamado(id);
      } else {
        Swal.fire("Erro", data.erro || "Falha ao salvar resposta.", "error");
      }
    });
} 

document.addEventListener("DOMContentLoaded", () => {
  const btnComentario = document.getElementById("ob_btnConversar");
  const idChamado = document.getElementById("ob_id").value;

  // Oculta o botão se não tiver ID
  if (!idChamado || isNaN(parseInt(idChamado))) {
    btnComentario.style.display = "none";
  } else {
    btnComentario.style.display = "inline-block";
  }

  btnComentario.addEventListener("click", () => {
    Swal.fire({
      title: "Novo Comentário",
      html: `
        <textarea id="swal_mensagem" class="swal2-textarea" placeholder="Digite sua mensagem" style="height: 120px"></textarea>
        <input type="file" id="swal_anexos" class="swal2-file" multiple accept=".png,.jpg,.jpeg,.pdf">
        <p><small>Máximo de 3 arquivos</small></p>
      `,
      width: "700px",
      showCancelButton: true,
      confirmButtonText: "Enviar",
      cancelButtonText: "Cancelar",
      preConfirm: () => {
        const mensagem = document.getElementById("swal_mensagem").value.trim();
        const arquivos = document.getElementById("swal_anexos").files;
        if (!mensagem && arquivos.length === 0) {
          Swal.showValidationMessage("Digite uma mensagem ou anexe um arquivo.");
          return false;
        }
        return { mensagem, arquivos };
      }
    }).then(result => {
      if (result.isConfirmed && result.value) {
        enviarComentarioViaSwal(result.value.mensagem, result.value.arquivos);
      }
    });
  });
});


function enviarComentarioViaSwal(mensagem, arquivos) {
  const chamadoId = document.getElementById("ob_id").value;
  const formData = new FormData();
  formData.append("id_chamado", chamadoId);
  formData.append("mensagem", mensagem);
  Array.from(arquivos).slice(0, 3).forEach((file, i) => {
    formData.append(`anexo${i + 1}`, file);
  });

  fetch("/chamado/mensagem/incluir", {
    method: "POST",
    body: formData
  })
    .then(resp => resp.json())
    .then(data => {
      if (data.sucesso) {
        Swal.fire("Sucesso", "Comentário enviado com sucesso!", "success");
        carregarChamado(chamadoId);
      } else {
        Swal.fire("Erro", data.erro || "Falha ao enviar comentário.", "error");
      }
    })
    .catch(err => {
      console.error("Erro ao enviar:", err);
      Swal.fire("Erro", "Falha inesperada no envio.", "error");
    });
}
