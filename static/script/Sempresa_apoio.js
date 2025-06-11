document.addEventListener("DOMContentLoaded", async function () {
    const empresaSelecionada = window.opener?.empresaSelecionada || null;

    // Título da página
    const titulo = document.getElementById("tituloPagina");
    if (titulo) {
        titulo.textContent = empresaSelecionada ? "Editar Empresa" : "Nova Empresa";
    }

    // Aplica máscara de CNPJ
    const campoCNPJ = document.getElementById("ob_cnpj");
    if (campoCNPJ && window.Util?.aplicarMascaraCNPJ) {
        window.Util.aplicarMascaraCNPJ(campoCNPJ);
    }

    // Preenche os campos se estiver em modo edição
    if (empresaSelecionada) {
        campoCNPJ.value = empresaSelecionada.cnpj;
        campoCNPJ.disabled = true;
        document.getElementById("ob_empresa").value = empresaSelecionada.empresa;
        document.getElementById("ob_endereco").value = empresaSelecionada.endereco;
        document.getElementById("ob_numero").value = empresaSelecionada.numero;
        document.getElementById("ob_bairro").value = empresaSelecionada.bairro;
        document.getElementById("ob_cidade").value = empresaSelecionada.cidade;
        document.getElementById("ob_uf").value = empresaSelecionada.uf;
        document.getElementById("ob_cep").value = empresaSelecionada.cep;
        document.getElementById("ob_ie").value = empresaSelecionada.ie;
    }

    document.getElementById("ob_btnBuscarCNPJ").addEventListener("click", buscarDadosReceita);
    document.getElementById("ob_btnSalvar").addEventListener("click", salvarEmpresa);
});

// 🔹 Função de salvar empresa
async function salvarEmpresa() {
    const campos = {
        cnpj: document.getElementById("ob_cnpj").value.trim(),
        empresa: document.getElementById("ob_empresa").value.trim(),
        endereco: document.getElementById("ob_endereco").value.trim(),
        numero: document.getElementById("ob_numero").value.trim(),
        bairro: document.getElementById("ob_bairro").value.trim(),
        cidade: document.getElementById("ob_cidade").value.trim(),
        uf: document.getElementById("ob_uf").value.trim(),
        cep: document.getElementById("ob_cep").value.trim(),
        ie: document.getElementById("ob_ie").value.trim()
    };

    const obrigatorios = ["cnpj", "empresa", "endereco", "numero", "bairro", "cidade", "uf"];
    for (let campo of obrigatorios) {
        if (!campos[campo]) {
            Swal.fire("Campo obrigatório", `Preencha o campo "${campo.toUpperCase()}"`, "warning");
            return;
        }
    }

    // Valida CNPJ com função global
    if (!window.Util.validarCNPJ(campos.cnpj)) {
        Swal.fire("CNPJ inválido", "Digite um CNPJ válido!", "warning");
        return;
    }

    try {
        const resposta = await fetch("/empresa/salvar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(campos)
        });

        const resultado = await resposta.json();

        if (resultado.erro) {
            Swal.fire("Erro", resultado.erro, "error");
        } else {
            Swal.fire("Sucesso", resultado.mensagem, "success").then(() => {
                window.close();
                if (window.opener && window.opener.Empresa) {
                    window.opener.Empresa.carregarEmpresas();
                }
            });
        }
    } catch (erro) {
        Swal.fire("Erro", "Erro ao salvar empresa.", "error");
        console.error("Erro ao salvar:", erro);
    }
}

// 🔹 Buscar dados da ReceitaWS
async function buscarDadosReceita() {
    const campoCNPJ = document.getElementById("ob_cnpj");
    const cnpj = campoCNPJ.value.trim().replace(/\D/g, '');

    if (!cnpj || cnpj.length !== 14) {
        Swal.fire("Atenção", "Informe um CNPJ válido antes de buscar.", "info");
        return;
    }

    const confirmar = await Swal.fire({
        title: "Buscar na Receita Federal?",
        text: "Deseja preencher os dados automaticamente?",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Sim, buscar",
        cancelButtonText: "Cancelar"
    });

    if (!confirmar.isConfirmed) return;

    try {
        const resposta = await fetch(`/empresa/buscar_cnpj/${cnpj}`);
        if (!resposta.ok) {
            Swal.fire("Erro", "Não foi possível buscar o CNPJ. Verifique a conexão ou se o CNPJ é válido.", "error");
            return;
        }

        const dados = await resposta.json();

        if (dados.erro) {
            Swal.fire("Erro", dados.erro, "error");
            return;
        }

        document.getElementById("ob_empresa").value = dados.nome || "";
        document.getElementById("ob_endereco").value = dados.logradouro || "";
        document.getElementById("ob_numero").value = dados.numero || "";
        document.getElementById("ob_bairro").value = dados.bairro || "";
        document.getElementById("ob_cidade").value = dados.municipio || "";
        document.getElementById("ob_uf").value = dados.uf || "";
        document.getElementById("ob_cep").value = dados.cep || "";
        document.getElementById("ob_ie").value = dados.inscricao_estadual || "";

    } catch (erro) {
        console.error("Erro ao buscar CNPJ:", erro);
        Swal.fire("Erro", "Erro ao buscar CNPJ.", "error");
    }
}


