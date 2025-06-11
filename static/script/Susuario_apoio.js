// ----------------------------------------------------------------------
// ✅ 1. Ao carregar a janela
// ----------------------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
    // Envia confirmação para janela principal
    if (window.opener) {
        window.opener.postMessage({ grupo: "apoioPronto" }, "*");
    }

    // Escuta postMessage com os dados do usuário para edição
    window.addEventListener("message", (event) => {
        if (event.data && event.data.grupo === "dadosUsuario") {
            const dados = event.data.payload;
            console.log("📦 Dados recebidos:", dados);
            preencherCampos(dados);
        }
    });

    // Valor padrão para novos usuários
    document.getElementById("ob_status").value = "Ativo";

    // Carrega grupos no combobox
    carregarCombobox();
});

// ----------------------------------------------------------------------
// ✅ 2. Se vier com ID pela URL, busca os dados direto do backend
// ----------------------------------------------------------------------
const params = new URLSearchParams(window.location.search);
const id = params.get("id");

if (id) {
    fetch(`/usuario/apoio?id=${id}`)
        .then(res => res.json())
        .then(json => {
            if (json.status === "sucesso") {
                preencherCampos(json.dados);
            } else {
                Swal.fire("Erro", json.mensagem, "error");
            }
        })
        .catch(() => {
            Swal.fire("Erro", "Falha ao carregar dados do usuário.", "error");
        });
}

// ----------------------------------------------------------------------
// 🔁 3. Nome completo → maiúsculo e extrai primeiro nome
// ----------------------------------------------------------------------
document.getElementById("ob_nome_completo").addEventListener("blur", () => {
    let nomeCompleto = document.getElementById("ob_nome_completo").value.trim().toUpperCase();
    document.getElementById("ob_nome_completo").value = nomeCompleto;

    const primeiroNome = nomeCompleto.split(" ")[0] || "";
    document.getElementById("ob_nome").value = primeiroNome;
});

// ----------------------------------------------------------------------
// 📱 4. Máscara para o campo WhatsApp
// ----------------------------------------------------------------------
document.getElementById("ob_whatsapp").addEventListener("input", function () {
    let valor = this.value.replace(/\D/g, "");
    if (valor.length > 11) valor = valor.slice(0, 11);

    let formatado = valor;
    if (valor.length >= 2) {
        formatado = `(${valor.substring(0, 2)}`;
        if (valor.length >= 7) {
            formatado += `) ${valor.substring(2, 7)}-${valor.substring(7)}`;
        } else if (valor.length > 2) {
            formatado += `) ${valor.substring(2)}`;
        }
    }

    this.value = formatado;
});

// ----------------------------------------------------------------------
// 🧠 5. Preencher campos na tela
// ----------------------------------------------------------------------
function preencherCampos(dados) {
    document.getElementById("ob_id").value = dados.id || "";
    document.getElementById("ob_nome_completo").value = dados.nome_completo || "";
    document.getElementById("ob_nome").value = dados.nome || "";
    document.getElementById("ob_email").value = dados.email || "";
    document.getElementById("ob_whatsapp").value = dados.whatsapp || "";
    document.getElementById("ob_departamento").value = dados.departamento || "";
    document.getElementById("ob_status").value = dados.status || "Ativo";
    document.getElementById("ob_grupo").value = dados.grupo || "";
}

// ----------------------------------------------------------------------
// 💾 6. Evento do botão Salvar
// ----------------------------------------------------------------------
// 💾 Botão Salvar
document.getElementById("btnSalvar").addEventListener("click", async (e) => {
    e.preventDefault();

    const confirmacao = await Swal.fire({
        title: "Salvar dados?",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Salvar",
        cancelButtonText: "Cancelar"
    });

    if (!confirmacao.isConfirmed) return;

    // Coleta dos campos
    const id = document.getElementById("ob_id").value.trim() || null;
    const id_cliente = App.Varidcliente;
    const nome_completo = document.getElementById("ob_nome_completo").value.trim();
    const nome = document.getElementById("ob_nome").value.trim();
    const email = document.getElementById("ob_email").value.trim();
    const grupo_nome = document.getElementById("ob_grupo").selectedOptions[0].textContent.trim();
    const grupo_id_raw = document.getElementById("ob_grupo").value;
    const id_grupo = grupo_id_raw === "" ? null : parseInt(grupo_id_raw);
    const departamento = document.getElementById("ob_departamento").value.trim();
    const whatsapp = document.getElementById("ob_whatsapp").value.trim();
    const status = document.getElementById("ob_status").value;

    const payload = {
        id,
        id_cliente,
        id_grupo,  // ✅ Já está nulo para administrador/desenvolvedor
        nome_completo,
        nome,
        email,
        usuario: email.toLowerCase(),
        grupo: grupo_nome,  // 👁️ Nome visível no sistema
        departamento,
        whatsapp,
        status,
        senha: "123456", // 🔒 Senha padrão — será trocada depois
        imagem: "userpadrao.png"
    };

    try {
        const resposta = await fetch("/usuario/salvar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const retorno = await resposta.json();

        if (resposta.ok) {
            document.getElementById("ob_id").value = retorno.id;
            if (window.opener?.Usuario?.carregarUsuarios) {
                window.opener.Usuario.carregarUsuarios();
            }
            Swal.fire("Sucesso", "Usuário salvo com sucesso!", "success");
        } else {
            Swal.fire("Erro", retorno.mensagem || "Erro ao salvar usuário", "error");
        }
    } catch (e) {
        console.error("❌ Erro ao salvar:", e);
        Swal.fire("Erro", "Erro inesperado ao salvar.", "error");
    }
});

// ----------------------------------------------------------------------
// 📋 7. Carregar opções de grupo na combo
// ----------------------------------------------------------------------
function carregarCombobox(idSelecionado = null) {
    fetch('/permissao/combobox')
        .then(res => res.json())
        .then(data => {
            if (data.status === "sucesso") {
                const ob_grupo = document.querySelector("#ob_grupo");
                ob_grupo.innerHTML = "";

                data.dados.forEach(grupo => {
                    const option = document.createElement("option");
                    option.value = grupo.id !== null ? grupo.id : "";  // se null, deixa vazio
                    option.textContent = grupo.nome;

                    if (String(grupo.id) === String(idSelecionado)) {
                        option.selected = true;
                    }

                    ob_grupo.appendChild(option);
                });
            } else {
                Swal.fire("Erro", data.mensagem, "error");
            }
        })
        .catch(() => {
            Swal.fire("Erro", "Erro ao carregar grupos de permissão.", "error");
        });
}

