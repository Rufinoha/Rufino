
console.log("Sconfiguracoes.js carregado");

// Protege contra duplicações
if (typeof window.Configuracoes === "undefined") {
    window.Configuracoes = {
        // Títulos sem emoji; ícone TECH padronizado
        cardsDisponiveis: [
            { card_id: "usuarios",  titulo: "Usuários",             texto: "Gerencie contas e permissões do sistema.",                  page: "usuario",              iconTech: "favorecidos" },
            { card_id: "perfil",    titulo: "Perfil de Usuário",    texto: "Gerencie os menus de cada perfil de acesso.",               page: "usuario_modelo",       iconTech: "nivel_acesso" },
            { card_id: "Cobrancas", titulo: "Faturamento",          texto: "Controle de faturas emitidas as assinaturas de clientes.",  page: "cobranca" ,            iconTech: "financeiro" },
            { card_id: "novidades", titulo: "Novidades",            texto: "Gerencie os cards exibidos na lateral do sistema.",         page: "novidades",            iconTech: "novidades" },
            { card_id: "geral",     titulo: "Configurações Gerais", texto: "Ajuste nome do sistema, logotipo e opções padrão.",         page: "config_geral",         iconTech: "configuracoes" },
            { card_id: "menu",      titulo: "Itens de Menu",        texto: "Configure os menus e submenus do sistema",                  page: "menu",                 iconTech: "configuracoes" },
            { card_id: "ajuda",     titulo: "Central de Ajuda",     texto: "Cadastre dicas e explicações para os módulos.",             page: "emcontrucao_config",   iconTech: "chamado" },
            { card_id: "banco",     titulo: "Backup",               texto: "Configure backups e verifique integridade dos dados.",      page: "emcontrucao_config",   iconTech: "configuracoes" }
        ],


        configurarEventos: function () {
            this.renderizarCardsFixos();
        },

        renderizarCardsFixos: function () {
            const container = document.getElementById("config-container");
            if (!container) return;

            // Limpa e garante classe de grid
            container.innerHTML = "";
            container.classList.add("Cl_CardsGrid");

            // Renderiza cada card fixo
            this.cardsDisponiveis.forEach(info => {
                container.appendChild(this.renderizarCard(info));
            });

            // Converte <i data-lucide> em SVG (ícones TECH)
            window.lucide?.createIcons?.();
        },

        renderizarCard: function (info) {
            const card = document.createElement("div");
            card.className = "Cl_CardItem";
            card.dataset.cardId = info.card_id;

            // usa 'page' novo; se não vier, normaliza o legado 'pagina'
            const page = info.page ?? this.normalizaPagina(info.pagina);
            card.dataset.page = page; // <- grava no data-page

            card.setAttribute("role", "button");
            card.setAttribute("tabindex", "0");
            card.setAttribute("aria-label", `${info.titulo}`);

            const topo = document.createElement("div");
            topo.className = "card-topo";
            const iconeHTML = window?.Util?.gerarIconeTech?.(info.iconTech || "configuracoes") || "";
            topo.innerHTML = `${iconeHTML}<span class="card-titulo">${info.titulo}</span>`;

            const texto = document.createElement("p");
            texto.className = "card-texto";
            texto.innerText = info.texto;

            card.appendChild(topo);
            card.appendChild(texto);

            const abrir = () => {
                const p = card.dataset.page;
                if (!p) { throw new Error(`Card ${info.card_id} sem data-page`); }
                window.GlobalUtils.carregarPagina(p); // <- chama o global
            };

            card.addEventListener("click", abrir);
            card.addEventListener("keydown", (ev) => {
                if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); abrir(); }
            });

            return card;
        },
    };
}

// Boot
if (window.Configuracoes && typeof window.Configuracoes.configurarEventos === "function") {
    window.Configuracoes.configurarEventos();
}
