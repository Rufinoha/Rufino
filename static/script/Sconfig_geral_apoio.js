console.log("🧩 Sconfig_geral_apoio.js carregado...");

window.addEventListener("DOMContentLoaded", () => {
    console.log("🧩 DOM pronto, enviando apoioPronto...");
    window.opener?.postMessage({ grupo: "apoioPronto" }, "*");

    // Botão Salvar
    document.getElementById("ob_btnSalvar").addEventListener("click", async () => {
        const dados = {
            chave: document.getElementById("ob_chave").value,
            descricao: document.getElementById("ob_descricao").value.trim(),
            valor: document.getElementById("ob_valor").value.trim()
        };

        if (!dados.descricao || !dados.valor) {
            Swal.fire("Atenção", "Preencha todos os campos obrigatórios.", "warning");
            return;
        } 

        try {
            const resposta = await fetch("/configuracoes/salvar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dados)
            });

            const resultado = await resposta.json();
            if (resposta.ok && resultado.status === "sucesso") {
                Swal.fire("Sucesso", resultado.mensagem, "success").then(() => {
                    window.opener?.Config?.carregarConfigs?.();
                    window.close();
                });
            } else {
                Swal.fire("Erro", resultado.erro || "Erro ao salvar.", "error");
            }

        } catch (erro) {
            console.error("❌ Erro ao salvar:", erro);
            Swal.fire("Erro", "Erro inesperado ao salvar.", "error");
        }
    });

    // Botão Excluir
    document.getElementById("ob_btnexcluir").addEventListener("click", async () => {
        const chave = document.getElementById("ob_chave").value;
        if (!chave) {
            Swal.fire("Erro", "Configuração ainda não foi salva.", "warning");
            return;
        }

        const resultado = await Swal.fire({
            title: `Excluir configuração ${chave}?`,
            text: "Esta ação não poderá ser desfeita.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Sim, excluir",
            cancelButtonText: "Cancelar"
        });

        if (!resultado.isConfirmed) return;

        try {
            const resp = await fetch("/configuracoes/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chave })
            });

            const dados = await resp.json();
            if (resp.ok && dados.status === "sucesso") {
                Swal.fire("Sucesso", dados.mensagem, "success").then(() => {
                    window.opener?.Config?.carregarConfigs?.();
                    window.close();
                });
            } else {
                Swal.fire("Erro", dados.erro || "Erro ao excluir.", "error");
            }

        } catch (erro) {
            console.error("❌ Erro ao excluir:", erro);
            Swal.fire("Erro inesperado", "Falha ao excluir configuração.", "error");
        }
    });
});

// Receber dados para edição
window.addEventListener("message", async (event) => {
    if (event.data && event.data.grupo === "carregarConfig") {
        const chave = event.data.id;
        try {
            const resposta = await fetch(`/configuracoes/apoio/${chave}`);
            const config = await resposta.json();

            if (!resposta.ok || config.erro) {
                throw new Error(config.erro || "Erro ao buscar dados.");
            }

            document.getElementById("ob_chave").value = config.chave || "";
            document.getElementById("ob_descricao").value = config.descricao || "";
            document.getElementById("ob_valor").value = config.valor || "";
            document.getElementById("ob_atualizado_em").value = config.atualizado_em || "";

        } catch (erro) {
            console.error("❌ Erro ao carregar configuração:", erro);
            Swal.fire("Erro", "Falha ao carregar os dados da configuração.", "error");
        }
    }
});

