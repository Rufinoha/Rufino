console.log("📘 Shub_projetos_apoio.js carregado");

let idProjeto = 0;
let nivelModal = 1;

GlobalUtils.receberDadosApoio(function (id, nivel) {
  idProjeto = id || 0;
  nivelModal = nivel || 1;
  document.getElementById("id").value = idProjeto > 0 ? idProjeto : "NOVO";

  if (idProjeto > 0) {
    carregarProjeto();
  } else {
    document.getElementById("status").checked = true;
  }
});

document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("ob_btnSalvar").addEventListener("click", salvarProjeto);
  document.getElementById("ob_btnexcluir").addEventListener("click", excluirProjeto);
});

function carregarProjeto() {
  fetch("/projetos/apoio_dados", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: idProjeto })
  })
    .then(res => res.json())
    .then(res => {
      document.getElementById("nome_projeto").value = res.nome || "";
      document.getElementById("status").checked = res.status;
      document.getElementById("observacoes").value = res.obs || "";
    })
    .catch(() => Swal.fire("Erro", "Erro ao carregar projeto.", "error"));
}

async function salvarProjeto() {
  const nome = document.getElementById("nome_projeto").value.trim();
  const status = document.getElementById("status").checked;
  const obs = document.getElementById("observacoes").value.trim();

  if (nome.length < 3) {
    Swal.fire("Atenção", "Informe um nome válido.", "warning");
    return;
  }

  const dados = { id: idProjeto, nome, status, obs };

  try {
    const resp = await fetch("/projetos/salvar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados)
    });
    const json = await resp.json();

    if (resp.ok && json.retorno) {
      Swal.fire("Sucesso", json.msg, "success").then(() => {
        window.parent.postMessage({ grupo: "atualizarTabela" }, "*");
        GlobalUtils.fecharJanelaApoio(nivelModal);
      });
    } else {
      Swal.fire("Erro", json.msg || "Erro ao salvar.", "error");
    }
  } catch (e) {
    Swal.fire("Erro", "Erro inesperado ao salvar.", "error");
  }
}

async function excluirProjeto() {
  const confirma = await Swal.fire({
    title: `Excluir projeto ${idProjeto}?`,
    text: "Essa ação não poderá ser desfeita.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sim, excluir",
    cancelButtonText: "Cancelar"
  });

  if (!confirma.isConfirmed) return;

  try {
    const resp = await fetch("/projetos/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: idProjeto })
    });
    const json = await resp.json();

    if (resp.ok && json.retorno) {
      Swal.fire("Excluído!", json.msg, "success").then(() => {
        window.parent.postMessage({ grupo: "atualizarTabela" }, "*");
        GlobalUtils.fecharJanelaApoio(nivelModal);
      });
    } else {
      Swal.fire("Erro", json.msg || "Erro ao excluir.", "error");
    }
  } catch (e) {
    Swal.fire("Erro", "Erro inesperado ao excluir.", "error");
  }
}
