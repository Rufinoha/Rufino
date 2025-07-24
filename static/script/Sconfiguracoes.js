console.log("🟢 Sconfiguracoes.js carregado..."); 

// contra duplicações
if (typeof window.Configuracoes === "undefined") {
    window.Configuracoes = {
        cardsDisponiveis: [

            { card_id: "Cobrancas", titulo: "Faturamento", texto: "Controle de faturas emitidas as assinaturas de clientes.", pagina: "cobranca" },
            { card_id: "novidades", titulo: "Novidades", texto: "Gerencie os cards exibidos na lateral do sistema.", pagina: "novidades" },
            { card_id: "Menu", titulo: "Menu", texto: "Controle de conteudo dos Menus lateral e topo.", pagina: "menu" },
            { card_id: "geral", titulo: "Configurações Gerais", texto: "Ajuste nome do sistema, logotipo e opções padrão.", pagina: "config_geral" },
            { card_id: "ajuda", titulo: "Central de Ajuda", texto: "Cadastre dicas e explicações para os módulos.", pagina: "emcontrucao_config" },
            { card_id: "Backup", titulo: "Backup", texto: "Configure backups e verifique integridade dos dados.", pagina: "emcontrucao_config" }

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


