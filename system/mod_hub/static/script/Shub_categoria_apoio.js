console.log("📘 Shub_categoria_apoio.js carregado");

let idCategoria = 0;
let nivelModal = 1;  // padrão TECH

// ✅ Recebimento padrão via modal
GlobalUtils.receberDadosApoio(function (id, nivel) {
  idCategoria = id || 0;
  nivelModal = nivel || 1;
  document.getElementById("id").value = idCategoria > 0 ? idCategoria : "NOVO";

  if (idCategoria > 0) {
    carregarCategoria();
  } else {
    document.getElementById("status").checked = true;
  }
});

document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("ob_btnSalvar").addEventListener("click", salvarCategoria);
  document.getElementById("ob_btnexcluir").addEventListener("click", excluirCategoria);
});

// ✅ Carrega dados da categoria existente
function carregarCategoria() {
  fetch("/categoria/apoio_dados", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: idCategoria })
  })
    .then(res => res.json())
    .then(res => {
      document.getElementById("nome_categoria").value = res.nome_categoria || "";
      document.getElementById("status").checked = res.status;
      document.getElementById("observacoes").value = res.observacoes || "";
    })
    .catch(() => Swal.fire("Erro", "Erro ao carregar categoria.", "error"));
}

// ✅ Salvar categoria
async function salvarCategoria() {
  const nome = document.getElementById("nome_categoria").value.trim();
  const status = document.getElementById("status").checked;
  const observacoes = document.getElementById("observacoes").value.trim();

  if (nome.length < 3) {
    Swal.fire("Atenção", "Informe um nome válido.", "warning");
    return;
  }

  const dados = { id: idCategoria, nome, status, observacoes };

  try {
    const resp = await fetch("/categoria/salvar", {
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

// ✅ Excluir categoria
async function excluirCategoria() {
  const confirma = await Swal.fire({
    title: `Excluir categoria ${idCategoria}?`,
    text: "Essa ação não poderá ser desfeita.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sim, excluir",
    cancelButtonText: "Cancelar"
  });

  if (!confirma.isConfirmed) return;

  try {
    const resp = await fetch("/categoria/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: idCategoria })
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
