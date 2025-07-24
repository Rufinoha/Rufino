// Verifica se o objeto Usuario já existe no escopo global
if (typeof window.Usuario === "undefined") {
    window.Usuario = {
        paginaAtual: 1,
        registrosPorPagina: 20,
        totalPaginas: 0,
        dadosUsuarios: [],
        cachePaginas: {},

        configurarEventos: function () {
            // Botão "Novo Usuário"
            document.querySelector("#ob_btnIncluir").addEventListener("click", () => {
                GlobalUtils.abrirJanelaApoioModal({
                    rota: "/usuario/incluir",
                    titulo: "Incluir Usuário",
                    largura: 600,
                    altura: 570
                });
            });

            
            

            // Botão "Filtrar"
            document.querySelector("#ob_btnFiltrar").addEventListener("click", () => {
                Usuario.paginaAtual = 1;
                Usuario.carregarUsuarios();
            });

            // Botão "Limpar Filtro"
            document.querySelector("#ob_btnlimparFiltro").addEventListener("click", () => {
                document.querySelector("#ob_filtroNome").value = "";
                document.querySelector("#ob_filtroStatus").value = "";

                Usuario.paginaAtual = 1;
                Usuario.carregarUsuarios();
            });

            // Botões de paginação (caso existam)
            document.querySelector("#ob_btnPrimeiro")?.addEventListener("click", () => {
                if (Usuario.paginaAtual !== 1) {
                    Usuario.paginaAtual = 1;
                    Usuario.carregarUsuarios();
                }
            });

            document.querySelector("#ob_btnAnterior")?.addEventListener("click", () => {
                if (Usuario.paginaAtual > 1) {
                    Usuario.paginaAtual--;
                    Usuario.carregarUsuarios();
                }
            });

            document.querySelector("#ob_btnProximo")?.addEventListener("click", () => {
                if (Usuario.paginaAtual < Usuario.totalPaginas) {
                    Usuario.paginaAtual++;
                    Usuario.carregarUsuarios();
                }
            });

            document.querySelector("#ob_btnUltimo")?.addEventListener("click", () => {
                if (Usuario.paginaAtual !== Usuario.totalPaginas) {
                    Usuario.paginaAtual = Usuario.totalPaginas;
                    Usuario.carregarUsuarios();
                }
            });

            // 🔄 Carregamento inicial
            document.querySelector("#ob_filtroStatus").value = "Ativo";
            Usuario.carregarUsuarios();
        },

        carregarUsuarios: function () {
            const nomeFiltro = document.querySelector("#ob_filtroNome").value.trim();
            const statusFiltro = document.querySelector("#ob_filtroStatus").value;

            let url = `/usuario/dados?pagina=${this.paginaAtual}&ordenarPor=nome_completo&ordem=asc&porPagina=${this.registrosPorPagina}`;
            
            if (nomeFiltro) {
                url += `&nome=${encodeURIComponent(nomeFiltro)}`;
            }

            if (statusFiltro) {
                url += `&status=${encodeURIComponent(statusFiltro)}`;
            }

            fetch(url, { method: "GET" })
                .then(response => {
                    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
                    return response.json();
                })
                .then(data => {
                    this.dadosUsuarios = data.dados || [];
                    this.totalPaginas = data.total_paginas || 1;
                    this.cachePaginas[this.paginaAtual] = [...this.dadosUsuarios];
                    this.renderizarTabela();
                })
                .catch(error => {
                    console.error("❌ Erro ao carregar usuários:", error);
                    document.querySelector("#ob_listaUsuarios").innerHTML = `<tr><td colspan="9">Erro ao carregar os dados.</td></tr>`;
                });
        },

        renderizarTabela: function () {
            console.log("🔁 renderizarTabela foi chamada!");
            const tabela = document.querySelector("#ob_listaUsuarios");
            if (!tabela) return;

            while (tabela.firstChild) tabela.removeChild(tabela.firstChild);
            console.log("🧹 Limpando tabela...");

            const dadosPagina = this.cachePaginas[this.paginaAtual];

            if (!dadosPagina || dadosPagina.length === 0) {
                tabela.innerHTML = `<tr><td colspan="9">Nenhum usuário encontrado.</td></tr>`;
                return;
            }

            dadosPagina.forEach(usuario => {
                let linha = document.createElement("tr");
                linha.setAttribute("data-id", usuario.id);
                linha.innerHTML = `
                    <td class="td_id">${usuario.id}</td>
                    <td class="td_nome_completo">${usuario.nome_completo}</td>
                    <td class="td_email">${usuario.email}</td>
                    <td class="td_whatsapp">${usuario.whatsapp}</td>
                    <td class="td_departamento">${usuario.departamento}</td> <!-- atualizado -->
                    <td class="td_grupo">${usuario.grupo}</td>
                    <td class="td_ultimo_login">${window.Util.formatarData(usuario.ultimo_login)}</td> <!-- atualizado -->
                    <td class="td_status">${usuario.status}</td>
                    <td>
                        <button class="btn-icon Cl_BtnAcao btnEditar" data-id="${usuario.id}" title="Editar">
                            ${Util.gerarIconeTech('editar')}
                        </button>
                        <button class="btn-icon Cl_BtnAcao btnAcesso" data-id="${usuario.id}" data-nome="${usuario.nome_completo}" title="Nível de Acesso">
                            ${Util.gerarIconeTech('nivel_acesso')}
                        </button>
                        <button class="btn-icon Cl_BtnAcao btnExcluir" data-id="${usuario.id}" title="Excluir">
                            ${Util.gerarIconeTech('excluir')}
                        </button>
                    </td>
                `;

                tabela.appendChild(linha);
            });
            lucide.createIcons();
            this.atualizarPaginacao();
        },

        atualizarPaginacao: function () {
            if (document.querySelector("#ob_paginaAtual")) {
                document.querySelector("#ob_paginaAtual").textContent = this.paginaAtual;
            }

            if (document.querySelector("#ob_totalPaginas")) {
                document.querySelector("#ob_totalPaginas").textContent = this.totalPaginas;
            }

            const btnPrimeiro = document.querySelector("#ob_btnPrimeiro");
            if (btnPrimeiro) {
                btnPrimeiro.disabled = this.paginaAtual === 1;
            }

            const btnAnterior = document.querySelector("#ob_btnAnterior");
            if (btnAnterior) {
                btnAnterior.disabled = this.paginaAtual === 1;
            }

            const btnProximo = document.querySelector("#ob_btnProximo");
            if (btnProximo) {
                btnProximo.disabled = this.paginaAtual === this.totalPaginas;
            }

            const btnUltimo = document.querySelector("#ob_btnUltimo");
            if (btnUltimo) {
                btnUltimo.disabled = this.paginaAtual === this.totalPaginas;
            }


            // Listener para botão Editar na tabela HTML principal
            document.querySelector("#ob_listaUsuarios").addEventListener("click", function(event) {
                if (event.target.classList.contains("btnEditar")) {
                    let linha = event.target.closest("tr");

                    if (linha) {
                        const usuarioDados = {
                            id: event.target.getAttribute("data-id"),
                            nome_completo: linha.querySelector(".td_nome_completo")?.textContent.trim() || "",
                            email: linha.querySelector(".td_email")?.textContent.trim() || "",
                            whatsapp: linha.querySelector(".td_whatsapp")?.textContent.trim() || "",
                            departamento: linha.querySelector(".td_departamento")?.textContent.trim() || "",
                            grupo: linha.querySelector(".td_grupo")?.textContent.trim() || "",
                            ultimo_login: linha.querySelector(".td_ultimo_login")?.textContent.trim() || "",
                            status: linha.querySelector(".td_status")?.textContent.trim() || ""
                        };
                        const id = event.target.getAttribute("data-id");

                        // Abre o modal de apoio
                        GlobalUtils.abrirJanelaApoioModal({
                            rota: "/usuario/editar",
                            id: id,
                            titulo: "Editar Usuário",
                            largura: 600,
                            altura:570
                        });


                        // Aguarda o iframe carregar para enviar os dados via postMessage
                        window.addEventListener("message", function listener(event) {
                            if (event.data && event.data.grupo === "apoioPronto") {
                                // Localiza o iframe do modal
                                const iframe = document.querySelector("iframe[data-apoio]");
                                if (iframe) {
                                    iframe.contentWindow.postMessage({
                                        grupo: "dadosUsuario",
                                        payload: usuarioDados
                                    }, "*");

                                    window.removeEventListener("message", listener); // Remove após uso
                                }
                            }
                        });
                    }
                }

            });
            
            // botão para entrar na tela de Nivel de Acesso
            document.querySelectorAll(".btnAcesso").forEach(botao => {
                botao.addEventListener("click", (event) => {
                    const usuarioId = event.currentTarget.getAttribute("data-id");
                    const usuarioNome = event.currentTarget.getAttribute("data-nome");
            
                    console.log("➡️ Enviando dados:", usuarioId, usuarioNome); // 👈 teste aqui
            
                    const novaJanela = window.open("/usuario/permissoes", "_blank", "width=1000,height=700");
            
                    const timer = setInterval(() => {
                        if (novaJanela && novaJanela.postMessage) {
                            novaJanela.postMessage({
                                tipo: "usuarioPermissao",
                                dados: {
                                    id: usuarioId,
                                    nome: usuarioNome
                                }
                            }, "*");
                            clearInterval(timer);
                        }
                    }, 500);
                });
            });
            
            
            // Listener para botão Excluir na tabela HTML principal
            document.querySelector("#ob_listaUsuarios").addEventListener("click", async function(event) {
                if (event.target.classList.contains("btnExcluir")) {
                    const id = event.target.getAttribute("data-id");
            
                    if (!id) {
                        Swal.fire("Erro", "ID não encontrado.", "error");
                        return;
                    }
            
                    const confirmacao = await Swal.fire({
                        title: "Confirma a exclusão?",
                        text: "Essa ação não poderá ser desfeita!",
                        icon: "warning",
                        showCancelButton: true,
                        confirmButtonText: "Sim, excluir",
                        cancelButtonText: "Cancelar"
                    });
            
                    if (confirmacao.isConfirmed) {
                        try {
                            const resposta = await fetch('/usuario/delete', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: id })
                            });
            
                            const resultado = await resposta.json();
            
                            if (resultado.status === "sucesso") {
                                Swal.fire("Excluído!", resultado.mensagem, "success");
                                window.Usuario.carregarUsuarios(); // ✅ atualiza a tabela
                            } else {
                                Swal.fire("Erro", resultado.mensagem, "error");
                            }
            
                        } catch (erro) {
                            Swal.fire("Erro", "Erro ao excluir usuário.", "error");
                            console.error("❌ Erro ao excluir:", erro);
                        }
                    }
                }
            });
            
        },

        editarUsuario: function (id) {
            const largura = 600;
            const altura = 500;
            const esquerda = (screen.width - largura) / 2;
            const topo = (screen.height - altura) / 2;

            const url = `/usuario/editar/${id}`;
            const janelaEdicao = window.open(url, "_blank",
                `width=${largura},height=${altura},top=${topo},left=${esquerda},resizable=no`);
        },

        excluirUsuario: function (id) {
            if (!confirm("Tem certeza que deseja excluir este usuário?")) return;

            fetch(`/usuario/excluir/${id}`, { method: "DELETE" })
                .then(response => {
                    if (!response.ok) throw new Error("Erro ao excluir");
                    return response.json();
                })
                .then(() => {
                    Usuario.carregarUsuarios();
                })
                .catch(error => {
                    console.error("❌ Erro ao excluir usuário:", error);
                });
        },
    };
} else {
    console.warn("⚠️ A variável Usuario já está declarada.");
}

// Inicialização
if (window.Usuario && typeof window.Usuario.configurarEventos === "function") {
    window.Usuario.configurarEventos();
}


if (document.getElementById("ob_btnVoltar")) {
    document.getElementById("ob_btnVoltar").addEventListener("click", () => {
        carregarPagina("configuracoes"); // Chama o Frm_configuracoes.html dentro do content-area
    });

    
}

window.addEventListener("message", (event) => {
    if (event.data?.grupo === "recarregarUsuarios") {
        console.log("🔄 Recarregando usuários após salvar...");
        Usuario.carregarUsuarios();  // ou o nome da sua função de listagem
    }
});
