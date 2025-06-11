// ✅ Avisa que a janela de apoio está pronta para receber dados
window.addEventListener("DOMContentLoaded", () => {
    if (window.opener) {
        window.opener.postMessage({ grupo: "apoioPronto" }, "*");
    }

    // Escuta o postMessage para preencher os campos se for edição
    window.addEventListener("message", (event) => {
        if (event.data && event.data.grupo === "dadosPerfil") {
            const dados = event.data.payload;
            console.log("📦 Dados recebidos do postMessage:", dados);

            if (dados && dados.id) {
                preencherCampos(dados);
            }
        }
    });

    iniciarNovoPerfil(); // Caso seja inclusão
});

// ----------------------------------------------------------
// 🔹 Botões principais
// ----------------------------------------------------------

// Salvar
document.getElementById("ob_btnSalvar").addEventListener("click", async () => {
    const confirmacao = await Swal.fire({
        title: "Deseja salvar?",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Salvar",
        cancelButtonText: "Cancelar"
    });

    if (!confirmacao.isConfirmed) return;

    const id = document.getElementById("ob_id").value.trim();

    const payload = {
        id: id || null,
        nome: document.getElementById("ob_nome").value.trim(),
        id_html: document.getElementById("ob_idhtml").value.trim(),
        menu_principal: document.getElementById("ob_menuprincipal").value.trim(),
        ordem: parseInt(document.getElementById("ob_ordem").value.trim()) || 0,
        descricao: document.getElementById("ob_descricao").value.trim()
    };

    console.log("📤 Payload para salvar:", payload);

    try {
        const resp = await fetch("/perfil/salvar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const dadosRetorno = await resp.json();

        if (resp.ok) {
            if (!id && dadosRetorno.id) {
                document.getElementById("ob_id").value = dadosRetorno.id;
            }
            window.opener.Perfil.carregarPerfis();
            Swal.fire("Sucesso", "Perfil salvo com sucesso!", "success");
        } else {
            Swal.fire("Erro", dadosRetorno.erro || "Erro ao salvar perfil", "error");
        }
    } catch (erro) {
        console.error("❌ Erro ao salvar:", erro);
        Swal.fire("Erro", "Erro inesperado ao salvar perfil.", "error");
    }
});

// Novo
document.getElementById("ob_btnNovo").addEventListener("click", () => {
    iniciarNovoPerfil();
});

// Excluir
document.getElementById("ob_btnExcluir").addEventListener("click", async () => {
    const id = document.getElementById("ob_id").value.trim();
    if (!id) return;

    const confirmacao = await Swal.fire({
        title: "Excluir perfil?",
        text: "Essa ação não poderá ser desfeita!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sim, excluir",
        cancelButtonText: "Cancelar"
    });

    if (!confirmacao.isConfirmed) return;

    try {
        const resp = await fetch("/perfil/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id })
        });

        const json = await resp.json();

        if (resp.ok) {
            Swal.fire("Excluído!", json.mensagem, "success");
            window.opener.Perfil.carregarPerfis();
            window.close();
        } else {
            Swal.fire("Erro", json.mensagem || "Erro ao excluir.", "error");
        }
    } catch (erro) {
        console.error("❌ Erro ao excluir:", erro);
        Swal.fire("Erro", "Falha inesperada na exclusão.", "error");
    }
});

// ----------------------------------------------------------
// 🔹 Funções auxiliares
// ----------------------------------------------------------

// Preenche campos recebidos
function preencherCampos(dados) {
    console.log("📝 Preenchendo com:", dados);
    document.getElementById("ob_id").value = dados.id || "";
    document.getElementById("ob_nome").value = dados.nome || "";
    document.getElementById("ob_idhtml").value = dados.id_html || "";
    document.getElementById("ob_menuprincipal").value = dados.menu_principal || "";
    document.getElementById("ob_ordem").value = dados.ordem || "";
    document.getElementById("ob_descricao").value = dados.descricao || "";
}

// Inicia novo perfil (campos limpos)
function iniciarNovoPerfil() {
    document.getElementById("ob_id").value = "";
    document.getElementById("ob_nome").value = "";
    document.getElementById("ob_idhtml").value = "";
    document.getElementById("ob_menuprincipal").value = "";
    document.getElementById("ob_ordem").value = "";
    document.getElementById("ob_descricao").value = "";
}
