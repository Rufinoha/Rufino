// ------------------------------
// 🔧 OBJETOS GLOBAIS
// ------------------------------
window.App = window.App || {};
window.Util = window.Util || {};
window.GlobalUtils = window.GlobalUtils || {};


// ------------------------------
// 👤 CARREGAR DADOS DO USUÁRIO
// ------------------------------
const usuario = JSON.parse(localStorage.getItem("usuarioLogado") || "{}");

Object.assign(window.App, {
  Varid: usuario.id_usuario,
  Varidcliente: usuario.id_empresa,
  Varnome: usuario.nome,
  Varnomecompleto: usuario.nome_completo,
  Varemail: usuario.email,
  Vargrupo: usuario.grupo,
  Vardepartamento: usuario.departamento,
  Varwhatsapp: usuario.whatsapp,
  Varstatus: usuario.status,
  Varfoto: usuario.foto,
  VarlastLogin: usuario.horaLogin
});

// ------------------------------
// ⚙️ CARREGAR CONFIGURAÇÕES
// ------------------------------
document.addEventListener("DOMContentLoaded", () => carregarConfiguracoes());

async function carregarConfiguracoes() {
  try {
    if (!App.Varidcliente) return console.warn("⚠️ App.Varidcliente não definido ainda.");

    const response = await fetch(`/configuracoes/${App.Varidcliente}`);
    const data = await response.json();

    if (data.success) {
      window.Config = data.config;
      console.log("⚙️ Configurações carregadas:", Config);
    } else {
      console.error("Erro ao buscar configurações:", data.message);
    }
  } catch (error) {
    console.error("Erro ao buscar configurações:", error);
  }
}

// ------------------------------
// ⏳ CONTROLE DE SESSÃO
// ------------------------------
(function verificarSessao() {
  if (!App.VarlastLogin) return;

  if (!window.Config || !Config.tempoSessaoMinutos) {
    console.warn("⚠️ Configurações não carregadas. Controle de sessão não aplicado.");
    return;
  }

  const horaLogin = new Date(App.VarlastLogin);
  const agora = new Date();
  const minutos = (agora - horaLogin) / 60000;
  const tempoMax = parseInt(Config.tempoSessaoMinutos) || 60;

  if (minutos > tempoMax) {
    Swal.fire("Sessão expirada!", "Por favor, faça login novamente.", "warning").then(() => {
      localStorage.removeItem("usuarioLogado");
      location.href = "/login.html";
    });
  }
})();

// ---------------------------------------------------
// FUNÇÃO PADRÃO PARA CARREGAR PÁGINA NO INDEX
// ---------------------------------------------------
window.GlobalUtils.carregarPagina = function (pagina) {
  const conteudo = document.getElementById("content-area");
  if (!conteudo) return;

  // 1. Limpa conteúdo anterior e scripts
  conteudo.innerHTML = "";
  document.querySelectorAll("script[data-page-script]").forEach(s => s.remove());

  // 2. Remove módulo anterior
  const modulo = pagina.toLowerCase();
  delete window[modulo];

  // 3. Faz a requisição para a rota Flask
  fetch(`/${modulo}`)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    })
    .then(html => {
      conteudo.innerHTML = html;
      conteudo.setAttribute("data-page", pagina);

      // 4. Injeta o JS do módulo
      const script = document.createElement("script");
      script.src = `/static/script/S${modulo}.js?t=${Date.now()}`;
      script.defer = true;
      script.setAttribute("data-page-script", pagina);
      document.body.appendChild(script);
    })
    .catch(err => {
      console.error(`Erro ao carregar ${pagina}`, err);
      Swal.fire("Erro", `Não foi possível abrir a página "${pagina}"`, "error");
    });
};



// --------------------------------------------------
// Função para carregar categorias no combobox
// --------------------------------------------------
GlobalUtils.carregarCategorias = async function (idSelect = "id_categoria", valorSelecionado = null) {
  try {
    const select = document.getElementById(idSelect);
    if (!select) return;

    // Limpa opções antigas
    select.innerHTML = '<option value="">Selecione</option>';

    const resp = await fetch("/combobox/categorias");
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
    console.error("❌ Erro ao carregar categorias:", e);
  }
};



// --------------------------------------------------
// Função para carregar plano de contas no combobox
// --------------------------------------------------
GlobalUtils.carregarPlanoContas = async function ({
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

  // Preenchimento inicial (se houver)
  if (valorSelecionado && descricaoPreenchida) {
    inputId.value = valorSelecionado;
    combo.value = descricaoPreenchida;
    combo.innerText = descricaoPreenchida;
  }
};







// ------------------------------
// 🛠️ FUNÇÕES UTILITÁRIAS
// ------------------------------
// Função para Carregar combobox do tipo de categorias

window.Util.TIPOS_ORIGEM = [
  "Favorecidos",
  "Livro Diário",
  "Categoria",
  "Departamento",
  "Projetos"
];








// 🗓️ Formatar Data para dd/mm/yy
window.Util.formatarData = function (dataISO) {
    if (!dataISO) return "";

    // Corta a hora, se houver (ex: "2025-01-29T00:00:00Z" → "2025-01-29")
    if (dataISO.includes("T")) {
        dataISO = dataISO.split("T")[0];
    }

    // Garante que estamos lidando com "YYYY-MM-DD"
    const partes = dataISO.split("-");
    if (partes.length === 3) {
        const [ano, mes, dia] = partes;
        return `${dia}/${mes}/${ano}`; // DD/MM/YYYY
    }

    return dataISO; // Fallback
};



// 🗓️ **Nova função para formatar data para `YYYY-MM-DD`**
window.Util.formatarDataISO = function (data) {
    if (!data) return null;

    try {
        // Se for objeto Date
        if (data instanceof Date) {
            const ano = data.getFullYear();
            const mes = String(data.getMonth() + 1).padStart(2, '0');
            const dia = String(data.getDate()).padStart(2, '0');
            return `${ano}-${mes}-${dia}`;
        }

        // Se for string com formato DD/MM/YYYY
        if (data.includes("/")) {
            let partes = data.split("/");
            let dia = partes[0].padStart(2, '0');
            let mes = partes[1].padStart(2, '0');
            let ano = partes[2];
            return `${ano}-${mes}-${dia}`;
        }

        // Se já estiver no formato YYYY-MM-DD, retorna como está
        if (data.includes("-")) {
            return data;
        }

        return null;
    } catch (e) {
        return null;
    }
};



// 🔢 Formatar Número para Moeda (ex: R$ 1.234,56)
window.Util.formatarMoeda = function (valor) {
    if (isNaN(valor)) return "Valor inválido";
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
};


// 📞 Formatar Número de Telefone (ex: (11) 91234-5678)
window.Util.formatarTelefone = function (telefone) {
    if (!telefone) return "";
    telefone = telefone.replace(/\D/g, ""); // Remove tudo que não for número

    if (telefone.length === 11) {
        return `(${telefone.substring(0, 2)}) ${telefone.substring(2, 7)}-${telefone.substring(7, 11)}`;
    } else if (telefone.length === 10) {
        return `(${telefone.substring(0, 2)}) ${telefone.substring(2, 6)}-${telefone.substring(6, 10)}`;
    }
    return telefone; // Retorna como está se não for um número válido
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
                callback(Array.from(input.files)); // Retorna um array de arquivos
            } else {
                callback(input.files[0]); // Retorna um único arquivo
            }
        }
    });

    input.click(); // Abre a janela do Windows para seleção de arquivo
}


// ----------------------------------------------
// 🔍 FUNÇÕES PARA CPF
// ----------------------------------------------

// Função para Validar o CPF
window.Util.validarCPF = function(cpf) {
    cpf = limparMascaraCPF(cpf);
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
}


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



// Controle de sessão dinâmico (tempo buscado do Config)
(function verificarSessao() {
    if (!App.VarlastLogin) return;

    if (!window.Config || !Config.tempoSessaoMinutos) {
        console.warn("⚠️ Configurações não carregadas. Controle de sessão não aplicado.");
        return;
    }

    const horaLogin = new Date(App.VarlastLogin);
    const agora = new Date();
    const diferencaMinutos = (agora - horaLogin) / (1000 * 60);

    const tempoMaximoSessao = parseInt(Config.tempoSessaoMinutos) || 60; // Busca do Config
    console.log(`⏳ Tempo máximo de sessão configurado: ${tempoMaximoSessao} minutos`);

    if (diferencaMinutos > tempoMaximoSessao) {
        Swal.fire({
            title: 'Sessão expirada!',
            text: 'Por favor, faça login novamente.',
            icon: 'warning',
            confirmButtonText: 'OK'
        }).then(() => {
            localStorage.removeItem("usuarioLogado");
            window.location.href = "/login.html"; // Caminho da tela de login
        });
    }
})();



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


// 🏢 Formatador de CNPJ
window.Util.formatarCNPJ = function (cnpj) {
  cnpj = cnpj.replace(/\D/g, "");
  return cnpj
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};


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


