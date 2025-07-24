console.log("📘 Shub_departamentos_apoio.js carregado");

let idDepartamento = 0;
let nivelModal = 1;

GlobalUtils.receberDadosApoio(function (id, nivel) {
  idDepartamento = id || 0;
  nivelModal = nivel || 1;
  document.getElementById("id").value = idDepartamento > 0 ? idDepartamento : "NOVO";

  if (idDepartamento > 0) {
    carregarDepartamento();
  } else {
    document.getElementById("status").checked = true;
  }
});

document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("ob_btnSalvar").addEventListener("click", salvarDepartamento);
  document.getElementById("ob_btnexcluir").addEventListener("click", excluirDepartamento);
});

function carregarDepartamento() {
  fetch("/departamentos/apoio_dados", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: idDepartamento })
  })
    .then(res => res.json())
    .then(res => {
      document.getElementById("nome_departamento").value = res.nome || "";
      document.getElementById("status").checked = res.status;
      document.getElementById("observacoes").value = res.obs || "";
    })
    .catch(() => Swal.fire("Erro", "Erro ao carregar departamento.", "error"));
}

async function salvarDepartamento() {
  const nome = document.getElementById("nome_departamento").value.trim();
  const status = document.getElementById("status").checked;
  const observacoes = document.getElementById("observacoes").value.trim();

  if (nome.length < 3) {
    Swal.fire("Atenção", "Informe um nome válido.", "warning");
    return;
  }

  const dados = { id: idDepartamento, nome, status, obs: observacoes };

  try {
    const resp = await fetch("/departamentos/salvar", {
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

async function excluirDepartamento() {
  const confirma = await Swal.fire({
    title: `Excluir departamento ${idDepartamento}?`,
    text: "Essa ação não poderá ser desfeita.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sim, excluir",
    cancelButtonText: "Cancelar"
  });

  if (!confirma.isConfirmed) return;

  try {
    const resp = await fetch("/departamentos/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: idDepartamento })
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
