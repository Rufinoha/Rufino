// Verifica se o objeto Perfil já existe
if (typeof window.Perfil === "undefined") {
    window.Perfil = {
        paginaAtual: 1,
        registrosPorPagina: 20,
        totalPaginas: 0,
        dadosPerfis: [],
        cachePaginas: {},

        configurarEventos: function () {
            // Botão "Novo Perfil"
            document.querySelector("#ob_btnIncluir").addEventListener("click", () => {
                const largura = 800;
                const altura = 500;
                const esquerda = (window.screen.width - largura) / 2;
                const topo = (window.screen.height - altura) / 2;

                window.open('/perfil/incluir', 'IncluirPerfil',
                    `width=${largura},height=${altura},top=${topo},left=${esquerda},resizable=no`);
            });

            // Botão "Filtrar"
            document.querySelector("#ob_btnFiltrar").addEventListener("click", () => {
                Perfil.paginaAtual = 1;
                Perfil.carregarPerfis();
            });

            // Botão "Limpar Filtro"
            document.querySelector("#ob_btnlimparFiltro").addEventListener("click", () => {
                document.querySelector("#ob_filtroMenu").value = "";
                Perfil.paginaAtual = 1;
                Perfil.carregarPerfis();
            });

            // 🔄 Carregamento inicial
            Perfil.carregarPerfis();
        },

        carregarPerfis: async function () {
            const menuFiltro = document.querySelector("#ob_filtroMenu").value.trim();
            let url = `/perfil/dados?pagina=${this.paginaAtual}&porPagina=${this.registrosPorPagina}`;

            if (menuFiltro) {
                url += `&menu_principal=${encodeURIComponent(menuFiltro)}`;
            }

            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);

                const data = await response.json();
                this.dadosPerfis = data.dados || [];
                this.totalPaginas = data.total_paginas || 1;
                this.cachePaginas[this.paginaAtual] = [...this.dadosPerfis];
                this.renderizarTabela();

            } catch (error) {
                console.error("❌ Erro ao carregar perfis:", error);
                document.querySelector("#ob_listaPerfis").innerHTML = `<tr><td colspan="6">Erro ao carregar os dados.</td></tr>`;
            }
        },

        renderizarTabela: function () {
            console.log("🔁 renderizarTabela foi chamada!");
            const tabela = document.querySelector("#ob_listaPerfis");
            if (!tabela) return;

            while (tabela.firstChild) tabela.removeChild(tabela.firstChild);
            console.log("🧹 Limpando tabela...");

            const dadosPagina = this.cachePaginas[this.paginaAtual];

            if (!dadosPagina || dadosPagina.length === 0) {
                tabela.innerHTML = `<tr><td colspan="6">Nenhum perfil encontrado.</td></tr>`;
                return;
            }

            dadosPagina.forEach(perfil => {
                let linha = document.createElement("tr");
                linha.setAttribute("data-id", perfil.id);
                linha.innerHTML = `
                    <td class="td_id">${perfil.id}</td>
                    <td class="td_nome">${perfil.nome}</td>
                    <td class="td_idhtml">${perfil.id_html}</td>
                    <td class="td_menuprincipal">${perfil.menu_principal}</td>
                    <td class="td_ordem">${perfil.ordem}</td>
                    <td class="td_descricao">${perfil.descricao}</td>
                    <td>
                        <button class="Cl_BtnAcao btnEditar" data-id="${perfil.id}">✏️</button>
                        <button class="Cl_BtnAcao btnExcluir" data-id="${perfil.id}">🗑️</button>
                    </td>
                `;
                tabela.appendChild(linha);
            });

            Perfil.atualizarPaginacao();
        },

        atualizarPaginacao: function () {
            if (document.querySelector("#ob_paginaAtual")) {
                document.querySelector("#ob_paginaAtual").textContent = this.paginaAtual;
            }
            if (document.querySelector("#ob_totalPaginas")) {
                document.querySelector("#ob_totalPaginas").textContent = this.totalPaginas;
            }

            const btnPrimeiro = document.querySelector("#ob_btnPrimeiro");
            const btnAnterior = document.querySelector("#ob_btnAnterior");
            const btnProximo = document.querySelector("#ob_btnProximo");
            const btnUltimo = document.querySelector("#ob_btnUltimo");

            if (btnPrimeiro) btnPrimeiro.disabled = this.paginaAtual === 1;
            if (btnAnterior) btnAnterior.disabled = this.paginaAtual === 1;
            if (btnProximo) btnProximo.disabled = this.paginaAtual === this.totalPaginas;
            if (btnUltimo) btnUltimo.disabled = this.paginaAtual === this.totalPaginas;

            // 🔥 Ajusta os botões de ação da tabela (Editar e Excluir)
            Perfil.configurarEventosTabela();
        },

        configurarEventosTabela: function () {
            const tabela = document.querySelector("#ob_listaPerfis");

            tabela.addEventListener("click", function (event) {
                if (event.target.classList.contains("btnEditar")) {
                    let linha = event.target.closest("tr");

                    if (linha) {
                        const perfilDados = {
                            id: event.target.getAttribute("data-id"),
                            nome: linha.querySelector(".td_nome")?.textContent.trim() || "",
                            id_html: linha.querySelector(".td_idhtml")?.textContent.trim() || "",
                            menu_principal: linha.querySelector(".td_menuprincipal")?.textContent.trim() || "",
                            ordem: linha.querySelector(".td_ordem")?.textContent.trim() || "",
                            descricao: linha.querySelector(".td_descricao")?.textContent.trim() || ""
                        };

                        const largura = 800;
                        const altura = 500;
                        const esquerda = (window.screen.width - largura) / 2;
                        const topo = (window.screen.height - altura) / 2;

                        const janelaEdicao = window.open('/perfil/editar', 'EditarPerfil',
                            `width=${largura},height=${altura},top=${topo},left=${esquerda},resizable=no`);

                        // ✅ Espera o apoio avisar que está pronto
                        const listener = function(event) {
                            if (event.data && event.data.grupo === "apoioPronto") {
                                janelaEdicao.postMessage({
                                    grupo: "dadosPerfil",
                                    payload: perfilDados
                                }, "*");
                                window.removeEventListener("message", listener);
                            }
                        };
                        window.addEventListener("message", listener);
                    }
                }

                if (event.target.classList.contains("btnExcluir")) {
                    Perfil.excluirPerfil(event.target.getAttribute("data-id"));
                }
            });
        },

        excluirPerfil: async function (id) {
            if (!id) return;

            const confirmacao = await Swal.fire({
                title: "Confirma a exclusão?",
                text: "Essa ação não poderá ser desfeita!",
                icon: "warning",
                showCancelButton: true,
                confirmButtonText: "Sim, excluir",
                cancelButtonText: "Cancelar"
            });

            if (!confirmacao.isConfirmed) return;

            try {
                const resposta = await fetch('/perfil/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                });

                const resultado = await resposta.json();

                if (resultado.status === "sucesso") {
                    Swal.fire("Excluído!", resultado.mensagem, "success");
                    Perfil.carregarPerfis();
                } else {
                    Swal.fire("Erro", resultado.mensagem, "error");
                }

            } catch (erro) {
                console.error("❌ Erro ao excluir:", erro);
                Swal.fire("Erro", "Erro ao excluir perfil.", "error");
            }
        }
    };
} else {
    console.warn("⚠️ A variável Perfil já está declarada.");
}

// Inicialização
if (window.Perfil && typeof window.Perfil.configurarEventos === "function") {
    window.Perfil.configurarEventos();
}

// Botão Voltar
if (document.getElementById("ob_btnVoltar")) {
    document.getElementById("ob_btnVoltar").addEventListener("click", () => {
        carregarPagina("configuracoes"); // Chama o Frm_configuracoes.html
    });

    window.Util?.removerCSSAtual("frm_usuario_perfil.html");
}
