// Protege contra duplicações
if (typeof window.Configuracoes === "undefined") {
    window.Configuracoes = {
        cardsDisponiveis: [
            { card_id: "usuarios", titulo: "Usuários", texto: "Gerencie contas e permissões do sistema.", pagina: "frm_usuario.html" },
            { card_id: "perfil", titulo: "Perfil de Usuário", texto: "Gerencie os menus de cada perfil de acesso.", pagina: "frm_usuario_perfil.html" },
            { card_id: "novidades", titulo: "Novidades", texto: "Gerencie os cards exibidos na lateral do sistema.", pagina: "frm_novidades.html" },
            { card_id: "email", titulo: "Log de E-mail", texto: "Verifique aqui o status de todos os emails enviados pelo sistema.", pagina: "frm_email_log.html" },
            { card_id: "geral", titulo: "Configurações Gerais", texto: "Ajuste nome do sistema, logotipo e opções padrão.", pagina: "frm_config_geral" },
            { card_id: "ajuda", titulo: "Central de Ajuda", texto: "Cadastre dicas e explicações para os módulos.", pagina: "frm_emcontrucao_config.html" },
            { card_id: "banco", titulo: "Backup", texto: "Configure backups e verifique integridade dos dados.", pagina: "frm_emcontrucao_config.html" },
            { card_id: "Cobrancas", titulo: "Faturamento", texto: "Controle de faturas emitidas as assinaturas de clientes.", pagina: "frm_cobranca.html" },
            { card_id: "Menu", titulo: "Menu", texto: "Controle de conteudo dos Menus lateral e topo.", pagina: "frm_menu.html" }
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

            this.permitirArrastar();
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
                    carregarPagina(pagina);
                    setTimeout(() => card.classList.remove("carregando"), 1000);
                }
            };

            return card;
        },

        aoSoltar: function (e) {
            const card_id = e.dataTransfer.getData("card_id");
            if (!e.currentTarget.querySelector(".card")) {
                const cardInfo = window.Configuracoes.cardsDisponiveis.find(c => c.card_id === card_id);
                if (!cardInfo) return;
                const card = window.Configuracoes.renderizarCard(cardInfo);
                e.currentTarget.appendChild(card);
                window.Configuracoes.salvarLayout();
            }
        },

        permitirArrastar: function () {
            document.querySelectorAll(".card").forEach(card => {
                card.draggable = true;
            });
        },

        salvarLayout: async function () {
            const usuarioId = window.App?.Varid;
            if (!usuarioId) return;

            const layout = [];
            document.querySelectorAll(".slot").forEach(slot => {
                const card = slot.querySelector(".card");
                if (card) {
                    layout.push({
                        card_id: card.dataset.cardId,
                        linha: parseInt(slot.dataset.linha),
                        coluna: parseInt(slot.dataset.coluna)
                    });
                }
            });

            await fetch("/configuracoes/layout/salvar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ usuario_id: usuarioId, layout })
            });
        }
    };
}

// Após criar window.Configuracoes
if (window.Configuracoes && typeof window.Configuracoes.configurarEventos === "function") {
    window.Configuracoes.configurarEventos();
}


