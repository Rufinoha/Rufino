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
async function carregarCategoria() {
  try {
    const resp = await fetch("/categoria/apoio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: idCategoria })
    });
    const json = await resp.json();

    if (!resp.ok || json.sucesso === false) {
      throw new Error(json.mensagem || `Erro HTTP ${resp.status}`);
    }

    const { nome_categoria, status, observacoes } = json.dados;
    document.getElementById("nome_categoria").value = nome_categoria || "";
    document.getElementById("status").checked = !!status;
    document.getElementById("observacoes").value = observacoes || "";
  } catch (err) {
    Swal.fire("Erro", err.message || "Erro ao carregar categoria.", "error");
  }
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

    const okFlag = (json.sucesso === true) || (json.retorno === true);
    const msgOk  = json.mensagem || json.msg || "Categoria salva com sucesso.";

    if (resp.ok && okFlag) {
      // se veio id novo do back, atualiza o id local
      if (json.id) idCategoria = json.id;

      await Swal.fire("Sucesso", msgOk, "success");
      window.parent.postMessage({ grupo: "atualizarTabela" }, "*");
      GlobalUtils.fecharJanelaApoio(nivelModal);
    } else {
      const msgErr = json.mensagem || json.msg || "Erro ao salvar.";
      Swal.fire("Erro", msgErr, "error");
    }
  } catch (e) {
    Swal.fire("Erro", "Erro inesperado ao salvar.", "error");
  }
}


// idCategoria deve estar disponível no escopo (ex.: setado ao abrir o apoio)
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
      body: JSON.stringify({ id: numId })
    });

    const json = await resp.json(); // 🔹 sempre JSON
    console.log(json.mensagem ||json.erro || json.Number)
    if (resp.ok && json.sucesso) {
      await Swal.fire("Excluído!", json.mensagem || "Categoria excluída com sucesso.", "success");
      window.parent.postMessage({ grupo: "atualizarTabela" }, "*");
      GlobalUtils.fecharJanelaApoio(window.__nivelModal__ || 1);
    } else {
      console.log(json.mensagem ||json.erro || json.Number)
      Swal.fire("Erro", json.mensagem || json.erro || "Erro ao excluir.", "error");
    }
  } catch (e) {
    Swal.fire("Erro", "Erro inesperado ao excluir.", "error");
  }
}
