console.log('carregado shub.projetos.js')

if (typeof window.ProjetosHub === "undefined") {
    // Registra na mesma chave o mount/unmount criado pelo carregador Global de HTML que esta no global
    (function (s) {
    const pageKey = s.getAttribute('data-page-script'); 

    async function mount(root, ctx, scope) {
        // sua lógica (se quiser, pode continuar rodando código no topo do arquivo;
        // o Global já captura e vai limpar tudo ao sair)
    }

    function unmount() {
        // opcional — o Global já limpa eventos/timers/fetch/observers/Chart
    }

    GlobalUtils.registerPage(pageKey, { mount, unmount });
    })(document.currentScript);

    window.ProjetosHub = {
        paginaAtual: 1,
        registrosPorPagina: 20,
        totalPaginas: 1,
        cache: {},

        configurarEventos: function () {
            // === BOTÕES E FILTROS (fixos) ===
            document.querySelector("#ob_btnIncluir").addEventListener("click", () => {
                GlobalUtils.abrirJanelaApoioModal({
                    rota: "/projetos/novo",
                    titulo: "Novo Projeto",
                    largura: 900,
                    altura: 500,
                    nivel: 1
                });
            });

            document.querySelector("#ob_btnFiltrar").addEventListener("click", () => {
                ProjetosHub.paginaAtual = 1;
                ProjetosHub.carregarDados();
            });

            document.querySelector("#ob_btnlimparFiltro").addEventListener("click", () => {
                document.getElementById("ob_filtroNome").value = "";
                document.getElementById("ob_filtroStatus").value = "true";
                ProjetosHub.paginaAtual = 1;
                ProjetosHub.carregarDados();
            });

            ["ob_btnPrimeiro", "ob_btnAnterior", "ob_btnProximo", "ob_btnUltimo"].forEach((id) => {
                document.getElementById(id).addEventListener("click", () => {
                    if (id === "ob_btnPrimeiro") ProjetosHub.paginaAtual = 1;
                    else if (id === "ob_btnAnterior" && ProjetosHub.paginaAtual > 1) ProjetosHub.paginaAtual--;
                    else if (id === "ob_btnProximo" && ProjetosHub.paginaAtual < ProjetosHub.totalPaginas) ProjetosHub.paginaAtual++;
                    else if (id === "ob_btnUltimo") ProjetosHub.paginaAtual = ProjetosHub.totalPaginas;
                    ProjetosHub.carregarDados();
                });
            });

            ProjetosHub.carregarDados();
        },

        carregarDados: function () {
            const nome = document.getElementById("ob_filtroNome").value.trim();
            const status = document.getElementById("ob_filtroStatus").value;

            let url = `/projetos/dados?pagina=${ProjetosHub.paginaAtual}&porPagina=${ProjetosHub.registrosPorPagina}`;
            if (nome) url += `&nome=${encodeURIComponent(nome)}`;
            if (status) url += `&status=${encodeURIComponent(status)}`;

            fetch(url)
                .then((res) => res.json())
                .then((data) => {
                    ProjetosHub.totalPaginas = data.total_paginas || 1;
                    ProjetosHub.cache[ProjetosHub.paginaAtual] = data.dados || [];
                    ProjetosHub.renderizarTabela();
                })
                .catch((err) => {
                    console.error("Erro ao carregar dados:", err);
                    Swal.fire("Erro", "Não foi possível carregar os projetos.", "error");
                });
        },

        renderizarTabela: function () {
            const tbody = document.getElementById("ob_listaProjetos");
            tbody.innerHTML = "";

            const dados = ProjetosHub.cache[ProjetosHub.paginaAtual] || [];

            if (dados.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5">Nenhum projeto encontrado.</td></tr>`;
                ProjetosHub.atualizarPaginacao();
                return;
            }

            dados.forEach((item) => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${item.id}</td>
                    <td>${(item.nome_projeto || "").toString()}</td>
                    <td>${(item.obs || "").toString()}</td>
                    <td>${item.status ? "Ativo" : "Inativo"}</td>
                    <td style="text-align:center;">
                        <button class="Cl_BtnAcao btnEditar" title="Editar" data-id="${item.id}">${Util.gerarIconeTech('editar')}</button>
                        <button class="Cl_BtnAcao btnExcluir" title="Excluir" data-id="${item.id}">${Util.gerarIconeTech('excluir')}</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            lucide.createIcons();
            ProjetosHub.atualizarPaginacao();

            // === AÇÕES GERADAS DINAMICAMENTE ===
            tbody.querySelectorAll(".btnEditar").forEach((btn) => {
                btn.addEventListener("click", () => {
                    const id = parseInt(btn.dataset.id, 10);
                    GlobalUtils.abrirJanelaApoioModal({
                        rota: "/projetos/editar",
                        id: id,
                        titulo: "Editar Projeto",
                        largura: 900,
                        altura: 500,
                        nivel: 1
                    });
                });
            });

            tbody.querySelectorAll(".btnExcluir").forEach((btn) => {
                btn.addEventListener("click", async () => {
                    const id = btn.dataset.id;

                    const confirma = await Swal.fire({
                        title: "Excluir projeto?",
                        text: "Essa ação não poderá ser desfeita.",
                        icon: "warning",
                        showCancelButton: true,
                        confirmButtonText: "Sim, excluir",
                        cancelButtonText: "Cancelar"
                    });
                    if (!confirma.isConfirmed) return;

                    try {
                        const resp = await fetch("/projetos/excluir", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id })
                        });
                        const json = await resp.json();
                        if (resp.ok) {
                            Swal.fire("Sucesso", json.mensagem || "Excluído.", "success");
                            ProjetosHub.carregarDados();
                        } else {
                            Swal.fire("Erro", json.erro || "Erro ao excluir.", "error");
                        }
                    } catch (err) {
                        Swal.fire("Erro inesperado", err.message, "error");
                    }
                });
            });
        },

        atualizarPaginacao: function () {
            document.getElementById("ob_paginaAtual").textContent = ProjetosHub.paginaAtual;
            document.getElementById("ob_totalPaginas").textContent = ProjetosHub.totalPaginas;

            document.getElementById("ob_btnPrimeiro").disabled = ProjetosHub.paginaAtual === 1;
            document.getElementById("ob_btnAnterior").disabled = ProjetosHub.paginaAtual === 1;
            document.getElementById("ob_btnProximo").disabled = ProjetosHub.paginaAtual === ProjetosHub.totalPaginas;
            document.getElementById("ob_btnUltimo").disabled = ProjetosHub.paginaAtual === ProjetosHub.totalPaginas;
        }
    };

    // 🔁 Atualiza a lista quando o apoio salva/exclui
    window.addEventListener("message", (event) => {
        if (event.data && event.data.grupo === "atualizarTabela") {
            ProjetosHub.carregarDados();
        }
    });

    // 🚀 start
    ProjetosHub.configurarEventos();
}
