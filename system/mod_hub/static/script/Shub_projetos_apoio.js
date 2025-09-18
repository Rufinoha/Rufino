// Smódulo apoio: Projetos (padrão Rufino)
let idProjeto = null;
let nivelModal = 1;

document.addEventListener("DOMContentLoaded", () => {
    // ✅ Switch status
    document.querySelector("#statusToggle").addEventListener("change", (e) => {
        document.getElementById("statusLabel").textContent = e.target.checked ? "Ativo" : "Inativo";
    });

    // ✅ Salvar
    document.querySelector("#btnSalvar").addEventListener("click", async () => {
        const nome_projeto = document.querySelector("#nome_projeto").value.trim();
        const obs = document.querySelector("#obs").value.trim();
        const status = document.querySelector("#statusToggle").checked ? "Ativo" : "Inativo";

        if (!nome_projeto) {
            await Swal.fire("Campo obrigatório", "Informe o nome do projeto.", "warning");
            return;
        }

        try {
            const resp = await fetch("/projetos/salvar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: idProjeto,
                    nome_projeto,
                    obs,
                    status
                })
            });
            const data = await resp.json();

            if (resp.ok) {
                await Swal.fire("Sucesso", data.mensagem || "Projeto salvo com sucesso!", "success");
                window.parent.postMessage({ grupo: "atualizarTabela" }, "*");
                GlobalUtils.fecharJanelaApoio(nivelModal);
            } else if (resp.status === 409) {
                Swal.fire("Duplicado", data.erro || "Já existe um projeto com esse nome nesta empresa.", "warning");
            } else {
                Swal.fire("Erro", data.erro || "Erro ao salvar projeto.", "error");
            }
        } catch (erro) {
            console.error("Erro ao salvar projeto:", erro);
            Swal.fire("Erro", "Erro inesperado ao salvar projeto.", "error");
        }
    });

    // ✅ Excluir
    document.querySelector("#btnExcluir").addEventListener("click", async () => {
        const id = document.querySelector("#id").value.trim();
        if (!id || id === "NOVO") {
            Swal.fire("Erro", "Nenhum projeto selecionado para excluir.", "error");
            return;
        }

        const c = await Swal.fire({
            title: "Excluir projeto?",
            text: "Essa ação não poderá ser desfeita!",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Sim, excluir",
            cancelButtonText: "Cancelar"
        });
        if (!c.isConfirmed) return;

        try {
            const resp = await fetch("/projetos/excluir", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id })
            });
            const data = await resp.json();

            if (resp.ok) {
                await Swal.fire("Excluído!", data.mensagem || "Projeto excluído com sucesso.", "success");
                window.parent.postMessage({ grupo: "atualizarTabela" }, "*");
                GlobalUtils.fecharJanelaApoio(nivelModal);
            } else {
                Swal.fire("Erro", data.erro || "Erro ao excluir projeto.", "error");
            }
        } catch (erro) {
            console.error("Erro ao excluir projeto:", erro);
            Swal.fire("Erro", "Erro inesperado ao excluir projeto.", "error");
        }
    });

    // 🛰️ Recebe dados do principal e preenche
    GlobalUtils.receberDadosApoio(async (id, nivel) => {
        idProjeto = id || null;
        nivelModal = nivel || 1;
        document.querySelector("#id").value = idProjeto ? idProjeto : "NOVO";

        if (!idProjeto) {
            document.querySelector("#statusToggle").checked = true;
            document.querySelector("#statusLabel").textContent = "Ativo";
            return;
        }

        try {
            const resp = await fetch("/projetos/apoio", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: idProjeto })
            });

            if (!resp.ok) throw new Error("Erro ao buscar dados do projeto");
            const p = await resp.json();

            document.querySelector("#nome_projeto").value = p.nome_projeto || "";
            document.querySelector("#obs").value = p.obs || "";
            const ativo = (p.status === "Ativo") || p.status === true;
            document.querySelector("#statusToggle").checked = ativo;
            document.getElementById("statusLabel").textContent = ativo ? "Ativo" : "Inativo";
        } catch (erro) {
            console.error("❌ Erro ao carregar projeto:", erro);
            Swal.fire("Erro", "Erro ao carregar dados do projeto.", "error");
        }
    });
});
