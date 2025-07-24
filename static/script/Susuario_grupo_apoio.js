// ✅ Susuario_grupo_apoio.js carregado
console.log("✅ Susuario_grupo_apoio.js carregado");

GlobalUtils.receberDadosApoio(async function (id, nivel) {
  window.__nivelModal__ = nivel;
  if (id !== undefined && id !== null) {
    console.log("🔁 Editando grupo ID:", id);
    carregarGrupoPorID(id);
  } else {
    console.log("🆕 Novo grupo de acesso");
    document.getElementById("aprovador").checked = false;
  }
});

window.addEventListener("DOMContentLoaded", () => {
  window.opener?.postMessage({ grupo: "apoioPronto" }, "*");

  document.getElementById("ob_btnSalvar").addEventListener("click", salvarGrupo);
  document.getElementById("ob_btnExcluir").addEventListener("click", excluirGrupo);
});

async function carregarGrupoPorID(id) {
  try {
      const resp = await fetch(`/usuario/grupo/apoio1/${id}`);
      const dados = await resp.json();
      if (!resp.ok) throw dados.erro || "Erro ao carregar grupo";

      document.getElementById("id").value = dados.id || "";
      document.getElementById("nome_grupo").value = dados.nome_grupo || "";
      document.getElementById("descricao").value = dados.descricao || "";
      document.getElementById("aprovador").checked = dados.aprovador === true;
  } catch (e) {
      Swal.fire("Erro", "Erro ao carregar grupo.", "error");
  }
}

async function salvarGrupo() {
  const nome = document.getElementById("nome_grupo").value.trim();
  const descricao = document.getElementById("descricao").value.trim();
  const aprovador = document.getElementById("aprovador").checked;
  const id = document.getElementById("id").value || null;

  if (!nome) {
    Swal.fire("Atenção", "Preencha o Nome do Grupo.", "warning");
    return;
  }

  const dados = { id, nome_grupo: nome, descricao, aprovador };

  try {
    const resp = await fetch(`/usuario/grupo/salvar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados)
    });
    const json = await resp.json();
    if (resp.ok) {
      Swal.fire("Sucesso", json.mensagem, "success").then(() => fecharApoio());
    } else {
      Swal.fire("Erro", json.erro || "Erro ao salvar grupo.", "error");
    }
  } catch (e) {
    Swal.fire("Erro", "Erro inesperado ao salvar.", "error");
  }
}

async function excluirGrupo() {
  const id = document.getElementById("id").value;
  if (!id) {
    Swal.fire("Erro", "Grupo ainda não foi salvo.", "warning");
    return;
  }
  const confirma = await Swal.fire({
    title: `Excluir grupo ${id}?`,
    text: "Essa ação não poderá ser desfeita.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sim, excluir",
    cancelButtonText: "Cancelar"
  });

  if (!confirma.isConfirmed) return;

  try {
    const resp = await fetch(`/usuario/grupo/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    const json = await resp.json();
    if (resp.ok) {
      Swal.fire("Sucesso", json.mensagem, "success").then(() => fecharApoio());
    } else {
      Swal.fire("Erro", json.erro || "Erro ao excluir.", "error");
    }
  } catch (e) {
    Swal.fire("Erro", "Erro inesperado ao excluir.", "error");
  }
}

function fecharApoio() {
  if (window.__nivelModal__ !== undefined) {
    GlobalUtils.fecharJanelaApoio(window.__nivelModal__);
  } else {
    window.close();
  }
  if (window.parent?.UsuarioGrupo?.carregarDados) {
    window.parent.UsuarioGrupo.carregarDados();
  }
}
