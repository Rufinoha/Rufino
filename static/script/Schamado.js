console.log("🔧 Schamado.js carregado...");

if (typeof window.Chamado === "undefined") {
    window.Chamado = {
        paginaAtual: 1,
        registrosPorPagina: 20,
        totalPaginas: 0,
        dadosChamados: [],
        cachePaginas: {},

        configurarEventos: function () {
            const addEvento = (id, evento, func) => {
                let el = document.querySelector(id);
                if (el) el.addEventListener(evento, func);
            };

            addEvento("#btnNovoChamado", "click", () => {
                window.open(`/chamado/incluir`, "_blank", "width=1100,height=700,resizable=yes");
            });

            addEvento("#ob_btnFiltrar", "click", () => {
                Chamado.paginaAtual = 1;
                Chamado.carregarChamados();
            });

            addEvento("#ob_btnlimparFiltro", "click", () => {
                ["#ob_filtroCategoria", "#ob_filtroStatus", "#ob_filtroSituacao", "#ob_filtroOcorrencia", "#ob_filtroUsuario"].forEach(id => {
                    let el = document.querySelector(id);
                    if (el) el.value = "";
                });
                Chamado.paginaAtual = 1;
                Chamado.carregarChamados();
            });

            ["#ob_btnPrimeiro", "#ob_btnAnterior", "#ob_btnProximo", "#ob_btnUltimo"].forEach(id => {
                addEvento(id, "click", Chamado.paginacaoHandler);
            });

            Chamado.carregarChamados();
        },

        paginacaoHandler: function (e) {
            const id = e.target.id;
            if (id === "ob_btnPrimeiro") Chamado.paginaAtual = 1;
            else if (id === "ob_btnAnterior" && Chamado.paginaAtual > 1) Chamado.paginaAtual--;
            else if (id === "ob_btnProximo" && Chamado.paginaAtual < Chamado.totalPaginas) Chamado.paginaAtual++;
            else if (id === "ob_btnUltimo") Chamado.paginaAtual = Chamado.totalPaginas;
            Chamado.carregarChamados();
        },

        carregarChamados: function () {
            let filtros = {
                categoria: document.querySelector("#ob_filtroCategoria")?.value.trim() || "",
                status: document.querySelector("#ob_filtroStatus")?.value.trim() || "",
                situacao: document.querySelector("#ob_filtroSituacao")?.value.trim() || "",
                ocorrencia: document.querySelector("#ob_filtroOcorrencia")?.value.trim() || "",
                usuario: document.querySelector("#ob_filtroUsuario")?.value.trim() || ""
            };

            let url = `/chamado/dados?pagina=${Chamado.paginaAtual}&porPagina=${Chamado.registrosPorPagina}`;
            for (const chave in filtros) {
                if (filtros[chave]) url += `&${chave}=${encodeURIComponent(filtros[chave])}`;
            }

            fetch(url)
                .then(r => r.json())
                .then(data => {
                    Chamado.dadosChamados = data.dados || [];
                    Chamado.totalPaginas = data.total_paginas || 1;
                    Chamado.cachePaginas[Chamado.paginaAtual] = [...Chamado.dadosChamados];
                    Chamado.renderizarTabela();
                })
                .catch(err => {
                    console.error("Erro ao carregar chamados:", err);
                    document.querySelector("#ob_listaChamados").innerHTML = `<tr><td colspan='8'>Erro ao carregar os dados.</td></tr>`;
                });
        },

        renderizarTabela: function () {
            const tbody = document.querySelector("#ob_listaChamados");
            if (!tbody) return;
            tbody.innerHTML = "";

            const dados = Chamado.cachePaginas[Chamado.paginaAtual] || [];
            if (dados.length === 0) {
                tbody.innerHTML = `<tr><td colspan='8'>Nenhum chamado encontrado.</td></tr>`;
                return;
            }

            dados.forEach(ch => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${ch.id}</td>
                    <td>${ch.categoria}</td>
                    <td>${ch.titulo}</td>
                    <td>${ch.nome_usuario}</td>
                    <td>${Util.formatarDataHora(ch.criado_em)}</td>
                    <td>${ch.situacao}</td>
                    <td>${ch.status}</td>
                    <td>
                        <button class="Cl_BtnAcao btnAbrir" data-id="${ch.id}">🔍</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            Chamado.atualizarPaginacao();
        },

        atualizarPaginacao: function () {
            document.querySelector("#ob_paginaAtual").textContent = Chamado.paginaAtual;
            document.querySelector("#ob_totalPaginas").textContent = Chamado.totalPaginas;
            document.querySelector("#ob_btnPrimeiro").disabled = Chamado.paginaAtual === 1;
            document.querySelector("#ob_btnAnterior").disabled = Chamado.paginaAtual === 1;
            document.querySelector("#ob_btnProximo").disabled = Chamado.paginaAtual === Chamado.totalPaginas;
            document.querySelector("#ob_btnUltimo").disabled = Chamado.paginaAtual === Chamado.totalPaginas;

            document.querySelectorAll(".btnAbrir").forEach(btn => {
                btn.addEventListener("click", () => {
                    const id = btn.dataset.id;
                    window.open(`/chamado/editar?id=${id}`, "Apoio", "width=1100,height=700");
                });
            });

        }
    };

    window.Chamado.configurarEventos();
}
