console.log("Smenu.js carregado");

if (typeof window.Menu === "undefined") {
    window.Menu = {
        paginaAtual: 1,
        registrosPorPagina: 20,
        totalPaginas: 0,
        dadosMenus: [],
        cachePaginas: {},

        configurarEventos: function () {
            // Carregar combo ao abrir tela
            Menu.carregarComboMenu();

           document.querySelector("#ob_btnIncluir").addEventListener("click", () => {
                GlobalUtils.abrirJanelaApoioModal({
                    rota: '/menu/incluir',
                    titulo: 'Incluir Menu',
                    largura: 1000,
                    altura: 600,
                    nivel:1
                });
            });


            document.querySelector("#ob_btnFiltrar").addEventListener("click", () => {
                Menu.paginaAtual = 1;
                Menu.carregarMenus();
            });

            document.querySelector("#ob_btnlimparFiltro").addEventListener("click", () => {
                document.querySelector("#ob_filtroNome").value = "";
                document.querySelector("#ob_filtroLocal").value = "";
                document.querySelector("#ob_filtroMenuPrincipal").value = "";
                Menu.paginaAtual = 1;
                Menu.carregarMenus();
            });

            // Páginas
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

        carregarComboMenu: async function () {
            const combo = document.querySelector("#ob_filtroMenuPrincipal");
            if (!combo) return;
            combo.innerHTML = `<option value="">Todos</option>`;
            try {
                const resp = await fetch('/menu/combo/menu');
                const dados = await resp.json();
                dados.forEach(item => {
                    const opt = document.createElement("option");
                    opt.value = item.id;
                    opt.textContent = item.nome_menu;
                    combo.appendChild(opt);
                });
            } catch (err) {
                console.error("❌ Erro ao carregar menus principais:", err);
            }
        },

        carregarMenus: function () {
            const nome = document.querySelector("#ob_filtroNome").value.trim();
            const local = document.querySelector("#ob_filtroLocal").value.trim().toLowerCase();
            const menuPrincipal = document.querySelector("#ob_filtroMenuPrincipal").value.trim();

            let url = `/menu/dados?pagina=${Menu.paginaAtual}&porPagina=${Menu.registrosPorPagina}`;
            if (nome) url += `&nome_menu=${encodeURIComponent(nome)}`;
            if (local) url += `&local_menu=${encodeURIComponent(local)}`;
            if (menuPrincipal) url += `&menu_principal=${menuPrincipal}`;

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
                    document.querySelector("#ob_listaMenus").innerHTML = `<tr><td colspan="9">Erro ao carregar dados.</td></tr>`;
                });
        },

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
                        <button class="Cl_BtnAcao btnEditar" data-id="${menu.id}">
                            ${Util.gerarIconeTech('editar')}
                        </button>
                        <button class="Cl_BtnAcao btnExcluir" data-id="${menu.id}">
                            ${Util.gerarIconeTech('excluir')}
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
                lucide.createIcons();
            });

            // ✅ EVENTOS DEPOIS DE GERAR A TABELA
            tbody.querySelectorAll(".btnEditar").forEach(btn => {
                btn.addEventListener("click", () => {
                    const id = btn.getAttribute("data-id");
                    GlobalUtils.abrirJanelaApoioModal({
                        rota: `/menu/editar`,
                        id: id,
                        titulo: "Editar Menu",
                        largura: 1000,
                        altura: 600,
                        nivel:1
                    });
                });
            });


            tbody.querySelectorAll(".btnExcluir").forEach(btn => {
                btn.addEventListener("click", async () => {
                    const id = btn.getAttribute("data-id");
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
                            body: JSON.stringify({ id })
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
                });
            });

            Menu.atualizarPaginacao();
        },



        
        atualizarPaginacao: function () {
            document.querySelector("#ob_paginaAtual").textContent = Menu.paginaAtual;
            document.querySelector("#ob_totalPaginas").textContent = Menu.totalPaginas;
            document.querySelector("#ob_btnPrimeiro").disabled = Menu.paginaAtual === 1;
            document.querySelector("#ob_btnAnterior").disabled = Menu.paginaAtual === 1;
            document.querySelector("#ob_btnProximo").disabled = Menu.paginaAtual === Menu.totalPaginas;
            document.querySelector("#ob_btnUltimo").disabled = Menu.paginaAtual === Menu.totalPaginas;
        }
    };

    Menu.configurarEventos();
}
