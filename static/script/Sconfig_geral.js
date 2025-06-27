console.log("🔧 Sconfig_geral.js carregado...");

if (typeof window.Config === "undefined") {
    window.Config = {
        paginaAtual: 1,
        registrosPorPagina: 20,
        totalPaginas: 0,
        dadosConfigs: [],
        cachePaginas: {},

        configurarEventos: function () {
            function adicionarEvento(id, evento, func) {
                let el = document.querySelector(id);
                if (el) {
                    el.addEventListener(evento, func);
                } else {
                    console.warn(`⚠️ Elemento ${id} não encontrado.`);
                }
            }
            adicionarEvento("#btnNovaConfig", "click", () => {
                window.open(`/configuracoes/incluir`, "_blank", "width=600,height=400,resizable=yes");
            });

            adicionarEvento("#ob_btnFiltrar", "click", () => {
                Config.paginaAtual = 1;
                Config.carregarConfigs();
            });

            adicionarEvento("#ob_btnlimparFiltro", "click", () => {
                document.querySelector("#ob_filtroDescricao").value = "";
                document.querySelector("#ob_filtroChave").value = "";
                Config.paginaAtual = 1;
                Config.carregarConfigs();
            });

            adicionarEvento("#ob_btnPrimeiro", "click", () => {
                if (Config.paginaAtual !== 1) {
                    Config.paginaAtual = 1;
                    Config.carregarConfigs();
                }
            });

            adicionarEvento("#ob_btnAnterior", "click", () => {
                if (Config.paginaAtual > 1) {
                    Config.paginaAtual--;
                    Config.carregarConfigs();
                }
            });

            adicionarEvento("#ob_btnProximo", "click", () => {
                if (Config.paginaAtual < Config.totalPaginas) {
                    Config.paginaAtual++;
                    Config.carregarConfigs();
                }
            });

            adicionarEvento("#ob_btnUltimo", "click", () => {
                if (Config.paginaAtual !== Config.totalPaginas) {
                    Config.paginaAtual = Config.totalPaginas;
                    Config.carregarConfigs();
                }
            });

            Config.carregarConfigs();
        },

        carregarConfigs: function () {
            let descricao = document.querySelector("#ob_filtroDescricao")?.value.trim() || "";
            let chave = document.querySelector("#ob_filtroChave")?.value.trim() || "";

            let url = `/configuracoes/dados?pagina=${Config.paginaAtual}&porPagina=${Config.registrosPorPagina}`;
            if (descricao) url += `&descricao=${encodeURIComponent(descricao)}`;
            if (chave) url += `&chave=${encodeURIComponent(chave)}`;

            fetch(url, { method: "GET" })
                .then(response => {
                    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
                    return response.json();
                })
                .then(data => {
                    Config.dadosConfigs = data.dados || [];
                    Config.totalPaginas = data.total_paginas || 1;
                    Config.cachePaginas[Config.paginaAtual] = [...Config.dadosConfigs];
                    Config.renderizarTabela();
                })
                .catch(error => {
                    console.error("❌ Erro ao carregar Configurações:", error);
                    document.querySelector("#ob_listaConfigs").innerHTML = `<tr><td colspan="5">Erro ao carregar os dados.</td></tr>`;
                });
        },

        renderizarTabela: function () {
            const tabela = document.querySelector("#ob_listaConfigs");
            if (!tabela) return;

            tabela.innerHTML = "";

            const dadosPagina = Config.cachePaginas[Config.paginaAtual] || [];

            if (dadosPagina.length === 0) {
                tabela.innerHTML = `<tr><td colspan="5">Nenhuma configuração encontrada.</td></tr>`;
                return;
            }

            dadosPagina.forEach(cfg => {
                const linha = document.createElement("tr");
                linha.innerHTML = `
                    <td>${cfg.descricao}</td>
                    <td>${cfg.chave}</td>
                    <td>${cfg.valor}</td>
                    <td>${window.Util.formatarData(cfg.atualizado_em)}</td>
                    <td>
                        <button class="Cl_BtnAcao btnEditar" data-id="${cfg.chave}">✏️</button>
                        <button class="Cl_BtnAcao btnExcluir" data-id="${cfg.chave}">🗑️</button>
                    </td>
                `;
                tabela.appendChild(linha);
            });

            Config.atualizarPaginacao();
        },

        atualizarPaginacao: function () {
            document.querySelector("#ob_paginaAtual").textContent = Config.paginaAtual;
            document.querySelector("#ob_totalPaginas").textContent = Config.totalPaginas;
            document.querySelector("#ob_btnPrimeiro").disabled = Config.paginaAtual === 1;
            document.querySelector("#ob_btnAnterior").disabled = Config.paginaAtual === 1;
            document.querySelector("#ob_btnProximo").disabled = Config.paginaAtual === Config.totalPaginas;
            document.querySelector("#ob_btnUltimo").disabled = Config.paginaAtual === Config.totalPaginas;

            document.addEventListener("click", async (e) => {
                if (e.target.classList.contains("btnEditar")) {
                    const id = e.target.dataset.id;
                    window.__idConfigEditando__ = id;

                    window.open("/configuracoes/editar", "Apoio", "width=600,height=400");
                }

                if (e.target.classList.contains("btnExcluir")) {
                    const id = e.target.getAttribute("data-id");
                    const resultado = await Swal.fire({
                        title: `Excluir configuração ${id}?`,
                        text: "Esta ação não poderá ser desfeita.",
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'Sim, excluir',
                        cancelButtonText: 'Cancelar'
                    });

                    if (!resultado.isConfirmed) return;

                    try {
                        const resp = await fetch(`/configuracoes/delete`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ chave: id })
                        });

                        const dados = await resp.json();
                        if (resp.ok && dados.status === "sucesso") {
                            Swal.fire("Sucesso", dados.mensagem, "success");
                            Config.carregarConfigs();
                        } else {
                            Swal.fire("Erro", dados.erro || "Erro ao excluir.", "error");
                        }
                    } catch (erro) {
                        Swal.fire("Erro inesperado", erro.message, "error");
                    }
                }
            });
        }
    };

    if (window.Config.configurarEventos) {
        window.Config.configurarEventos();
    }
}

window.Config.configurarEventos();

window.addEventListener("message", function handler(event) {
    if (event.data && event.data.grupo === "apoioPronto") {
        const idEditando = window.__idConfigEditando__;
        if (idEditando) {
            event.source.postMessage({ grupo: "carregarConfig", id: idEditando }, "*");
            window.__idConfigEditando__ = null;
        }
    }
});
