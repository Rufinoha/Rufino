if (typeof window.Empresa === "undefined") {
    window.Empresa = {
        paginaAtual: 1,
        registrosPorPagina: 20,
        totalPaginas: 0,
        dadosEmpresas: [],
        cachePaginas: {},

        configurarEventos: function () {
            document.querySelector("#ob_btnIncluir").addEventListener("click", () => {
                // Limpa qualquer seleção anterior
                window.empresaSelecionada = null;   
                // Abre a janela de inclusão de empresa
                let largura = 800;
                let altura = 500;
                let esquerda = (window.screen.width - largura) / 2;
                let topo = (window.screen.height - altura) / 2;

                window.open('/empresa/incluir', 'IncluirEmpresa',
                    `width=${largura},height=${altura},top=${topo},left=${esquerda},resizable=no`);
            });

            document.querySelector("#ob_btnFiltrar").addEventListener("click", () => {
                Empresa.paginaAtual = 1;
                Empresa.carregarEmpresas();
            });

            document.querySelector("#ob_btnlimparFiltro").addEventListener("click", () => {
                document.querySelector("#ob_filtroCNPJ").value = "";
                document.querySelector("#ob_filtroEmpresa").value = "";
                document.querySelector("#ob_filtroCidade").value = "";
                Empresa.paginaAtual = 1;
                Empresa.carregarEmpresas();
            });

            document.querySelector("#ob_btnPrimeiro").addEventListener("click", () => {
                if (Empresa.paginaAtual !== 1) {
                    Empresa.paginaAtual = 1;
                    Empresa.renderizarTabela();
                }
            });

            document.querySelector("#ob_btnAnterior").addEventListener("click", () => {
                if (Empresa.paginaAtual > 1) {
                    Empresa.paginaAtual--;
                    Empresa.renderizarTabela();
                }
            });

            document.querySelector("#ob_btnProximo").addEventListener("click", () => {
                if (Empresa.paginaAtual < Empresa.totalPaginas) {
                    Empresa.paginaAtual++;
                    Empresa.renderizarTabela();
                }
            });

            document.querySelector("#ob_btnUltimo").addEventListener("click", () => {
                if (Empresa.paginaAtual !== Empresa.totalPaginas) {
                    Empresa.paginaAtual = Empresa.totalPaginas;
                    Empresa.renderizarTabela();
                }
            });

            Empresa.carregarEmpresas();
        },

        carregarEmpresas: function () {
            let cnpjFiltro = document.querySelector("#ob_filtroCNPJ").value.trim();
            let empresaFiltro = document.querySelector("#ob_filtroEmpresa").value.trim();
            let cidadeFiltro = document.querySelector("#ob_filtroCidade").value.trim();

            let url = `/empresa/dados?pagina=${this.paginaAtual}&ordenarPor=empresa&ordem=asc&porPagina=${this.registrosPorPagina}`;

            if (cnpjFiltro) url += `&cnpj=${encodeURIComponent(cnpjFiltro)}`;
            if (empresaFiltro) url += `&empresa=${encodeURIComponent(empresaFiltro)}`;
            if (cidadeFiltro) url += `&cidade=${encodeURIComponent(cidadeFiltro)}`;

            fetch(url, { method: "GET" })
                .then(response => {
                    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
                    return response.json();
                })
                .then(data => {
                    this.dadosEmpresas = data.dados || [];
                    this.totalPaginas = data.total_paginas || 1;
                    this.cachePaginas[this.paginaAtual] = [...this.dadosEmpresas];
                    this.renderizarTabela();
                })
                .catch(error => {
                    console.error("❌ Erro ao carregar empresas:", error);
                    document.querySelector("#ob_listaEmpresas").innerHTML = `<tr><td colspan="5">Erro ao carregar os dados.</td></tr>`;
                });
        },

        renderizarTabela: function () {
            console.log(`🔄 Renderizando tabela EMPRESA... Página Atual: ${this.paginaAtual}`);

            const tabela = document.querySelector("#ob_listaEmpresas");
            if (!tabela) {
                console.error("❌ Erro: Tabela não encontrada no HTML.");
                return;
            }

            if (!this.cachePaginas[this.paginaAtual]) {
                console.log(`⚠️ Dados da página ${this.paginaAtual} ainda não foram carregados. Buscando da API...`);
                this.carregarEmpresas();
                return;
            }

            while (tabela.firstChild) {
                tabela.removeChild(tabela.firstChild);
            }

            let dadosPagina = this.cachePaginas[this.paginaAtual];

            if (dadosPagina.length === 0) {
                tabela.innerHTML = `<tr><td colspan="5">Nenhuma empresa encontrada.</td></tr>`;
                return;
            }

            dadosPagina.forEach(empresa => {
                let linha = document.createElement("tr");
                linha.innerHTML = `
                    <td>${empresa.cnpj}</td>
                    <td>${empresa.empresa}</td>
                    <td>${empresa.cidade}</td>
                    <td>${empresa.uf}</td>
                    <td>
                        <button class="Cl_BtnAcao btnEditar" data-cnpj="${empresa.cnpj}">✏️</button>
                        <button class="Cl_BtnAcao btnExcluir" data-cnpj="${empresa.cnpj}">🗑️</button>
                    </td>
                `;
                tabela.appendChild(linha);
            });
            // Adiciona os eventos de Editar e Excluir após renderizar a tabela
            document.querySelectorAll(".btnEditar").forEach(botao => {
                botao.addEventListener("click", () => {
                    const cnpj = botao.dataset.cnpj;
                    const empresa = this.dadosEmpresas.find(emp => emp.cnpj === cnpj);
                    if (!empresa) return;

                    // Carrega os dados completos (buscar do backend ou usar cache, se disponível)
                    fetch(`/empresa/dados?cnpj=${cnpj}`)
                        .then(response => response.json())
                        .then(data => {
                            if (!data.dados || data.dados.length === 0) {
                                Swal.fire("Erro", "Empresa não encontrada para edição.", "error");
                                return;
                            }

                            const empresaCompleta = data.dados[0];
                            window.empresaSelecionada = empresaCompleta;

                            let largura = 800;
                            let altura = 500;
                            let esquerda = (window.screen.width - largura) / 2;
                            let topo = (window.screen.height - altura) / 2;

                            const novaJanela = window.open("/empresa/incluir", "EditarEmpresa",
                                `width=${largura},height=${altura},top=${topo},left=${esquerda},resizable=no`);

                            const monitor = setInterval(() => {
                                if (novaJanela.closed) {
                                    clearInterval(monitor);
                                    Empresa.carregarEmpresas();
                                }
                            }, 500);
                        });
                });
            });

            document.querySelectorAll(".btnExcluir").forEach(botao => {
                botao.addEventListener("click", () => {
                    const cnpj = botao.dataset.cnpj;

                    Swal.fire({
                        title: "Excluir empresa?",
                        text: `Deseja realmente excluir o CNPJ ${cnpj}?`,
                        icon: "warning",
                        showCancelButton: true,
                        confirmButtonText: "Sim, excluir",
                        cancelButtonText: "Cancelar"
                    }).then(async (result) => {
                        if (result.isConfirmed) {
                            try {
                                const resposta = await fetch(`/empresa/delete${cnpj}`, {
                                    method: "DELETE"
                                });

                                const resultado = await resposta.json();

                                if (resposta.ok) {
                                    Swal.fire("Sucesso", resultado.message, "success");
                                    Empresa.carregarEmpresas();
                                } else {
                                    Swal.fire("Erro", resultado.erro, "error");
                                }
                            } catch (erro) {
                                Swal.fire("Erro", "Erro ao excluir empresa.", "error");
                                console.error("Erro:", erro);
                            }
                        }
                    });
                });
            });

            this.atualizarPaginacao();
        },

        atualizarPaginacao: function () {
            console.log("🔄 Atualizando paginação Empresa...");

            document.querySelector("#ob_paginaAtual").textContent = this.paginaAtual;
            document.querySelector("#ob_totalPaginas").textContent = this.totalPaginas;

            document.querySelector("#ob_btnPrimeiro").disabled = this.paginaAtual === 1;
            document.querySelector("#ob_btnAnterior").disabled = this.paginaAtual === 1;
            document.querySelector("#ob_btnProximo").disabled = this.paginaAtual === this.totalPaginas;
            document.querySelector("#ob_btnUltimo").disabled = this.paginaAtual === this.totalPaginas;
        }
    };
} else {
    console.warn("A variável Empresa já foi declarada. O script não será redefinido.");
}

if (window.Empresa && typeof window.Empresa.configurarEventos === "function") {
    console.log("📢 Chamando Empresa.configurarEventos...");
    window.Empresa.configurarEventos();
} else {
    console.error("❌ Erro: Empresa.configurarEventos não está definido.");
}
