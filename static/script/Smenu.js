console.log("📘 Smenu.js carregado");

if (typeof window.MenuHub === "undefined") {
  window.MenuHub = {
    paginaAtual: 1,
    registrosPorPagina: 20,
    totalPaginas: 1,
    dadosCache: {},
    filtrosAtuais: { nome: "", menu_pai: "", modulo: "" },
    _reqSeq: 0, // protege contra respostas fora de ordem

    configurarEventos: function () {
      // combos
      fetch("/menu/combos")
        .then(r => r.json())
        .then(c => {
          const selPai = document.getElementById("ob_filtroMenuPai");
          const selMod = document.getElementById("ob_filtroModulo");

          (c.menus_pai || []).forEach(nome => {
            const op = document.createElement("option");
            op.value = nome;
            op.textContent = nome;
            selPai.appendChild(op);
          });

          (c.modulos || []).forEach(nome => {
            const op = document.createElement("option");
            op.value = nome;
            op.textContent = nome;
            selMod.appendChild(op);
          });
        });

      // incluir
      document.querySelector("#ob_btnIncluir").addEventListener("click", () => {
        GlobalUtils.abrirJanelaApoioModal({
          rota: "/menu/incluir",
          titulo: "Novo Menu",
          largura: 840,
          altura: 680,
          nivel: 1
        });
      });

      // aplicar filtro
      document.querySelector("#ob_btnFiltrar").addEventListener("click", () => {
        const novo = {
          nome: document.getElementById("ob_filtroNome").value.trim(),
          menu_pai: document.getElementById("ob_filtroMenuPai").value.trim(),
          modulo: document.getElementById("ob_filtroModulo").value.trim()
        };

        // se filtros mudaram, zera cache e volta pra página 1
        if (JSON.stringify(novo) !== JSON.stringify(MenuHub.filtrosAtuais)) {
          MenuHub.filtrosAtuais = novo;
          MenuHub.paginaAtual = 1;
          MenuHub.dadosCache = {};
        }
        MenuHub.carregarDados();
      });

      // limpar filtro
      document.querySelector("#ob_btnlimparFiltro").addEventListener("click", () => {
        document.getElementById("ob_filtroNome").value = "";
        document.getElementById("ob_filtroMenuPai").value = "";
        document.getElementById("ob_filtroModulo").value = "";
        MenuHub.filtrosAtuais = { nome: "", menu_pai: "", modulo: "" };
        MenuHub.paginaAtual = 1;
        MenuHub.dadosCache = {};
        MenuHub.carregarDados();
      });

      // paginação
      ["ob_btnPrimeiro", "ob_btnAnterior", "ob_btnProximo", "ob_btnUltimo"].forEach(id => {
        document.getElementById(id).addEventListener("click", () => {
          if (id === "ob_btnPrimeiro") MenuHub.paginaAtual = 1;
          else if (id === "ob_btnAnterior" && MenuHub.paginaAtual > 1) MenuHub.paginaAtual--;
          else if (id === "ob_btnProximo" && MenuHub.paginaAtual < MenuHub.totalPaginas) MenuHub.paginaAtual++;
          else if (id === "ob_btnUltimo") MenuHub.paginaAtual = MenuHub.totalPaginas;
          MenuHub.carregarDados();
        });
      });

      // apoio avisa para recarregar
      window.addEventListener("message", (event) => {
        if (event.data && event.data.grupo === "atualizarTabela") {
          // mantém filtros/página, mas invalida cache da página atual
          delete MenuHub.dadosCache[MenuHub.paginaAtual];
          MenuHub.carregarDados();
        }
      });

      // primeira carga
      MenuHub.carregarDados();
    },

    carregarDados: function () {
      const tbody = document.getElementById("ob_listaMenus");
      tbody.innerHTML = `<tr class="Cl_Carregando"><td colspan="9">Carregando...</td></tr>`;

      const { nome, menu_pai, modulo } = MenuHub.filtrosAtuais;

      let url = `/menu/dados?pagina=${MenuHub.paginaAtual}&porPagina=${MenuHub.registrosPorPagina}`;
      if (nome)      url += `&nome=${encodeURIComponent(nome)}`;
      if (menu_pai)  url += `&menu_pai=${encodeURIComponent(menu_pai)}`;
      if (modulo)    url += `&modulo=${encodeURIComponent(modulo)}`;

      const mySeq = ++MenuHub._reqSeq;

      fetch(url)
        .then(res => res.json())
        .then(data => {
          // se chegou resposta antiga, ignora
          if (mySeq !== MenuHub._reqSeq) return;

          MenuHub.totalPaginas = data.total_paginas || 1;
          MenuHub.dadosCache[MenuHub.paginaAtual] = data.dados || [];
          MenuHub.renderizarTabela();
        })
        .catch(() => {
          tbody.innerHTML = `<tr><td colspan="9">Falha ao carregar dados.</td></tr>`;
          Swal.fire("Erro", "Falha ao carregar dados.", "error");
        });
    },

    renderizarTabela: function () {
      const tbody = document.getElementById("ob_listaMenus");
      const dados = MenuHub.dadosCache[MenuHub.paginaAtual] || [];

      // 🔑 limpa a tabela SEMPRE antes de desenhar
      tbody.innerHTML = "";

      if (dados.length === 0) {
        tbody.innerHTML = "<tr><td colspan='9'>Nenhum menu encontrado.</td></tr>";
        MenuHub.atualizarPaginacao();
        return;
      }

      // mapa id->registro (para resolver nome do pai)
      const mapa = {};
      Object.values(MenuHub.dadosCache).forEach(lista => {
        (lista || []).forEach(reg => { mapa[reg.id] = reg; });
      });

      dados.forEach(item => {
        const nomePai =
          (item.nome_pai && String(item.nome_pai).trim()) ||
          (item.parent_id ? (mapa[item.parent_id]?.nome_menu || "—") : "—");

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${item.id}</td>
          <td>${item.nome_menu || ""}</td>
          <td>${item.descricao || ""}</td>
          <td>${nomePai}</td>
          <td>${item.sequencia ?? item.ordem ?? ""}</td>
          <td>${item.pai ? "Sim" : "Não"}</td>
          <td>${item.data_page || ""}</td>
          <td>${item.modulo || ""}</td>
          <td>
            <button class="Cl_BtnAcao btnEditar" data-id="${item.id}">
              ${Util.gerarIconeTech("editar")}
            </button>
            <button class="Cl_BtnAcao btnExcluir" data-id="${item.id}">
              ${Util.gerarIconeTech("excluir")}
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });

      lucide.createIcons();
      MenuHub.atualizarPaginacao();
    },

    atualizarPaginacao: function () {
      document.getElementById("ob_paginaAtual").textContent = MenuHub.paginaAtual;
      document.getElementById("ob_totalPaginas").textContent = MenuHub.totalPaginas;

      document.getElementById("ob_btnPrimeiro").disabled = MenuHub.paginaAtual === 1;
      document.getElementById("ob_btnAnterior").disabled = MenuHub.paginaAtual === 1;
      document.getElementById("ob_btnProximo").disabled = MenuHub.paginaAtual === MenuHub.totalPaginas;
      document.getElementById("ob_btnUltimo").disabled = MenuHub.paginaAtual === MenuHub.totalPaginas;
    }
  };

  // delegação de eventos (edição/exclusão)
  document.getElementById("content-area-Menu").addEventListener("click", async function (e) {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = Number(btn.dataset.id);

    if (btn.classList.contains("btnEditar")) {
      GlobalUtils.abrirJanelaApoioModal({
        rota: "/menu/editar",
        id,
        titulo: "Editar Menu",
        largura: 840,
        altura: 680,
        nivel: 1
      });
      return;
    }

    if (btn.classList.contains("btnExcluir")) {
      const tr = btn.closest("tr");
      const nome = tr.children[1].innerText.trim();

      const confirma = await Swal.fire({
        title: `Excluir menu "${nome}"?`,
        text: "Essa ação não poderá ser desfeita.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sim, excluir",
        cancelButtonText: "Cancelar"
      });
      if (!confirma.isConfirmed) return;

      try {
        const resp = await fetch(`/menu/delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id })
        });
        const json = await resp.json();
        if (resp.ok) {
          await Swal.fire("Sucesso", "Menu excluído com sucesso.", "success");
          // invalida página atual e recarrega a partir do servidor
          delete MenuHub.dadosCache[MenuHub.paginaAtual];
          MenuHub.carregarDados();
        } else {
          Swal.fire("Erro", json.erro || "Erro ao excluir.", "error");
        }
      } catch (err) {
        Swal.fire("Erro", err.message || "Erro inesperado.", "error");
      }
    }
  });

  MenuHub.configurarEventos();
}
