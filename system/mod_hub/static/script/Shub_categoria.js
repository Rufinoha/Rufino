console.log("📘 Shub_categoria.js carregado");

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



(function () {
  // roda apenas na página de Categorias (tem a tabela)
  const isCategoriasPage = !!document.getElementById("ob_listaCategorias");

  if (!isCategoriasPage) {
    // Mesmo fora da página, manter um listener tolerante para mensagens
    window.addEventListener("message", (event) => {
      if (event.data?.grupo === "atualizarTabela") {
        window.CategoriasHub?.carregarDados?.();
      }
    });
    return; // nada de binds/DOM fora da página correta
  }

  // ===== Página de Categorias =====
  const Hub = (window.CategoriasHub = window.CategoriasHub || {
    paginaAtual: 1,
    registrosPorPagina: 20,
    totalPaginas: 1,
    dadosCache: {},

    configurarEventos() {
      // botões topo
      document.querySelector("#ob_btnIncluir")?.addEventListener("click", () => {
        GlobalUtils.abrirJanelaApoioModal({
          rota: "/categoria/incluir",
          titulo: "Nova Categoria",
          largura: 600,
          altura: 440,
          nivel: 1,
        });
      });

      document.querySelector("#ob_btnFiltrar")?.addEventListener("click", () => {
        Hub.paginaAtual = 1;
        Hub.carregarDados();
      });

      document.querySelector("#ob_btnlimparFiltro")?.addEventListener("click", () => {
        const fNome = document.getElementById("ob_filtroNome");
        const fStatus = document.getElementById("ob_filtroStatus");
        if (fNome) fNome.value = "";
        if (fStatus) fStatus.value = "true";
        Hub.paginaAtual = 1;
        Hub.carregarDados();
      });

      // paginação
      ["ob_btnPrimeiro", "ob_btnAnterior", "ob_btnProximo", "ob_btnUltimo"].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("click", () => {
          if (id === "ob_btnPrimeiro") Hub.paginaAtual = 1;
          else if (id === "ob_btnAnterior" && Hub.paginaAtual > 1) Hub.paginaAtual--;
          else if (id === "ob_btnProximo" && Hub.paginaAtual < Hub.totalPaginas) Hub.paginaAtual++;
          else if (id === "ob_btnUltimo") Hub.paginaAtual = Hub.totalPaginas;
          Hub.carregarDados();
        });
      });

      // tabela (delegation)
      const lista = document.getElementById("ob_listaCategorias");
      if (lista) {
        lista.addEventListener("click", async (e) => {
          const btn = e.target.closest("button");
          if (!btn) return;

          const idRaw = btn.dataset.id;
          const id = Number(idRaw);
          if (!idRaw || Number.isNaN(id) || id <= 0) {
            Swal.fire("Erro", "ID da categoria inválido.", "error");
            return;
          }

          if (btn.classList.contains("btnEditar")) {
            GlobalUtils.abrirJanelaApoioModal({
              rota: "/categoria/editar",
              id,
              titulo: "Editar Categoria",
              largura: 600,
              altura: 440,
              nivel: 1,
            });
            return;
          }

          if (btn.classList.contains("btnContas")) {
            GlobalUtils.abrirJanelaApoioModal({
              rota: "/categoria/contas_apoio",
              id,
              titulo: "Contas Vinculadas",
              largura: 800,
              altura: 600,
              nivel: 1,
            });
            return;
          }

          if (btn.classList.contains("btnExcluir")) {
            const tr = btn.closest("tr");
            const nome = tr?.children?.[1]?.textContent?.trim() || "(sem nome)";

            const confirma = await Swal.fire({
              title: `Excluir categoria "${nome}"?`,
              text: "Essa ação não poderá ser desfeita.",
              icon: "warning",
              showCancelButton: true,
              confirmButtonText: "Sim, excluir",
              cancelButtonText: "Cancelar",
            });
            if (!confirma.isConfirmed) return;

            try {
              const resp = await fetch("/categoria/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
              });

              const json = await resp.json();

              if (resp.status === 401) {
                await Swal.fire("Sessão expirada", json.mensagem || "Faça login novamente.", "warning");
                return;
              }

              if (resp.ok && json.sucesso) {
                await Swal.fire("Excluído!", json.mensagem || "Categoria excluída com sucesso.", "success");
                window.parent?.postMessage({ grupo: "atualizarTabela" }, "*");
                Hub.carregarDados();
              } else {
                Swal.fire("Erro", json.mensagem || "Erro ao excluir.", "error");
              }
            } catch (err) {
              Swal.fire("Erro", "Erro inesperado ao excluir.", "error");
            }
          }
        });
      }

      // ouvir atualizações vindas dos apoios
      window.addEventListener("message", (event) => {
        if (event.data?.grupo === "atualizarTabela") {
          Hub.carregarDados();
        }
      });

      // 1ª carga
      Hub.carregarDados();
    },

    carregarDados() {
      const filtros = {
        nome: (document.getElementById("ob_filtroNome")?.value || "").trim(),
        status: document.getElementById("ob_filtroStatus")?.value || "", // "true" | "false" | ""
      };

      const idEmp = window.App?.id_empresa ?? window.App?.Varidcliente ?? "";

      // Se o backend for 0-based, troque para: const pageParam = Hub.paginaAtual - 1;
      const pageParam = Hub.paginaAtual;

      // Ajustáveis conforme sua API:
      const perPageKey = "porPagina"; // ou "por_pagina"
      const pageKey = "pagina"; // ou "page"

      const params = new URLSearchParams();
      params.set(pageKey, String(pageParam));
      params.set(perPageKey, String(Hub.registrosPorPagina));
      if (idEmp !== "") params.set("id_empresa", String(idEmp));
      if (filtros.nome) params.set("nome", filtros.nome);

      // Converter status para 1/0 (ajuste se sua API aceitar true/false string)
      if (filtros.status !== "") {
        const statusVal = (filtros.status === "true" || filtros.status === true) ? "1" : "0";
        params.set("status", statusVal);
      }

      fetch(`/categoria/dados?${params.toString()}`)
        .then((res) => res.json())
        .then((data) => {
          // Descobrir total de páginas de forma resiliente
          const totalReg = data.total_registros ?? data.total ?? null;
          const totalPaginasAPI =
            data.total_paginas ??
            data.totalPages ??
            (totalReg != null ? Math.max(1, Math.ceil(totalReg / Hub.registrosPorPagina)) : 1);

          Hub.totalPaginas = totalPaginasAPI;

          // Clamp se a página atual estourou o limite (após filtro/remoção)
          if (Hub.paginaAtual > Hub.totalPaginas) {
            Hub.paginaAtual = Hub.totalPaginas;
            return Hub.carregarDados(); // reconsulta com a página corrigida
          }

          Hub.dadosCache[Hub.paginaAtual] = data.dados || data.items || [];
          Hub.renderizarTabela();
          Hub.atualizarControlesPaginacao();
        })
        .catch((err) => console.error("Erro ao carregar dados:", err));
    },

    renderizarTabela() {
      const tbody = document.getElementById("ob_listaCategorias");
      if (!tbody) return;

      const dados = Hub.dadosCache[Hub.paginaAtual] || [];
      tbody.innerHTML = "";

      if (!dados.length) {
        tbody.innerHTML = `<tr><td colspan="5">Nenhuma categoria encontrada.</td></tr>`;
        this.atualizarControlesPaginacao();
        return;
      }

      dados.forEach((item) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${item.id}</td>
          <td>${item.nome_categoria}</td>
          <td>${item.quantidade_contas ?? 0}</td>
          <td>${item.status ? "Ativo" : "Inativo"}</td>
          <td>
            <button class="Cl_BtnAcao btnEditar" data-id="${item.id}">${Util?.gerarIconeTech?.("editar") ?? "✏️"}</button>
            <button class="Cl_BtnAcao btnContas" data-id="${item.id}">${Util?.gerarIconeTech?.("plano_contas") ?? "📒"}</button>
            <button class="Cl_BtnAcao btnExcluir" data-id="${item.id}">${Util?.gerarIconeTech?.("excluir") ?? "🗑️"}</button>
          </td>
        `;
        tbody.appendChild(tr);
      });

      try {
        window.lucide?.createIcons?.();
      } catch (_) {}
    },

    atualizarControlesPaginacao() {
      const desabilitar = (id, cond) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.disabled = !!cond;
        el.classList.toggle("is-disabled", !!cond);
      };

      desabilitar("ob_btnPrimeiro", Hub.paginaAtual <= 1);
      desabilitar("ob_btnAnterior", Hub.paginaAtual <= 1);
      desabilitar("ob_btnProximo", Hub.paginaAtual >= Hub.totalPaginas);
      desabilitar("ob_btnUltimo", Hub.paginaAtual >= Hub.totalPaginas);

      const lbl = document.getElementById("ob_lblPaginacao");
      if (lbl) {
        lbl.textContent = `Página ${Hub.paginaAtual} de ${Hub.totalPaginas}`;
      }
    },
  }); 

  // inicia quando o DOM estiver pronto
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => Hub.configurarEventos());
  } else {
    Hub.configurarEventos();
  }
})();
