console.log("📘 Shub_departamentos.js carregado");

if (typeof window.DepartamentosHub === "undefined") {
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

    
    window.DepartamentosHub = {
        paginaAtual: 1,
        registrosPorPagina: 20,
        totalPaginas: 1,
        dadosCache: {},

        configurarEventos: function () {
            // Novo
            document.querySelector("#ob_btnIncluir").addEventListener("click", () => {
                GlobalUtils.abrirJanelaApoioModal({
                    rota: "/hub_departamentos/novo",
                    titulo: "Novo Departamento",
                    largura: 900,
                    altura: 500,
                    nivel: 1
                });
            });

            // Filtrar
            document.querySelector("#ob_btnFiltrar").addEventListener("click", () => {
                DepartamentosHub.paginaAtual = 1;
                DepartamentosHub.carregarDados();
            });

            // Limpar filtro
            document.querySelector("#ob_btnLimpar").addEventListener("click", () => {
                document.querySelector("#ob_filtroDepartamento").value = "";
                document.querySelector("#ob_filtroStatus").value = "true"; // padrão Ativo
                DepartamentosHub.paginaAtual = 1;
                DepartamentosHub.carregarDados();
            });

            // Paginação
            ["ob_btnPrimeiro", "ob_btnAnterior", "ob_btnProximo", "ob_btnUltimo"].forEach((id) => {
                document.getElementById(id).addEventListener("click", () => {
                    if (id === "ob_btnPrimeiro") DepartamentosHub.paginaAtual = 1;
                    else if (id === "ob_btnAnterior" && DepartamentosHub.paginaAtual > 1) DepartamentosHub.paginaAtual--;
                    else if (id === "ob_btnProximo" && DepartamentosHub.paginaAtual < DepartamentosHub.totalPaginas) DepartamentosHub.paginaAtual++;
                    else if (id === "ob_btnUltimo") DepartamentosHub.paginaAtual = DepartamentosHub.totalPaginas;
                    DepartamentosHub.carregarDados();
                });
            });

            DepartamentosHub.carregarDados();
        },

        carregarDados: function () {
            const depFiltro = document.getElementById("ob_filtroDepartamento").value.trim();
            const statusFiltro = document.getElementById("ob_filtroStatus").value;

            let url = `/hub_departamentos/dados?pagina=${DepartamentosHub.paginaAtual}&porPagina=${DepartamentosHub.registrosPorPagina}`;
            if (depFiltro) url += `&departamento=${encodeURIComponent(depFiltro)}`;
            if (statusFiltro !== "") url += `&status=${encodeURIComponent(statusFiltro)}`;

            fetch(url)
                .then((res) => res.json())
                .then((data) => {
                    DepartamentosHub.totalPaginas = data.total_paginas || 1;
                    DepartamentosHub.dadosCache[DepartamentosHub.paginaAtual] = data.dados || [];
                    DepartamentosHub.renderizarTabela();
                })
                .catch((err) => {
                    console.error("Erro ao carregar dados:", err);
                    Swal.fire("Erro", "Não foi possível carregar os departamentos.", "error");
                });
        },

        renderizarTabela: function () {
            const tbody = document.getElementById("ob_listaDepartamentos");
            tbody.innerHTML = "";

            const dados = DepartamentosHub.dadosCache[DepartamentosHub.paginaAtual] || [];
            if (dados.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6">Nenhum departamento encontrado.</td></tr>`;
                DepartamentosHub.atualizarPaginacao();
                return;
            }

            dados.forEach((item) => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${item.id}</td>
                    <td>${item.id_empresa}</td>
                    <td>${item.departamento}</td>
                    <td>${item.obs || ""}</td>
                    <td>${item.status ? "Ativo" : "Inativo"}</td>
                    <td>
                        <button class="Cl_BtnAcao btnEditar" data-id="${item.id}">${Util.gerarIconeTech('editar')}</button>
                        <button class="Cl_BtnAcao btnExcluir" data-id="${item.id}">${Util.gerarIconeTech('excluir')}</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            lucide.createIcons();
            DepartamentosHub.atualizarPaginacao();

            // Ações dinâmicas
            tbody.querySelectorAll(".btnEditar").forEach((btn) => {
                btn.addEventListener("click", () => {
                    const id = parseInt(btn.dataset.id, 10);
                    GlobalUtils.abrirJanelaApoioModal({
                        rota: "/hub_departamentos/editar",
                        id: id,
                        titulo: "Editar Departamento",
                        largura: 900,
                        altura: 500,
                        nivel: 1
                    });
                });
            });

            tbody.querySelectorAll(".btnExcluir").forEach((btn) => {
                btn.addEventListener("click", async () => {
                    const id = btn.dataset.id;
                    const tr = btn.closest("tr");
                    const nome = tr.children[2].innerText.trim();

                    const confirma = await Swal.fire({
                        title: `Excluir departamento "${nome}"?`,
                        text: "Essa ação não poderá ser desfeita.",
                        icon: "warning",
                        showCancelButton: true,
                        confirmButtonText: "Sim, excluir",
                        cancelButtonText: "Cancelar"
                    });
                    if (!confirma.isConfirmed) return;

                    try {
                        const resp = await fetch(`/hub_departamentos/excluir`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id })
                        });
                        const json = await resp.json();
                        if (resp.ok) {
                            Swal.fire("Sucesso", json.message || "Excluído.", "success");
                            DepartamentosHub.carregarDados();
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
            document.getElementById("ob_paginaAtual").textContent = DepartamentosHub.paginaAtual;
            document.getElementById("ob_totalPaginas").textContent = DepartamentosHub.totalPaginas;

            document.getElementById("ob_btnPrimeiro").disabled = DepartamentosHub.paginaAtual === 1;
            document.getElementById("ob_btnAnterior").disabled = DepartamentosHub.paginaAtual === 1;
            document.getElementById("ob_btnProximo").disabled = DepartamentosHub.paginaAtual === DepartamentosHub.totalPaginas;
            document.getElementById("ob_btnUltimo").disabled = DepartamentosHub.paginaAtual === DepartamentosHub.totalPaginas;
        }
    };

    // 🔁 Atualiza tabela quando apoio salvar/excluir
    window.addEventListener("message", (event) => {
        if (event.data && event.data.grupo === "atualizarTabela") {
            DepartamentosHub.carregarDados();
        }
    });

    DepartamentosHub.configurarEventos();
}
