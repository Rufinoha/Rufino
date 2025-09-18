// --------------------------------------------------------------------------
// APOIO: Departamentos (hub)
// --------------------------------------------------------------------------
console.log("📘 Shub_departamentos_apoio.js carregado");

let idDepartamento = null;
let nivelModal = 1;

function getElIdCampo() {
  // Tenta achar o campo de ID mesmo que o nome mude
  return document.querySelector("#id")
      || document.querySelector("#id_categoria")
      || document.querySelector('[data-campo-id]');
}

document.addEventListener("DOMContentLoaded", () => {
  // Switch status -> label
  const statusInput = document.querySelector("#statusToggle");
  const statusLabel = document.querySelector("#statusLabel");
  if (statusInput && statusLabel) {
    // força iniciar ativo e clicável
    statusInput.checked = true;
    statusLabel.textContent = "Ativo";
    statusInput.addEventListener("change", (e) => {
      statusLabel.textContent = e.target.checked ? "Ativo" : "Inativo";
    });
  }

  // UPPERCASE do departamento
  const depInput = document.querySelector("#departamento");
  if (depInput) {
    depInput.addEventListener("input", (e) => {
      e.target.value = e.target.value.toUpperCase();
    });
  }

  // Salvar/Excluir
  document.querySelector("#btnSalvar")?.addEventListener("click", salvarDepartamento);
  document.querySelector("#btnExcluir")?.addEventListener("click", excluirDepartamento);

  // Recebe dados do principal (via modal TECH)
  GlobalUtils.receberDadosApoio(async (id, nivel) => {
    try {
      idDepartamento = id || null;
      nivelModal = nivel || 1;

      const elId = getElIdCampo();
      if (elId) elId.value = idDepartamento ? idDepartamento : "NOVO";

      if (!idDepartamento) {
        // modo inclusão
        if (statusInput && statusLabel) {
          statusInput.checked = true;
          statusLabel.textContent = "Ativo";
        }
        return;
      }

      // modo edição -> carrega registro
      const resp = await fetch("/hub_departamentos/apoio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: idDepartamento })
      });
      if (!resp.ok) throw new Error("Erro ao buscar dados do departamento.");
      const d = await resp.json();

      if (depInput) depInput.value = (d.departamento || "").toUpperCase();
      const obsEl = document.querySelector("#obs");
      if (obsEl) obsEl.value = d.obs || "";
      if (statusInput && statusLabel) {
        const ativo = !!d.status;
        statusInput.checked = ativo;
        statusLabel.textContent = ativo ? "Ativo" : "Inativo";
      }
    } catch (erro) {
      console.error("❌ Erro no callback de apoio:", erro);
      Swal.fire("Erro", "Erro ao carregar dados do departamento.", "error");
    }
  });
});

// --------------------------------------------------------------------------
// SALVAR
// --------------------------------------------------------------------------
// Helper para achar o campo de ID mesmo que mude de nome no HTML
function getElIdCampo() {
  return document.querySelector("#id")
      || document.querySelector("#id_categoria")
      || document.querySelector('[data-campo-id]');
}

async function salvarDepartamento() {
  const depInput = document.querySelector("#departamento");
  const statusInput = document.querySelector("#statusToggle");
  const statusLabel = document.querySelector("#statusLabel");
  const obsEl = document.querySelector("#obs");

  const departamento = (depInput?.value || "").trim().toUpperCase();
  const status = !!statusInput?.checked;
  const obs = (obsEl?.value || "").trim();

  if (!departamento) {
    await Swal.fire("Campo obrigatório", "Informe o nome do departamento.", "warning");
    depInput?.focus();
    return;
  }

  try {
    const payload = { id: idDepartamento, departamento, status, obs };
    const resp = await fetch("/hub_departamentos/salvar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await resp.json();

    if (resp.ok) {
      // avisa o principal para recarregar
      window.parent.postMessage({ grupo: "atualizarTabela" }, "*");

      const r = await Swal.fire({
        title: "Salvo com sucesso!",
        text: "Deseja cadastrar outro?",
        icon: "success",
        showCancelButton: true,
        confirmButtonText: "Sim",
        cancelButtonText: "Não"
      });

      if (r.isConfirmed) {
        // limpar para novo — SEM quebras se IDs mudarem
        idDepartamento = null;
        const elId = getElIdCampo();
        if (elId) elId.value = "NOVO";
        if (depInput) depInput.value = "";
        if (obsEl) obsEl.value = "";
        if (statusInput && statusLabel) {
          statusInput.checked = true;
          statusLabel.textContent = "Ativo";
        }
        depInput?.focus();
      } else {
        GlobalUtils.fecharJanelaApoio(nivelModal);
      }
    } else if (resp.status === 409) {
      Swal.fire("Duplicado", data.erro || "Já existe um departamento com esse nome nesta empresa.", "warning");
    } else {
      Swal.fire("Erro", data.erro || "Erro ao salvar departamento.", "error");
    }
  } catch (erro) {
    console.error("❌ Erro ao salvar:", erro);
    Swal.fire("Erro", "Erro inesperado ao salvar.", "error");
  }
}


// --------------------------------------------------------------------------
// EXCLUIR
// --------------------------------------------------------------------------
async function excluirDepartamento() {
    const id = idDepartamento;
    if (!id) {
        Swal.fire("Erro", "Nenhum registro selecionado para exclusão.", "error");
        return;
    }

    const c = await Swal.fire({
        title: "Excluir departamento?",
        text: "Essa ação não poderá ser desfeita!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sim, excluir",
        cancelButtonText: "Cancelar"
    });
    if (!c.isConfirmed) return;

    try {
        const resp = await fetch("/hub_departamentos/excluir", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id })
        });
        const data = await resp.json();

        if (resp.ok) {
            window.parent.postMessage({ grupo: "atualizarTabela" }, "*");
            await Swal.fire("Excluído!", data.message || "Departamento excluído com sucesso.", "success");
            GlobalUtils.fecharJanelaApoio(nivelModal);
        } else {
            Swal.fire("Erro", data.erro || "Erro ao excluir.", "error");
        }
    } catch (erro) {
        console.error("❌ Erro ao excluir:", erro);
        Swal.fire("Erro", "Erro inesperado ao excluir.", "error");
    }
}
