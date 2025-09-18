console.log("📘 Shub_favorecido_apoio.js carregado");

// DEBUG central p/ silenciar/ativar facilmente
const __DEBUG_CATEG__ = true;
const _logC = (...args) => { if (__DEBUG_CATEG__) console.log("🧭 CATEG:", ...args); };

let id_favorecido = null; // id do registro em edição (querystring ou postMessage)

/* ============================ D2. POSTMESSAGE ============================== */
/** Recebe id do hub quando a janela-apoio é aberta via postMessage */
window.addEventListener("message", async (event) => {
  if (event.data?.grupo !== "dadosApoio") return;

  id_favorecido = event.data.id || null;
  _logC("postMessage → dadosApoio:", { id_favorecido });

  if (id_favorecido) {
    await carregarFavorecido(id_favorecido);
  } else {
    limparFormulario();
  }
});

/* ========================= D3. DOM READY / BOOTSTRAP ======================= */
window.addEventListener("DOMContentLoaded", async () => {
  // avisa o hub que a janela-apoio está pronta
  window.opener?.postMessage({ grupo: "apoioPronto" }, "*");

  // --- COMBO: Categoria (1 linha) ------------------------------------------
  GlobalUtils.ComboboxBusca.attach({
    wrapSel:   "#comboCategoria",
    displaySel:"#categoria_display",
    panelSel:  "#panelCategoria",
    searchSel: "#categoria_busca",
    listSel:   "#categoria_lista",
    statusSel: "#categoria_status",

    rota: "/hub/categoria/lookup",
    minChars: 2,
    limite: 30,

    linhas: [{ campo: "nome_categoria" }],

    mapeador: (it) => ({
      id: it.id,
      nome_categoria: it.nome_categoria,
      label: it.nome_categoria
    }),

    campoOcultoId: "id_categoria",
  });

  // id pela querystring (edição direta)
  const registroId = new URLSearchParams(window.location.search).get("id");
  if (registroId) {
    id_favorecido = registroId;
    await carregarFavorecido(id_favorecido);
  }

  // ===== binds de UI =====
  document.getElementById("tipo").addEventListener("change", aplicarComportamentoTipoFavorecido);
  document.getElementById("razao_social").addEventListener("blur", preencherPrimeiroNome);
  document.getElementById("ob_btnSalvar").addEventListener("click", salvarFavorecido);
  document.getElementById("ob_btnexcluir").addEventListener("click", excluirFavorecido);
  document.getElementById("btnBuscarCEP").addEventListener("click", buscarCep);
  document.getElementById("btnBuscarCNPJ").addEventListener("click", buscarCnpj);

  // máscara dinâmica para CPF/CNPJ (usa Util já existente)
  document.getElementById("documento").addEventListener("input", () => {
    const el = document.getElementById("documento");
    const tipo = document.getElementById("tipo").value === "F" ? "cpf" : "cnpj";
    el.value = window.Util.formatarCNPJ(el.value, tipo);
  });
});

/* ========================= A. LÓGICA DE INTERFACE ========================== */
/** Aplica máscaras e visibilidade conforme tipo (PF/PJ) */
function aplicarComportamentoTipoFavorecido() {
  const tipo = document.getElementById("tipo").value;
  const isFisica = tipo === "F";

  document.querySelector("label[for='documento']").textContent = isFisica ? "CPF:" : "CNPJ:";
  document.getElementById("btnBuscarCNPJ").style.display = isFisica ? "none" : "inline-block";
  document.querySelector("label[for='razao_social']").textContent = isFisica ? "Nome Completo:" : "Razão Social:";
  document.querySelector("label[for='nome']").textContent = isFisica ? "Primeiro Nome:" : "Nome Amigável:";
  document.querySelector("label[for='data_abertura']").textContent = isFisica ? "Data de Nascimento:" : "Data de Abertura:";

  // alterna blocos por data-tipo
  document.querySelectorAll('.form-campo[data-tipo]').forEach(el => el.classList.remove("ativo"));
  document.querySelectorAll(`.form-campo[data-tipo="${isFisica ? "pf" : "pj"}"]`).forEach(el => el.classList.add("ativo"));
}

/** Se PF, preenche "nome" com o primeiro nome extraído de razão_social */
function preencherPrimeiroNome() {
  if (document.getElementById("tipo").value !== "F") return;
  const nomeCompleto = document.getElementById("razao_social").value.trim();
  const primeiroNome = nomeCompleto.split(" ")[0] || "";
  document.getElementById("nome").value = primeiroNome;
}

/** Limpa o formulário para estado de inclusão */
function limparFormulario() {
  const form = document.getElementById("formFavorecido");
  const inputs = form.querySelectorAll("input");
  const selects = form.querySelectorAll("select");

  inputs.forEach(input => { if (input.type !== "hidden") input.value = ""; });
  selects.forEach(select => { select.selectedIndex = 0; });

  // zera categoria (hidden + display)
  const hidden = document.getElementById("id_categoria");
  const display = document.getElementById("categoria_display");
  if (hidden) hidden.value = "";
  if (display) display.value = "";

  aplicarComportamentoTipoFavorecido();
}

/* ================================ C. API CALLS ============================= */
/** GET /favorecido/apoio/:id  → preenche todos os campos (incluindo datas) */
async function carregarFavorecido(id) {
  try {
    const resp = await fetch(`/favorecido/apoio/${id}`);
    if (!resp.ok) throw new Error("Registro não encontrado");

    const dados = await resp.json();

    _logC("carregarFavorecido → dados:", {
      id_categoria: dados?.id_categoria,
      categoria_nome: dados?.categoria_nome
    });

    const CAMPOS_DATA = ["data_abertura", "data_situacao"];

    // datas → ISO (YYYY-MM-DD) usando util oficial
    for (const c of CAMPOS_DATA) {
      const el = document.getElementById(c);
      if (el) el.value = window.Util.paraDataISO(dados[c]) || "";
    }

    // demais campos
    for (const campo in dados) {
      if (CAMPOS_DATA.includes(campo)) continue;
      const el = document.getElementById(campo);
      if (!el && campo !== "id_categoria") continue;

      if (campo === "id_categoria") {
        const valorId = String(dados[campo] ?? "");
        const nomeCat = dados.categoria_nome || "";

        const hidden  = document.getElementById("id_categoria");      // hidden (id real)
        const display = document.getElementById("categoria_display"); // texto visível

        if (hidden)  hidden.value  = valorId;
        if (display) display.value = nomeCat;
      } else if (campo === "status") {
        el.value = String(dados[campo]);
      } else if (el) {
        el.value = dados[campo] ?? "";
      }
    }
  } catch (err) {
    console.error("Erro ao carregar favorecido:", err);
    Swal.fire("Erro", "Não foi possível carregar os dados.", "error");
  }
}

/** POST /favorecido/salvar  → inclui/edita */
async function salvarFavorecido() {
  const form = document.getElementById("formFavorecido");

  // valida se o hidden da categoria está preenchido
  const idCategoria = (document.getElementById("id_categoria")?.value || "").trim();
  if (!idCategoria) {
    await Swal.fire("Atenção", "Selecione uma Categoria válida na lista.", "warning");
    document.getElementById("categoria_display")?.focus();
    return;
  }

  // valida obrigatórios
  const camposObrigatorios = [
    { id: "documento",     nome: "Documento (CPF ou CNPJ)" },
    { id: "razao_social",  nome: "Razão Social" },
    { id: "nome",          nome: "Nome Amigável" },
    { id: "id_categoria",  nome: "Categoria" },
    { id: "cep",           nome: "CEP" },
    { id: "logradouro",    nome: "Logradouro" },
    { id: "numero",        nome: "Número" },
    { id: "bairro",        nome: "Bairro" },
    { id: "cidade",        nome: "Cidade" },
    { id: "uf",            nome: "UF" }
  ];
  for (const campo of camposObrigatorios) {
    const el = document.getElementById(campo.id);
    if (!el || !String(el.value || "").trim()) {
      await Swal.fire("Atenção", `O campo "${campo.nome}" é obrigatório.`, "warning");
      el?.focus();
      return;
    }
  }

  // payload
  const dados = { id: document.getElementById("id").value || null };
  form.querySelectorAll("input, select, textarea").forEach(el => {
    if (el.id && el.id !== "id") dados[el.id] = (el.value ?? "").toString().trim();
  });

  try {
    const resp = await fetch("/favorecido/salvar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    });
    const json = await resp.json();

    if (resp.ok && json.sucesso) {
      Swal.fire("Sucesso", json.mensagem || "Favorecido salvo!", "success").then(() => {
        window.parent.postMessage({ grupo: "atualizarTabela" }, "*");
        GlobalUtils.fecharJanelaApoio(1);
      });
    } else {
      Swal.fire("Erro", json.mensagem || "Erro ao salvar.", "error");
    }
  } catch (err) {
    Swal.fire("Erro", "Erro ao se comunicar com o servidor.", "error");
  }
}

/** POST /favorecido/delete  → exclusão */
async function excluirFavorecido() {
  const id = document.getElementById("id").value;
  if (!id) return;

  const confirm = await Swal.fire({
    title: "Excluir?",
    text: "Essa ação não pode ser desfeita.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sim, excluir",
    cancelButtonText: "Cancelar",
  });
  if (!confirm.isConfirmed) return;

  try {
    const resp = await fetch("/favorecido/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const json = await resp.json();

    // aceita formatos diferentes de sucesso
    const ok = resp.ok && (json.sucesso === true || json.success === true || json.message || json.mensagem);

    if (ok) {
      await Swal.fire("Excluído", (json.mensagem || json.message || "Registro removido."), "success");
      window.parent?.postMessage({ grupo: "atualizarTabela" }, "*");
      const nivel = window.__nivelModal__ || 1;
      GlobalUtils.fecharJanelaApoio(nivel);
    } else {
      Swal.fire("Erro", (json.mensagem || json.erro || "Erro ao excluir."), "error");
    }
  } catch (err) {
    Swal.fire("Erro", "Erro ao se comunicar com o servidor.", "error");
  }
}

/** GET ViaCEP → preenche endereço */
async function buscarCep() {
  const btn = document.getElementById("btnBuscarCEP");
  const cep = document.getElementById("cep").value.replace(/\D/g, "");
  if (cep.length !== 8) { Swal.fire("CEP inválido", "Informe um CEP com 8 dígitos.", "warning"); return; }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);

  try {
    btn.disabled = true;
    mostrarAguarde("Consultando CEP...");
    const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: ctrl.signal });
    const data = await resp.json();
    if (data.erro) throw new Error("CEP não encontrado");

    document.getElementById("logradouro").value = data.logradouro || "";
    document.getElementById("complemento").value = data.complemento || "";
    document.getElementById("bairro").value     = data.bairro || "";
    document.getElementById("cidade").value     = data.localidade || "";
    document.getElementById("uf").value         = data.uf || "";
    Swal.close();
  } catch (error) {
    Swal.close();
    const msg = (error.name === "AbortError") ? "Tempo excedido na consulta do CEP." : error.message;
    Swal.fire("Erro ao buscar CEP", msg, "error");
  } finally {
    clearTimeout(timer);
    btn.disabled = false;
  }
}

/** POST /api/buscacnpj → preenche dados cadastrais da PJ */
async function buscarCnpj() {
  const btn   = document.getElementById("btnBuscarCNPJ");
  const cnpj  = document.getElementById("documento").value.replace(/\D/g, "");
  if (cnpj.length !== 14) { Swal.fire("CNPJ inválido", "Informe um CNPJ com 14 dígitos.", "warning"); return; }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);

  try {
    btn.disabled = true;
    mostrarAguarde("Consultando CNPJ...");

    const resp = await fetch("/api/buscacnpj", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cnpj }),
      signal: ctrl.signal
    });
    const data = await resp.json();
    if (data.erro) throw new Error(data.erro);

    document.getElementById("razao_social").value = data.razao_social || data.nome || "";
    document.getElementById("nome").value         = (data.fantasia || data.razao_social || data.nome || "").trim();
    document.getElementById("email").value        = data.email || "";
    document.getElementById("telefone").value     = data.telefone || "";

    document.getElementById("cep").value         = data.cep || "";
    document.getElementById("logradouro").value  = data.endereco || "";
    document.getElementById("numero").value      = data.numero || "";
    document.getElementById("bairro").value      = data.bairro || ""
    document.getElementById("cidade").value      = data.cidade || "";
    document.getElementById("uf").value          = data.uf || "";

    document.getElementById("inscricao_estadual").value = data.ie || "";
    document.getElementById("natureza_juridica").value  = data.natureza_juridica || "";
    document.getElementById("cnae_principal").value     = data.cnae_principal || "";
    document.getElementById("cnaes_secundarios").value  = data.cnaes_secundarios || "";
    document.getElementById("situacao_cadastral").value = data.situacao_cadastral || "";
    document.getElementById("data_abertura").value      = window.Util.paraDataISO(data.data_abertura);
    document.getElementById("data_situacao").value      = window.Util.paraDataISO(data.data_situacao);

    aplicarComportamentoTipoFavorecido();
    Swal.close();
  } catch (err) {
    Swal.close();
    const msg = (err.name === "AbortError") ? "Tempo excedido na consulta do CNPJ." : (err.message || "Falha ao consultar o CNPJ.");
    Swal.fire("Erro", msg, "error");
  } finally {
    clearTimeout(timer);
    btn.disabled = false;
  }
}

/** Caixa de “Aguarde…” padrão SweetAlert */
function mostrarAguarde(texto){
  Swal.fire({
    title: "Aguarde",
    text: texto || "Processando...",
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => { Swal.showLoading(); }
  });
}
