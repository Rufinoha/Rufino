// ------------------------------
// 🔍 CONFIGURAÇÕES
// ------------------------------
// Garante que App existe
if (typeof window.App === "undefined") {
    window.App = {};
}

// Garante que Util existe
if (typeof window.Util === "undefined") {
    window.Util = {};
}


// ------------------------------
// // Carregar dados do usuário do localStorage
// ------------------------------
if (typeof usuario === "undefined") {
    var usuario = JSON.parse(localStorage.getItem("usuarioLogado") || "{}");
}


window.App = {
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
    VarlastLogin: usuario.horaLogin  // (controle da expiração de sessão)
};




// 🔍 Exemplo de carregar configurações depois que o DOM estiver pronto
document.addEventListener("DOMContentLoaded", () => {
    carregarConfiguracoes();
});

// Sua função carregarConfiguracoes aqui
async function carregarConfiguracoes() {
    try {
        if (!App.Varidcliente) {
            console.warn("⚠️ App.Varidcliente não definido ainda.");
            return;
        }

        const id_empresa = App.Varidcliente;
        const response = await fetch(`/configuracoes/${id_empresa}`);
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
// 🔍 FUNÇÔES LOCAIS
// ------------------------------

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
