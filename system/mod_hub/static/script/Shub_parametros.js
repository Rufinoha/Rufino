console.log("🟢 Sparametros.js carregado..."); 

    // contra duplicações
if (typeof window.Configuracoes === "undefined") {

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

    window.Configuracoes = {
        cardsDisponiveis: [

            { card_id: "usuarios", titulo: "Usuários", texto: "Gerencie contas de acesso, permissões e status dos usuários.", pagina: "usuario" },
            { card_id: "grupos", titulo: "Grupo de Usuários", texto: "Crie e organize grupos para controle de acesso por módulo.", pagina: "usuario_grupo" },
            { card_id: "sessao", titulo: "Tempo de Sessão", texto: "Defina o tempo máximo de inatividade permitido por empresa.", pagina: "emcontrucao_config" }
        ], 

        configurarEventos: async function () {
            const container = document.getElementById("config-container");
            if (container && container.querySelector(".card")) {
                console.warn("⛔ Cards já estão carregados. Ignorando nova execução.");
                return;
            }

            this.criarSlots();

            // 🟩 Preenche os slots automaticamente com os cards disponíveis
            this.cardsDisponiveis.forEach((info, index) => {
                const slot = document.querySelectorAll(".slot")[index];
                if (slot) {
                const card = this.renderizarCard(info);
                slot.appendChild(card);
                }
            });

           
        },

        

        criarSlots: function () {
            const container = document.getElementById("config-container");
            if (!container) return;
            container.innerHTML = ""; // 🧹 Limpa tudo antes de montar

            for (let i = 0; i < 20; i++) {
                const slot = document.createElement("div");
                slot.classList.add("slot");
                slot.dataset.linha = Math.floor(i / 4);
                slot.dataset.coluna = i % 4;
                slot.ondragover = e => e.preventDefault();
                slot.ondrop = this.aoSoltar;
                container.appendChild(slot);
            }
        },

        
        renderizarCard: function (info) {
            const card = document.createElement("div");
            card.classList.add("card");
            card.draggable = true;
            card.dataset.cardId = info.card_id;

            const titulo = document.createElement("span");
            titulo.innerText = info.titulo;
            const texto = document.createElement("p");
            texto.innerText = info.texto;

            card.appendChild(titulo);
            card.appendChild(texto);

            card.ondragstart = e => {
                e.dataTransfer.setData("card_id", info.card_id);
                document.querySelectorAll(".slot:empty").forEach(slot => {
                    slot.classList.add("vazio-destino");
                });
            };

            card.ondragend = () => {
                document.querySelectorAll(".slot").forEach(slot => {
                    slot.classList.remove("vazio-destino");
                });
            };

            card.onclick = () => {
                if (info.pagina) {
                    const pagina = info.pagina.replace("frm_", "").replace(".html", "");
                    card.classList.add("carregando");
                    GlobalUtils.carregarPagina(pagina);
                    setTimeout(() => card.classList.remove("carregando"), 1000);
                }
            };

            return card;
        },

    };
}

// Após criar window.Configuracoes
if (window.Configuracoes && typeof window.Configuracoes.configurarEventos === "function") {
    window.Configuracoes.configurarEventos();
}


