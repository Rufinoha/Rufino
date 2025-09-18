console.log("📘 Shub_categoria_contas_apoio.js carregado");

let idCategoria = 0;
let nivelModal = 1;

// helper para fechar este apoio (iframe)
function fecharApoio() {
  try {
    // fecha pelo nível recebido do parent; se não tiver, fecha o topo
    if (window.parent && window.parent.GlobalUtils?.fecharJanelaApoio) {
      window.parent.GlobalUtils.fecharJanelaApoio(nivelModal);
    }
  } catch (e) {
    console.warn("Não foi possível fechar o apoio:", e);
  }
}


/* ──────────────────────────────────────────────────────────────
   BOOT: binds + carga inicial
   ────────────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const precisa = [
    "ob_btnSalvar","ob_btnLimpar","onde_usa","tipo_plano",
    "conta_display","panelConta","conta_busca","conta_status",
    "conta_lista","id_conta_contabil","ob_listaContas"
  ];
  precisa.forEach((id) => { if (!$(id)) throw new Error(`#${id} não encontrado`); });

  $("ob_btnSalvar").addEventListener("click", salvarConta);
  $("ob_btnLimpar").addEventListener("click", limparFormulario);

  // ações da tabela
  $("ob_listaContas").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = parseInt(btn.dataset.id, 10);
    if (btn.classList.contains("btnExcluir"))   return excluirConta(id);
    if (btn.classList.contains("btnAlternar"))  return alternarStatus(id);
    if (btn.classList.contains("btnEditar"))    return preencherFormularioAPartirDoVinculo(id); // opcional
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") fecharApoio();
  });


});

/* ──────────────────────────────────────────────────────────────
   RECEBE DADOS DO PRINCIPAL
   ────────────────────────────────────────────────────────────── */
GlobalUtils.receberDadosApoio((id, nivel) => {
  idCategoria = id;
  nivelModal = nivel || 1;
  const out = document.getElementById("id_categoria");
  if (out) out.value = idCategoria;

  carregarOndeUsaCombo();
  initComboPlanoContas();  // combobox padrão
  carregarContas();
});

/* ──────────────────────────────────────────────────────────────
   COMBO: Onde Usa
   ────────────────────────────────────────────────────────────── */
async function carregarOndeUsaCombo(selecionado = "") {
  const sel = document.getElementById("onde_usa");
  sel.innerHTML = `<option value="">Selecione</option>`;
  try {
    const r = await fetch("/categoria/Combobox/ondeusa");
    if (!r.ok) throw new Error("Falha ao carregar Onde Usa");
    const lista = await r.json();
    lista.forEach(m => {
      const opt = document.createElement("option");
      opt.value = String(m.id);
      opt.textContent = m.nome;
      if (String(selecionado) === String(m.id)) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.dispatchEvent(new Event("change"));
  } catch (e) {
    console.error(e);
    Swal.fire("Erro", "Não foi possível carregar a lista 'Onde Usa'.", "error");
  }
}

/* ──────────────────────────────────────────────────────────────
   COMBO: Plano de Contas (padrão Rufino, com níveis)
   ────────────────────────────────────────────────────────────── */
function initComboPlanoContas() {
  const tipo = document.getElementById("tipo_plano").value; // Ativo/Passivo/Resultado

  GlobalUtils.ComboboxBusca.attach({
    wrapSel:   "#comboConta",
    displaySel:"#conta_display",
    panelSel:  "#panelConta",
    searchSel: "#conta_busca", 
    listSel:   "#conta_lista",
    statusSel: "#conta_status",
    rota: `/categoria/combobox/plano_contas?tipo=${encodeURIComponent(tipo)}`, // backend filtra por "plano"
    minChars: 3,
    limite: 20,
    debounceMs: 300,
    // ordem hierárquica: folha (n5) e depois os pais
    linhas: [
      { campo: "n5" },
      { campo: "n4" },
      { campo: "n3" },
      { campo: "n2" }
      // { campo: "n1" } // habilite se o backend enviar também
    ],
    onSelect: (item) => {
      document.getElementById("id_conta_contabil").value = String(item.id); // salva o id da folha (nível 5)
      document.getElementById("conta_display").value = `${item.codigo} - ${item.descricao_final}`;
    },
    campoOcultoId: "id_conta_contabil"
  });

  // ao mudar o tipo, limpa e reanexa com o novo filtro
  document.getElementById("tipo_plano").addEventListener("change", () => {
    document.getElementById("id_conta_contabil").value = "";
    document.getElementById("conta_display").value = "";
    initComboPlanoContas();
  }, { once: true }); // evita múltiplos listeners
}

/* ──────────────────────────────────────────────────────────────
   TABELA
   ────────────────────────────────────────────────────────────── */
function carregarContas() {
  fetch(`/categoria/conta/dados?id_categoria=${idCategoria}`)
    .then(res => res.json())
    .then(dados => renderizarTabela(dados))
    .catch(() => {
      const tbody = document.getElementById("ob_listaContas");
      tbody.innerHTML = `<tr><td colspan="6">Erro ao carregar.</td></tr>`;
    });
}

function renderizarTabela(lista) { 
  const tbody = document.getElementById("ob_listaContas");
  tbody.innerHTML = "";

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="6">Nenhuma conta vinculada.</td></tr>`;
    return;
  }

  lista.forEach(item => {
    const iconeStatus = item.status ? 'visualizar' : 'ocultar';
    const textoStatus = item.status ? 'Inativar registro' : 'Ativar registro';
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.id}</td>
      <td>${item.onde_usa}</td>
      <td>${item.tipo_plano}</td>
      <td>${item.codigo_conta} - ${item.descricao_conta}</td>
      <td>${item.status ? "Ativo" : "Inativo"}</td>
      <td>
        <button class="Cl_BtnAcao btnAlternar" data-id="${item.id}" title="${textoStatus}">
          ${Util.gerarIconeTech(iconeStatus)}
        </button>
        <button class="Cl_BtnAcao btnExcluir" data-id="${item.id}" title="Excluir">
          ${Util.gerarIconeTech('excluir')}
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  lucide.createIcons();
}

/* ──────────────────────────────────────────────────────────────
   FORM: salvar / status / excluir / pré-carregar (Editar opcional)
   ────────────────────────────────────────────────────────────── */
function limparFormulario() {
  document.getElementById("onde_usa").value = "";
  document.getElementById("tipo_plano").value = "Ativo";
  document.getElementById("status").checked = true;
  document.getElementById("id_conta_contabil").value = "";
  document.getElementById("conta_display").value = "";
  // ComboboxBusca controla abrir/fechar painel sozinho
}

async function salvarConta() {
  const dados = {
    id_categoria: idCategoria,
    id_menu_onde_usa: document.getElementById("onde_usa").value,
    tipo_plano: document.getElementById("tipo_plano").value,
    id_conta_contabil: document.getElementById("id_conta_contabil").value,
    status: document.getElementById("status").checked
  };

  if (!dados.id_menu_onde_usa) return Swal.fire("Atenção", "Preencha Onde Usa", "warning");
  if (!dados.tipo_plano)       return Swal.fire("Atenção", "Selecione o tipo do plano", "warning");
  if (!dados.id_conta_contabil)return Swal.fire("Atenção", "Selecione uma conta contábil", "warning");

  try {
    const resp = await fetch("/categoria/conta/salvar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados)
    });
    const json = await resp.json();

    if (json.retorno) {
      await Swal.fire("Sucesso", json.msg || "Salvo com sucesso.", "success");
      // avisa a página mãe (lista) para recarregar
      window.parent?.postMessage({ grupo: "atualizarTabela" }, "*");
      // fecha o apoio deste nível
      fecharApoio();
      return;
    }

    await Swal.fire("Erro", json.msg || "Erro ao salvar.", "error");
  } catch (e) {
    await Swal.fire("Erro", "Erro inesperado ao salvar.", "error");
  }
}


async function alternarStatus(id) {
  const resp = await fetch(`/categoria/conta/ativar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id })
  });
  const json = await resp.json();
  if (json.retorno) {
    Swal.fire("Sucesso", json.msg, "success");
    carregarContas();
  } else {
    Swal.fire("Erro", json.msg || "Erro ao alternar status", "error");
  }
}

async function excluirConta(id) {
  const confirma = await Swal.fire({
    title: `Excluir vínculo ${id}?`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sim, excluir",
    cancelButtonText: "Cancelar"
  });
  if (!confirma.isConfirmed) return;

  try {
    const resp = await fetch("/categoria/conta/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    const json = await resp.json();

    if (json.retorno) {
      await Swal.fire("Excluído!", json.msg || "Registro removido.", "success");
      window.parent?.postMessage({ grupo: "atualizarTabela" }, "*");
      fecharApoio();
      return;
    }

    await Swal.fire("Erro", json.msg || "Erro ao excluir.", "error");
  } catch (e) {
    await Swal.fire("Erro", "Erro inesperado ao excluir.", "error");
  }
}


// Opcional: botão "Editar" apenas pré-carrega o form; salvar continua inclusão
async function preencherFormularioAPartirDoVinculo(idVinculo) {
  try {
    const resp = await fetch("/categoria/conta/apoio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: idVinculo })
    });
    const v = await resp.json();
    if (!resp.ok) throw new Error(v.msg || "Falha ao carregar vínculo");

    document.getElementById("onde_usa").value   = String(v.id_menu_onde_usa || "");
    document.getElementById("tipo_plano").value = v.tipo_plano || "Ativo";
    document.getElementById("status").checked   = !!v.status;

    // Preenche o display/hidden do combobox padrão
    document.getElementById("id_conta_contabil").value = String(v.id_conta_contabil || "");
    document.getElementById("conta_display").value = v.codigo_conta && v.descricao_conta
      ? `${v.codigo_conta} - ${v.descricao_conta}` : "";

    document.getElementById("ob_btnSalvar").focus();
  } catch (err) {
    console.error(err);
    Swal.fire("Erro", "Não foi possível pré-carregar o formulário.", "error");
  }
}
