console.log("📂 Smenu.js carregado");

if (typeof window.Menu === "undefined") {
    window.Menu = {
        paginaAtual: 1,
        registrosPorPagina: 20,
        totalPaginas: 0,
        dadosMenus: [],
        cachePaginas: {},

        // 🔧 Configurar Eventos
        configurarEventos: function () {
            document.querySelector("#ob_btnIncluir").addEventListener("click", () => {
                const largura = 700;
                const altura = 600;
                const esquerda = (window.screen.width - largura) / 2;
                const topo = (window.screen.height - altura) / 2;

                window.open('/menu/incluir', 'IncluirMenu',
                    `width=${largura},height=${altura},top=${topo},left=${esquerda},resizable=no`);
            });

            document.querySelector("#ob_btnFiltrar").addEventListener("click", () => {
                Menu.paginaAtual = 1;
                Menu.carregarMenus();
            });

            document.querySelector("#ob_btnlimparFiltro").addEventListener("click", () => {
                document.querySelector("#ob_filtroNome").value = "";
                document.querySelector("#ob_filtroLocal").value = "";
                Menu.paginaAtual = 1;
                Menu.carregarMenus();
            });

            document.querySelector("#ob_btnPrimeiro")?.addEventListener("click", () => {
                if (Menu.paginaAtual !== 1) {
                    Menu.paginaAtual = 1;
                    Menu.carregarMenus();
                }
            });

            document.querySelector("#ob_btnAnterior")?.addEventListener("click", () => {
                if (Menu.paginaAtual > 1) {
                    Menu.paginaAtual--;
                    Menu.carregarMenus();
                }
            });

            document.querySelector("#ob_btnProximo")?.addEventListener("click", () => {
                if (Menu.paginaAtual < Menu.totalPaginas) {
                    Menu.paginaAtual++;
                    Menu.carregarMenus();
                }
            });

            document.querySelector("#ob_btnUltimo")?.addEventListener("click", () => {
                if (Menu.paginaAtual !== Menu.totalPaginas) {
                    Menu.paginaAtual = Menu.totalPaginas;
                    Menu.carregarMenus();
                }
            });

            Menu.carregarMenus();
        },

        // 📥 Carregar Dados
        carregarMenus: function () {
            const nome = document.querySelector("#ob_filtroNome").value.trim();
            const local = document.querySelector("#ob_filtroLocal").value.trim().toLowerCase();

            let url = `/menu/dados?pagina=${Menu.paginaAtual}&porPagina=${Menu.registrosPorPagina}`;
            if (nome) url += `&nome_menu=${encodeURIComponent(nome)}`;
            if (local) url += `&local_menu=${encodeURIComponent(local)}`;

            fetch(url)
                .then(res => res.ok ? res.json() : Promise.reject(res))
                .then(data => {
                    Menu.dadosMenus = data.dados || [];
                    Menu.totalPaginas = data.total_paginas || 1;
                    Menu.cachePaginas[Menu.paginaAtual] = [...Menu.dadosMenus];
                    Menu.renderizarTabela();
                })
                .catch(err => {
                    console.error("❌ Erro ao carregar menus:", err);
                    document.querySelector("#ob_listaMenus").innerHTML = `<tr><td colspan="5">Erro ao carregar dados.</td></tr>`;
                });
        },

        // 📄 Renderizar Tabela
        renderizarTabela: function () {
            const tbody = document.querySelector("#ob_listaMenus");
            if (!tbody) return;
            tbody.innerHTML = "";

            const dados = Menu.cachePaginas[Menu.paginaAtual];

            if (!dados || dados.length === 0) {
                tbody.innerHTML = `<tr><td colspan="9">Nenhum menu encontrado.</td></tr>`;
                return;
            }

            dados.forEach(menu => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${menu.id || ""}</td>
                    <td>${menu.nome_menu ?? ""}</td>
                    <td>${menu.ordem || ""}</td>
                    <td>${menu.parent_id || ""}</td>
                    <td>${menu.rota || ""}</td>
                    <td>${menu.data_page || ""}</td>
                    <td>${menu.icone || ""}</td>
                    <td>${menu.local_menu}</td>
                    <td>
                        <button class="Cl_BtnAcao btnEditar" data-id="${menu.id}">✏️</button>
                        <button class="Cl_BtnAcao btnExcluir" data-id="${menu.id}">🗑️</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            Menu.atualizarPaginacao();
        },

        // 🔢 Atualizar Paginação
        atualizarPaginacao: function () {
            document.querySelector("#ob_paginaAtual").textContent = Menu.paginaAtual;
            document.querySelector("#ob_totalPaginas").textContent = Menu.totalPaginas;

            document.querySelector("#ob_btnPrimeiro").disabled = Menu.paginaAtual === 1;
            document.querySelector("#ob_btnAnterior").disabled = Menu.paginaAtual === 1;
            document.querySelector("#ob_btnProximo").disabled = Menu.paginaAtual === Menu.totalPaginas;
            document.querySelector("#ob_btnUltimo").disabled = Menu.paginaAtual === Menu.totalPaginas;
        }
    };

    // 🎯 Listeners
    document.querySelector("#ob_listaMenus").addEventListener("click", async function (e) {
        if (e.target.classList.contains("btnEditar")) {
            const id = e.target.getAttribute("data-id");
            window.__idMenuEditando__ = id;
            window.open("/menu/editar", "Apoio", "width=700,height=600");
        }

        if (e.target.classList.contains("btnExcluir")) {
            const id = e.target.getAttribute("data-id");

            const confirma = await Swal.fire({
                title: `Excluir menu ${id}?`,
                text: "Essa ação não poderá ser desfeita.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sim, excluir',
                cancelButtonText: 'Cancelar'
            });

            if (!confirma.isConfirmed) return;

            try {
                const resp = await fetch(`/menu/delete`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: id })
                });

                const dados = await resp.json();
                if (resp.ok && dados.status === "sucesso") {
                    Swal.fire("Sucesso", dados.mensagem, "success");
                    Menu.carregarMenus();
                } else {
                    Swal.fire("Erro", dados.erro || "Erro ao excluir.", "error");
                }
            } catch (err) {
                Swal.fire("Erro inesperado", err.message, "error");
            }
        }
    });

    // 🔄 Integração com janela de apoio
    window.addEventListener("message", function handler(event) {
        if (event.data && event.data.grupo === "apoioPronto") {
            const idEditando = window.__idMenuEditando__;
            if (idEditando) {
                event.source.postMessage({ grupo: "carregarMenu", id: idEditando }, "*");
                window.__idMenuEditando__ = null;
            }
        }
    });

    // 🚀 Inicializar
    window.Menu.configurarEventos();
}
