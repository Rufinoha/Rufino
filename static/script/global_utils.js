console.log("Global Utils - Carregado!")
// ------------------------------
// 🔧 OBJETOS GLOBAIS
// ------------------------------
window.App = window.App || {};
window.Util = window.Util || {};
window.GlobalUtils = window.GlobalUtils || {};

// --------------------------------------------------------
//SweetAlert padrão para todo o sistema
// --------------------------------------------------------
Swal = Swal.mixin({
  confirmButtonColor: '#85C300',
  cancelButtonColor: '#ccc',
  confirmButtonText: 'Confirmar',
  cancelButtonText: 'Cancelar'
});




// -----------------------------------------------------------------------------------------
// FUNÇÔES WINDOW GLOBAIS 
// -----------------------------------------------------------------------------------------

// CONTROLE DE SESSÃO
window.GlobalUtils.verificarSessaoExpirada = async function () {
  try {
    const resp = await fetch("/config/tempo_sessao", {
      method: "GET",
      credentials: "same-origin"
    });

    const data = await resp.json();
    const tempoMax = parseInt(data.valor || "30");

    const horaLogin = new Date(localStorage.getItem("horaLogin"));
    const agora = new Date();
    const minutos = (agora - horaLogin) / 60000;

    if (minutos >= tempoMax) {
      Swal.fire("⏱ Sessão expirada", "Você será redirecionado.", "info").then(() => {
        localStorage.removeItem("usuarioLogado");
        window.location.href = "/login.html";
      });
    }
  } catch (err) {
    console.warn("⚠️ Não foi possível verificar tempo de sessão:", err);
  }
};




// FUNÇÃO GLOBAL PARA CARREGAR PÁGINA DINAMICAMENTE
window.GlobalUtils.carregarPagina = async function (pagina) {
  const conteudo = document.getElementById("content-area");
  if (!conteudo) return;

  Object.keys(window).forEach(key => {
    if (key.endsWith("Hub")) {
      delete window[key];
    }
  });

  conteudo.innerHTML = "";
  document.querySelectorAll("script[data-page-script]").forEach(s => s.remove());

  let partes = pagina.split("/");
  let modulo = partes[0];
  let isModulo = pagina.startsWith("mod_");

  if (isModulo && partes.length < 2) {
    console.error(`Página inválida: "${pagina}" — módulo sem página`);
    Swal.fire("Erro", "Página inválida (módulo sem destino)", "error");
    return;
  }

  let rota = `/abrir_pagina/${pagina}`;

  let staticPath = isModulo
      ? `/static/${modulo.replace('mod_', '')}/script`
      : `/static/script`;

  let paginaNome = isModulo ? partes[1] : pagina;

  try {
    const res = await fetch(rota);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    conteudo.innerHTML = html;
    conteudo.setAttribute("data-page", pagina);

    await carregarScriptCDN("https://cdn.jsdelivr.net/npm/chart.js", "chartjs");
    await carregarScriptCDN("/static/script/global_utils.js", "globalutils");

    const script = document.createElement("script");
    script.src = `${staticPath}/S${paginaNome}.js?t=${Date.now()}`;
    script.defer = true;
    script.setAttribute("data-page-script", pagina);
    document.body.appendChild(script);

  } catch (err) {
    console.error(`Erro ao carregar ${pagina}`, err);
    Swal.fire("Erro", `Não foi possível abrir a página \"${pagina}\"`, "error");
  }
};



// Função para pegar informações do LOGADO no LocalStorage
window.GlobalUtils.getUsuarioLogado = function () {
  try {
    const json = localStorage.getItem("usuarioLogado");
    return json ? JSON.parse(json) : null;
  } catch (e) {
    console.warn("⚠️ Erro ao ler usuarioLogado do localStorage:", e);
    return null;
  }
};



// ----------------------------------------------------------------------------------------------
/******************** esse trecho é pra ser usado na janela principal *************************** */
window.GlobalUtils.abrirJanelaApoioModal = function ({
  rota,
  id = null,
  titulo = "Apoio",
  largura = 1000,
  altura = 600,
  nivel = 1
}) {
  const overlayId = `modalApoioOverlay_nivel${nivel}`;
  const janelaId = `modalApoioJanela_nivel${nivel}`;

  // Impede reabertura no mesmo nível
  if (document.getElementById(overlayId)) {
    return;
  }

  // Cria o overlay de fundo
  const overlay = document.createElement("div");
  overlay.id = overlayId;
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0,0,0,0.4); z-index: ${9998 + nivel * 2};
    display: flex; align-items: center; justify-content: center;
  `;

  // Cria o modal
  const modal = document.createElement("div");
  modal.id = janelaId;
  modal.style.cssText = `
    background: white; border-radius: 10px; overflow: hidden;
    width: ${largura}px; height: ${altura}px; position: relative;
    display: flex; flex-direction: column;
    box-shadow: 0 0 20px rgba(0,0,0,0.4);
  `;

  // Cabeçalho
  const header = document.createElement("div");
  header.style.cssText = `
    background: #85C300; color: white; padding: 10px 15px;
    font-weight: bold; display: flex; justify-content: space-between;
    align-items: center; font-size: 18px;
  `;
  header.innerHTML = `
    <span>${titulo}</span>
    <button data-fechar-nivel="${nivel}" style="background:none;border:none;color:white;font-size:20px;cursor:pointer">✖</button>
  `;

  // Corpo do modal com iframe
  const iframe = document.createElement("iframe");
  iframe.src = rota;
  iframe.style.cssText = "border:none;flex:1;";
  iframe.setAttribute("data-apoio", "iframe");

  // Monta a estrutura
  modal.appendChild(header);
  modal.appendChild(iframe);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Botão fechar manual
  header.querySelector("button").onclick = () => {
    window.GlobalUtils.fecharJanelaApoio(nivel);
  };

  // Comunicação com o iframe
  iframe.onload = () => {
    setTimeout(() => {
      const payload = id !== null
        ? { grupo: "carregarApoio", id }
        : { grupo: "apoioPronto" };

      iframe.contentWindow.postMessage(payload, "*");
    }, 100);
  };
};




// -------------------------------------------------------------------------------------------------
/***************** Função padrão para receber dados no apoio via postMessage **********************/
window.GlobalUtils.receberDadosApoio = function (callback) {

  window.addEventListener("message", (event) => {

    if (!event.data?.grupo) {
      console.warn("⚠️ Mensagem ignorada: sem 'grupo' definido.");
      return;
    }

    // Armazena nível (se vier)
    const nivel = event.data.nivel !== undefined ? event.data.nivel : 1;
    window.__nivelModal__ = nivel;

    if (event.data.grupo === "carregarApoio" && event.data.id !== undefined) {
      callback(event.data.id, nivel);
    }

    if (event.data.grupo === "apoioPronto") {
      callback(null, nivel);
    }
  });
};






// -------------------------------------------------------------------------------------------------
/*************************** Função padrão para FECHAR o apoio  ***********************************/
window.GlobalUtils.fecharJanelaApoio = function (nivel) {
  const overlayId = `modalApoioOverlay_nivel${nivel}`;
  const overlay = window.parent?.document.getElementById(overlayId);

  if (overlay) {
    overlay.remove();
  } else {
    console.warn(`Nenhum modal encontrado no nível ${nivel}`);
  }
};







// ------------------------------
// 🛠️ FUNÇÕES UTILITÁRIAS
// ------------------------------

// Função para Carregar combobox do tipo de categorias
window.Util.TIPOS_ORIGEM = [
  "Favorecido",
  "Funcionário",
  "Livro Diário",
  "Projetos",
  "Reembolso"
];


// TIPOS DE CONTA PADRÃO (aqui é pra carregar no combobox do livro diário)
window.Util.TIPOS_CONTA_PADRAO = [
  { valor: "Banco", label: "Conta Bancária" },
  { valor: "Cartão", label: "Cartão de Crédito" },
  { valor: "Digital", label: "Conta Digital" },
  { valor: "Investimento", label: "Conta de Investimento" },
  { valor: "Adiantamento", label: "Adiantamento a Funcionário" },
  { valor: "Pré-pago", label: "Cartão Pré-pago" }
];



// Função para carregar categorias no combobox
window.GlobalUtils.carregarCategorias = async function (
  ondeUsa,
  idSelect = "id_categoria",
  valorSelecionado = null
) {
  try {
    const select = document.getElementById(idSelect);
    if (!select) return;

    select.innerHTML = '<option value="">Selecione</option>';

    let id_empresa = window.App?.Varidcliente;
    if (!id_empresa) {
      id_empresa = sessionStorage.getItem("id_empresa");
    }

    if (!id_empresa || !ondeUsa) {
      console.warn("🔸 Filtros insuficientes para carregar categorias.");
      return;
    }

    const resp = await fetch(`/combobox/categorias?id_empresa=${id_empresa}&onde_usa=${ondeUsa}`);
    const categorias = await resp.json();

    categorias.forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat.id;
      opt.textContent = cat.nome_categoria;
      if (valorSelecionado && valorSelecionado == cat.id) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });
  } catch (e) {
    console.error("Erro ao carregar categorias:", e);
  }
};





// Função para carregar plano de contas no combobox
window.GlobalUtils.carregarPlanoContas = async function ({
  idInputId = "id_planocontas",
  comboInputId = "combo_display",
  areaId = "combo_area",
  inputBuscaId = "conta_contabil_input",
  listaId = "sugestoes_contas",
  valorSelecionado = null,
  descricaoPreenchida = ""
} = {}) {
  const combo = document.getElementById(comboInputId);
  const area = document.getElementById(areaId);
  const inputBusca = document.getElementById(inputBuscaId);
  const lista = document.getElementById(listaId);
  const inputId = document.getElementById(idInputId);

  if (!combo || !area || !inputBusca || !lista || !inputId) return;

  combo.addEventListener("click", () => {
    area.style.display = "block";
    inputBusca.focus();
  });

  inputBusca.addEventListener("input", async () => {
    const termo = inputBusca.value.trim();
    if (termo.length < 3) {
      lista.innerHTML = "<li class='autocomplete-item'>Digite 3 ou mais caracteres</li>";
      return;
    }

    try {
      const resp = await fetch(`/combobox/plano_contas?termo=${encodeURIComponent(termo)}`);
      const sugestoes = await resp.json();
      lista.innerHTML = "";

      if (!sugestoes.length) {
        lista.innerHTML = "<li class='autocomplete-item'>Nenhum resultado encontrado</li>";
        return;
      }

      sugestoes.forEach(item => {
        const li = document.createElement("li");
        li.className = "autocomplete-item";
        li.textContent = `${item.descricao} | ${item.plano}`;
        li.addEventListener("click", () => {
          inputId.value = item.id;
          combo.value = `${item.descricao} | ${item.plano}`;
          combo.innerText = `${item.descricao} | ${item.plano}`;
          inputBusca.value = "";
          lista.innerHTML = "";
          area.style.display = "none";
        });
        lista.appendChild(li);
      });

    } catch (e) {
      console.error("Erro ao buscar plano de contas:", e);
      lista.innerHTML = "<li class='autocomplete-item'>Erro ao buscar dados</li>";
    }
  });

  document.addEventListener("click", (e) => {
    if (!combo.contains(e.target) && !area.contains(e.target)) {
      area.style.display = "none";
    }
  });

  if (valorSelecionado && descricaoPreenchida) {
    inputId.value = valorSelecionado;
    combo.value = descricaoPreenchida;
    combo.innerText = descricaoPreenchida;
  }
};


// Função para carregar formas de pagamento no combobox
window.GlobalUtils.carregarFormasPagamento = async function (idSelect, id_empresa) {
  if (!id_empresa) return;

  try {
    const resp = await fetch(`/combobox/formas_pagamento?id_empresa=${id_empresa}`);
    const lista = await resp.json();

    const select = document.getElementById(idSelect);
    if (!select) return;

    select.innerHTML = `<option value="">Selecione</option>`;
    lista.forEach(fp => {
      const opt = document.createElement("option");
      opt.value = fp.id;
      opt.textContent = fp.nome_exibicao;
      select.appendChild(opt);
    });
  } catch (e) {
    console.warn("Erro ao carregar formas de pagamento:", e);
  }
};


// Função para limpar o LocalStorage do usuário, mantendo apenas a aceitação de cookies
window.GlobalUtils.limparStorageUsuario = function () {
  Object.keys(localStorage).forEach(chave => {
    if (chave !== "cookie_aceito") {
      localStorage.removeItem(chave);
    }
  });
};


// -----------------------------------------------------------------------------------------
// FUNÇÔES ASYNC/AWAIT
// -----------------------------------------------------------------------------------------

// CARREGAR CONFIGURAÇÕES
async function carregarConfiguracoes() {
  try {
    if (!App.Varidcliente) return console.warn("⚠️ App.Varidcliente não definido ainda.");

    const response = await fetch(`/configuracoes/${App.Varidcliente}`);
    const data = await response.json();

    if (data.success) {
      window.Config = data.config;
    } else {
      console.error("Erro ao buscar configurações:", data.message);
    }
  } catch (error) {
    console.error("Erro ao buscar configurações:", error);
  }
}


// FUNÇÃO PARA CARREGAR SCRIPTS EXTERNOS UMA ÚNICA VEZ
async function carregarScriptCDN(src, id = null) {
  return new Promise((resolve, reject) => {
    if (id && document.getElementById(id)) return resolve(); // já carregado
    const script = document.createElement("script");
    script.src = src;
    if (id) script.id = id;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}





// -----------------------------------------------------------------------------------------
// FUNÇÔES WINDOW UTIL
// -----------------------------------------------------------------------------------------

// Formatar Data para DD/MM/YYYY — versão aprimorada
window.Util.formatarData = function (data) {
  if (!data) return "";

  try {
    const dt = new Date(data);
    if (isNaN(dt)) return data; // se não for uma data válida, retorna como está

    const dia = String(dt.getDate()).padStart(2, "0");
    const mes = String(dt.getMonth() + 1).padStart(2, "0");
    const ano = dt.getFullYear();

    return `${dia}/${mes}/${ano}`;
  } catch (e) {
    return data;
  }
};



// Nova função para formatar data para `YYYY-MM-DD'
window.Util.formatarDataISO = function (data) {
    if (!data) return null;

    try {
        if (data instanceof Date) {
            const ano = data.getFullYear();
            const mes = String(data.getMonth() + 1).padStart(2, '0');
            const dia = String(data.getDate()).padStart(2, '0');
            return `${ano}-${mes}-${dia}`;
        }

        if (data.includes("/")) {
            let partes = data.split("/");
            let dia = partes[0].padStart(2, '0');
            let mes = partes[1].padStart(2, '0');
            let ano = partes[2];
            return `${ano}-${mes}-${dia}`;
        }
        if (data.includes("-")) {
            return data;
        }

        return null;
    } catch (e) {
        return null;
    }
};



//Formatar Número para Moeda (ex: R$ 1.234,56)
window.Util.formatarMoeda = function (valor) {
    if (isNaN(valor)) return "Valor inválido";
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
};


//Formatador CEP (#####-###)
window.Util.formatarCEP = function(cep) {
    cep = cep.replace(/\D/g, "");
    if (cep.length > 5) {
        return cep.substring(0,5) + "-" + cep.substring(5,8);
    }
    return cep;
};


//Formatar Número de Telefone (ex: (11) 91234-5678)
window.Util.formatarTelefone = function (telefone) {
    if (!telefone) return "";
    telefone = telefone.replace(/\D/g, ""); 

    if (telefone.length === 11) {
        return `(${telefone.substring(0, 2)}) ${telefone.substring(2, 7)}-${telefone.substring(7, 11)}`;
    } else if (telefone.length === 10) {
        return `(${telefone.substring(0, 2)}) ${telefone.substring(2, 6)}-${telefone.substring(6, 10)}`;
    }
    return telefone; 
};


//Seleciona um arquivo e retorna o arquivo selecionado no PC
window.Util.selecionarArquivo = function (acceptType = "*", multiple = false, callback) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = acceptType;
    input.multiple = multiple;

    input.addEventListener("change", function () {
        if (input.files.length > 0) {
            if (multiple) {
                callback(Array.from(input.files)); 
            } else {
                callback(input.files[0]); 
            }
        }
    });

    input.click(); 
}


// Função para Validar o CPF
window.Util.validarCPF = function (cpf) {
  cpf = cpf.replace(/\D/g, ""); // remove tudo que não for número

  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(cpf.charAt(i)) * (10 - i);
  let digito1 = (soma * 10) % 11;
  if (digito1 === 10 || digito1 === 11) digito1 = 0;
  if (digito1 !== parseInt(cpf.charAt(9))) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf.charAt(i)) * (11 - i);
  let digito2 = (soma * 10) % 11;
  if (digito2 === 10 || digito2 === 11) digito2 = 0;

  return digito2 === parseInt(cpf.charAt(10));
};



// Função para formatar/incluir a máscara do CPF
window.Util.formatarCPF = function(cpf) {
    cpf = cpf.replace(/\D/g, "");
    cpf = cpf.replace(/(\d{3})(\d)/, "$1.$2");
    cpf = cpf.replace(/(\d{3})(\d)/, "$1.$2");
    cpf = cpf.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    return cpf;
}


// Função para remover a máscara do CPF
window.Util.removerMascaraCPF = function(cpf) {
    return cpf.replace(/\D/g, "");
};

// Formatar Data e Hora para DD/MM/YYYY HH:mm
window.Util.formatarDataHora = function (dataISO) {
  if (!dataISO) return "";

  const data = new Date(dataISO);

  // Valida se a data foi reconhecida
  if (isNaN(data.getTime())) return dataISO;

  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const ano = data.getFullYear();

  const horas = String(data.getHours()).padStart(2, '0');
  const minutos = String(data.getMinutes()).padStart(2, '0');

  return `${dia}/${mes}/${ano} ${horas}:${minutos}`;
};


// Formatador de CNPJ
window.Util.formatarCNPJ = function (cnpj) {
  cnpj = cnpj.replace(/\D/g, "");
  return cnpj
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

// Função para remover a máscara do CNPJ
window.Util.formatarDataPtBr = function (dataISO) {
  if (!dataISO) return "";
  const data = new Date(dataISO);
  const opcoes = {
    weekday: "short",   // qua
    day: "2-digit",     // 25
    month: "2-digit",   // 06
    year: "numeric",    // 2025
    hour: "2-digit",    // 19
    minute: "2-digit",  // 00
    hour12: false,
    timeZone: "America/Sao_Paulo"
  };

  let texto = data.toLocaleString("pt-BR", opcoes);
  texto = texto.charAt(0).toUpperCase() + texto.slice(1); // Capitaliza o primeiro caractere
  return texto.replace(",", "");
};




// Função para gerar ícones Lucide com classe 'icon-tech'
window.Util.gerarIconeTech = function(nome) {
  const iconesLucide = {
    editar: 'pencil',
    excluir: 'trash-2',
    anexo: 'paperclip',
    visualizar: 'eye',
    ocultar: 'eye-off',
    configuracoes: 'settings',
    compras: 'shopping-cart',
    financeiro: 'wallet',
    assinatura: 'pen-tool',
    perfil: 'user',
    chamado: 'life-buoy',
    email: 'mail',
    email_enviado: 'send',
    email_aberto: 'mail-open',
    email_erro: 'alert-circle',
    favorecidos: 'users',
    livro_diario: 'banknote',
    categorias: 'list',
    plano_contas: 'folder-tree',
    novidades: 'sparkles',
    nivel_acesso: 'badge-check',
    projetos: 'layout-dashboard',
    departamentos: 'building',
    adicionar: 'plus',
    salvar: 'check-circle',
    cancelar: 'x-circle',
    menos: 'minus',
    mais: 'plus',
  };

  const iconeLucide = iconesLucide[nome];
  if (!iconeLucide) {
    console.warn(`Ícone TECH não encontrado para: ${nome}`);
    return '';
  }

  const el = document.createElement('i');
  el.setAttribute('data-lucide', iconeLucide);
  el.className = 'icon-tech';
  return el.outerHTML;
};
