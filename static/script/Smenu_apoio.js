console.log("📘 Smenu_apoio.js carregado");

let idMenu = null;
let nivelModal = 1;

document.addEventListener("DOMContentLoaded", () => {
  configurarEventos();
  carregarCombos();

  // Recebe id/nivel do principal (padrão TECH)
  GlobalUtils.receberDadosApoio(async function (id, nivel) {
    idMenu = id || null;
    nivelModal = nivel || 1;

    document.querySelector("#id").value = idMenu ? idMenu : "NOVO";

    // Defaults
    document.querySelector("#statusToggle").checked = true;
    document.querySelector("#statusLabel").textContent = "Ativo";
    document.querySelector("#paiToggle").checked = false;
    document.querySelector("#paiLabel").textContent = "Não";
    document.querySelector("#assinaturaToggle").checked = false;
    document.querySelector("#assinaturaLabel").textContent = "Não";
    document.querySelector("#valor").value = "0.00";

    if (!idMenu) return;

    try {
      const resp = await fetch(`/menu/apoio/${idMenu}`, { method: "GET" });
      if (!resp.ok) throw new Error("Erro ao buscar dados do menu");
      const dados = await resp.json();
      preencherFormulario(dados);
    } catch (erro) {
      console.error("❌ Erro ao carregar menu:", erro);
      Swal.fire("Erro", "Erro ao carregar dados do menu.", "error");
    }
  });
});

function configurarEventos() {
  document.querySelector("#btnSalvar").addEventListener("click", salvarMenu);
  document.querySelector("#btnExcluir").addEventListener("click", excluirMenu);

  document.querySelector("#statusToggle").addEventListener("change", (e) => {
    document.getElementById("statusLabel").textContent = e.target.checked ? "Ativo" : "Inativo";
  });
  document.querySelector("#paiToggle").addEventListener("change", (e) => {
    document.getElementById("paiLabel").textContent = e.target.checked ? "Sim" : "Não";
  });
  document.querySelector("#assinaturaToggle").addEventListener("change", (e) => {
    document.getElementById("assinaturaLabel").textContent = e.target.checked ? "Sim" : "Não";
  });
}

function carregarCombos() {
  fetch("/menu/combos")
    .then(r => r.json())
    .then(c => {
      // ícones
      const icSel = document.getElementById("icone");
      (c.icones || []).slice().sort().forEach(n => {
        const o = document.createElement("option");
        o.value = n; o.textContent = n;
        icSel.appendChild(o);
      });

      // tipo_abrir
      const taSel = document.getElementById("tipo_abrir");
      (c.tipos_abrir || ["index", "nova_aba", "popup"]).forEach(n => {
        const o = document.createElement("option");
        o.value = n; o.textContent = n;
        taSel.appendChild(o);
      });

      // parents (pai=true)
      const pSel = document.getElementById("parent_id");
      const o0 = document.createElement("option");
      o0.value = ""; o0.textContent = "(sem parent)";
      pSel.appendChild(o0);
      (c.pais || []).forEach(p => {
        const o = document.createElement("option");
        o.value = p.id;
        o.textContent = `${p.nome_menu} (${p.id})`;
        pSel.appendChild(o);
      });

      // módulos
      const mSel = document.getElementById("modulo");
      (c.modulos || ["HUB","Financeiro","Reembolso","Adiantamentos","Marktplace", "NF_hub"]).forEach(n => {
        const o = document.createElement("option");
        o.value = n; o.textContent = n;
        mSel.appendChild(o);
      });
    });
}

function toBRLinput(numeric) {
  if (numeric === null || numeric === undefined) return "0,00";
  return Number(numeric).toFixed(2).replace(".", ",");
}
function fromBRLinput(txt) {
  if (!txt) return 0;
  return parseFloat(String(txt).replace(/\./g, "").replace(",", ".") || "0");
}

function preencherFormulario(d) {
  document.querySelector("#nome_menu").value = d.nome_menu || "";
  document.querySelector("#descricao").value = d.descricao || "";
  document.querySelector("#data_page").value = d.data_page || "";
  document.querySelector("#icone").value = d.icone || "";
  document.querySelector("#tipo_abrir").value = d.tipo_abrir || "";
  document.querySelector("#parent_id").value = d.parent_id ?? "";
  document.querySelector("#ordem").value = d.ordem ?? "";
  document.querySelector("#statusToggle").checked = !!d.status;
  document.getElementById("statusLabel").textContent = d.status ? "Ativo" : "Inativo";
  document.querySelector("#modulo").value = d.modulo || "";
  document.querySelector("#obs").value = d.obs || "";
  document.querySelector("#paiToggle").checked = !!d.pai;
  document.getElementById("paiLabel").textContent = d.pai ? "Sim" : "Não";

  document.querySelector("#assinaturaToggle").checked = !!d.assinatura_app;
  document.getElementById("assinaturaLabel").textContent = d.assinatura_app ? "Sim" : "Não";

  document.querySelector("#valor").value = Number(d.valor ?? 0).toFixed(2);
}

async function excluirMenu() {
  const idRaw = document.getElementById("id")?.value?.trim();
  if (!idRaw || idRaw === "NOVO") {
    await Swal.fire("Erro", "Nenhum menu selecionado para excluir.", "error");
    return false;
  }
  const id = Number(idRaw);

  const r = await Swal.fire({
    title: "Excluir menu?",
    text: "Essa ação não poderá ser desfeita.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sim, excluir",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
    focusCancel: true,
  });
  if (!r.isConfirmed) return false;

  try {
    const resp = await fetch("/menu/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id }),
    });
    const json = await resp.json().catch(() => ({}));

    if (resp.ok && (json.ok === true || json.sucesso === true)) {
      await Swal.fire("Excluído!", "Menu excluído com sucesso.", "success");
      window.parent.postMessage({ grupo: "atualizarTabela" }, "*");
      try { GlobalUtils.fecharJanelaApoio(nivelModal); } catch {}
      return true;
    }

    await Swal.fire("Erro", json.erro || "Erro ao excluir menu.", "error");
    return false;
  } catch (e) {
    console.error("❌ Erro ao excluir menu:", e);
    await Swal.fire("Erro", "Erro inesperado ao excluir menu.", "error");
    return false;
  }
}

async function salvarMenu() {
  const idTxt = document.querySelector("#id").value;

  // 🔑 parent_id coerente (Number ou null)
  const parentRaw = document.querySelector("#parent_id").value;
  const parentId = parentRaw === "" ? null : Number(parentRaw);

  const body = {
    id: (idTxt === "NOVO") ? null : Number(idTxt),
    nome_menu: document.querySelector("#nome_menu").value.trim(),
    descricao: document.querySelector("#descricao").value.trim(),
    data_page: document.querySelector("#data_page").value.trim(),
    icone: document.querySelector("#icone").value || null,
    tipo_abrir: document.querySelector("#tipo_abrir").value || "index",
    parent_id: parentId,
    ordem: document.querySelector("#ordem").value ? parseInt(document.querySelector("#ordem").value, 10) : null,
    status: document.querySelector("#statusToggle").checked,
    modulo: document.querySelector("#modulo").value || null,
    obs: document.querySelector("#obs").value.trim() || null,
    pai: document.querySelector("#paiToggle").checked,
    assinatura_app: document.querySelector("#assinaturaToggle").checked,
    valor: fromBRLinput(document.querySelector("#valor").value)
  };

  if (!body.nome_menu) {
    return Swal.fire("Atenção", "Informe o nome do menu.", "warning");
  }

  try {
    const resp = await fetch("/menu/salvar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const json = await resp.json();

    if (resp.ok && json.ok) {
      Swal.fire({
        title: "Menu salvo com sucesso!",
        text: "Deseja cadastrar outro?",
        icon: "success",
        showCancelButton: true,
        confirmButtonText: "Sim",
        cancelButtonText: "Não"
      }).then(result => {
        // avisa a tela principal
        window.parent.postMessage({ grupo: "atualizarTabela" }, "*");
        if (result.isConfirmed) {
          limparCampos();
        } else {
          try { GlobalUtils.fecharJanelaApoio(nivelModal); } catch {}
        }
      });
    } else {
      Swal.fire("Erro", json.erro || "Erro ao salvar menu.", "error");
    }
  } catch (e) {
    console.error("❌ Erro ao salvar menu:", e);
    Swal.fire("Erro", "Erro inesperado ao salvar menu.", "error");
  }
}

function limparCampos() {
  idMenu = null;
  document.querySelector("#id").value = "NOVO";
  document.querySelector("#nome_menu").value = "";
  document.querySelector("#descricao").value = "";
  document.querySelector("#data_page").value = "";
  document.querySelector("#icone").value = "";
  document.querySelector("#tipo_abrir").value = "index";
  document.querySelector("#parent_id").value = "";
  document.querySelector("#ordem").value = "";
  document.querySelector("#statusToggle").checked = true;
  document.getElementById("statusLabel").textContent = "Ativo";
  document.querySelector("#modulo").value = "";
  document.querySelector("#obs").value = "";
  document.querySelector("#paiToggle").checked = false;
  document.getElementById("paiLabel").textContent = "Não";
  document.querySelector("#assinaturaToggle").checked = false;
  document.getElementById("assinaturaLabel").textContent = "Não";
  document.querySelector("#valor").value = "0.00";
}
