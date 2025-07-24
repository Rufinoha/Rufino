console.log("📘 Shub_categoria_contas_apoio.js carregado");

let idCategoria = 0;
let nivelModal = 1;

// ✅ Recebe ID da categoria via modal
GlobalUtils.receberDadosApoio(function (id, nivel) {
  idCategoria = id;
  nivelModal = nivel || 1;
  document.getElementById("id_categoria").value = idCategoria;
  carregarContas();
});

document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("ob_btnSalvar").onclick = salvarConta;
  document.getElementById("ob_btnLimpar").onclick = limparFormulario;
  document.getElementById("combo_conta").onclick = abrirBuscaConta;
  document.getElementById("conta_contabil_input").addEventListener("input", buscarSugestoesConta);

  document.getElementById("ob_listaContas").addEventListener("click", async function (e) {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = parseInt(btn.dataset.id);
    if (btn.classList.contains("btnExcluir")) excluirConta(id);
    if (btn.classList.contains("btnAlternar")) alternarStatus(id);
  });
});

// ✅ Limpa formulário
function limparFormulario() {
  document.getElementById("id_conta_categoria").value = "";
  document.getElementById("onde_usa").value = "";
  document.getElementById("tipo_plano").value = "Ativo";
  document.getElementById("status").checked = true;
  document.getElementById("id_conta_contabil").value = "";
  document.getElementById("conta_contabil_input").value = "";
  document.getElementById("combo_display").value = "";
  document.getElementById("combo_area").style.display = "none";
}

// ✅ Carrega tabela contas
function carregarContas() {
  fetch(`/categoria/conta/dados?id_categoria=${idCategoria}`)
    .then(res => res.json())
    .then(dados => renderizarTabela(dados));
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
      <td>${item.descricao_conta}</td>
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
    lucide.createIcons();
  });
}


// ✅ Salvar conta
async function salvarConta() {
  const dados = {
    id_categoria: idCategoria,
    onde_usa: document.getElementById("onde_usa").value,
    tipo_plano: document.getElementById("tipo_plano").value,
    id_conta_contabil: document.getElementById("id_conta_contabil").value,
    status: document.getElementById("status").checked
  };

  if (!dados.onde_usa) return Swal.fire("Atenção", "Preencha Onde Usa", "warning");
  if (!dados.tipo_plano) return Swal.fire("Atenção", "Selecione o tipo do plano", "warning");
  if (!dados.id_conta_contabil) return Swal.fire("Atenção", "Selecione uma conta contábil", "warning");

  const resp = await fetch("/categoria/conta/salvar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados)
  });

  const json = await resp.json();
  if (json.retorno) {
    Swal.fire("Sucesso", json.msg, "success");
    carregarContas();
    limparFormulario();
  } else Swal.fire("Erro", json.msg || "Erro ao salvar", "error");
}

// ✅ Alternar Status
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

// ✅ Excluir conta
async function excluirConta(id) {
  const confirma = await Swal.fire({
    title: `Excluir vínculo ${id}?`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sim, excluir",
    cancelButtonText: "Cancelar"
  });
  if (!confirma.isConfirmed) return;

  const resp = await fetch("/categoria/conta/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id })
  });
  const json = await resp.json();
  if (json.retorno) {
    Swal.fire("Excluído!", json.msg, "success");
    carregarContas();
  } else Swal.fire("Erro", json.msg || "Erro ao excluir", "error");
}

// ✅ Autocomplete conta contábil
function abrirBuscaConta() {
  const area = document.getElementById("combo_area");
  area.style.display = area.style.display === "block" ? "none" : "block";
  document.getElementById("conta_contabil_input").focus();
}

let timer = null;
function buscarSugestoesConta() {
  clearTimeout(timer);
  const termo = document.getElementById("conta_contabil_input").value.trim();
  if (termo.length < 3) return;
  timer = setTimeout(async () => {
    const tipo = document.getElementById("tipo_plano").value;
    const resp = await fetch(`/plano_contas/buscar?termo=${encodeURIComponent(termo)}&tipo=${tipo}`);
    const lista = await resp.json();
    const ul = document.getElementById("sugestoes_contas");
    ul.innerHTML = lista.length
      ? lista.map(c => `<li class="autocomplete-item" onclick="selecionarConta('${c.id}','${c.codigo}','${c.descricao_final}')">${c.codigo} - ${c.descricao_final}</li>`).join("")
      : `<li class="autocomplete-item">Nenhum resultado</li>`;
  }, 300);
}

function selecionarConta(id, codigo, descricao) {
  document.getElementById("id_conta_contabil").value = id;
  document.getElementById("combo_display").value = `${codigo} - ${descricao}`;
  document.getElementById("combo_area").style.display = "none";
  document.getElementById("sugestoes_contas").innerHTML = "";
}
