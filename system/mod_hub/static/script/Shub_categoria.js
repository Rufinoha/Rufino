// ✅ Shub_categoria.js carregado
console.log("📘 Shub_categoria.js carregado");

if (typeof window.CategoriasHub === "undefined") {
  window.CategoriasHub = {
    paginaAtual: 1,
    registrosPorPagina: 20,
    totalPaginas: 1,
    dadosCache: {},

    configurarEventos: function () {
      document.querySelector("#ob_btnIncluir").addEventListener("click", () => {
        GlobalUtils.abrirJanelaApoioModal({
          rota: '/categoria/incluir',
          titulo: 'Nova Categoria',
          largura: 600,
          altura: 500,
          nivel: 1
        });
      });

      document.querySelector("#ob_btnFiltrar").addEventListener("click", () => {
        CategoriasHub.paginaAtual = 1;
        CategoriasHub.carregarDados();
      });

      document.querySelector("#ob_btnlimparFiltro").addEventListener("click", () => {
        document.getElementById("ob_filtroNome").value = "";
        document.getElementById("ob_filtroStatus").value = "true";
        CategoriasHub.paginaAtual = 1;
        CategoriasHub.carregarDados();
      });

      ["ob_btnPrimeiro", "ob_btnAnterior", "ob_btnProximo", "ob_btnUltimo"].forEach(id => {
        document.getElementById(id).addEventListener("click", () => {
          if (id === "ob_btnPrimeiro") CategoriasHub.paginaAtual = 1;
          else if (id === "ob_btnAnterior" && CategoriasHub.paginaAtual > 1) CategoriasHub.paginaAtual--;
          else if (id === "ob_btnProximo" && CategoriasHub.paginaAtual < CategoriasHub.totalPaginas) CategoriasHub.paginaAtual++;
          else if (id === "ob_btnUltimo") CategoriasHub.paginaAtual = CategoriasHub.totalPaginas;
          CategoriasHub.carregarDados();
        });
      });

      CategoriasHub.carregarDados();
    },

    carregarDados: function () {
      const filtros = {
        nome: document.getElementById("ob_filtroNome").value.trim(),
        status: document.getElementById("ob_filtroStatus").value
      };

      let url = `/categoria/dados?id_empresa=${App.Varidcliente}&pagina=${CategoriasHub.paginaAtual}&porPagina=${CategoriasHub.registrosPorPagina}`;
      Object.entries(filtros).forEach(([key, val]) => {
        if (val) url += `&${key}=${encodeURIComponent(val)}`;
      });

      fetch(url).then(res => res.json()).then(data => {
        CategoriasHub.totalPaginas = data.total_paginas || 1;
        CategoriasHub.dadosCache[CategoriasHub.paginaAtual] = data.dados;
        CategoriasHub.renderizarTabela();
      });
    },

    renderizarTabela: function () {
      const tbody = document.getElementById("ob_listaCategorias");
      tbody.innerHTML = "";

      const dados = CategoriasHub.dadosCache[CategoriasHub.paginaAtual] || [];

      if (dados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5">Nenhuma categoria encontrada.</td></tr>`;
        return;
      }

      dados.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${item.id}</td>
          <td>${item.nome_categoria}</td>
          <td>${item.quantidade_contas || 0}</td>
          <td>${item.status ? "Ativo" : "Inativo"}</td>
          <td>
            <button class="Cl_BtnAcao btnEditar" data-id="${item.id}">${Util.gerarIconeTech('editar')}</button>
            <button class="Cl_BtnAcao btnContas" data-id="${item.id}">${Util.gerarIconeTech('plano_contas')}</button>
            <button class="Cl_BtnAcao btnExcluir" data-id="${item.id}">${Util.gerarIconeTech('excluir')}</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
      lucide.createIcons();
    }
  };

  // Ações dos botões via delegation
  document.querySelector("#ob_listaCategorias").addEventListener("click", async function (e) {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.dataset.id;

    if (btn.classList.contains("btnEditar")) {
      GlobalUtils.abrirJanelaApoioModal({
        rota: "/categoria/editar",
        id: parseInt(id),
        titulo: "Editar Categoria",
        largura: 600,
        altura: 500,
        nivel: 1
      });
    }

    if (btn.classList.contains("btnContas")) {
      GlobalUtils.abrirJanelaApoioModal({
        rota: "/categoria/contas_apoio",
        id: parseInt(id),
        titulo: "Contas Vinculadas",
        largura: 800,
        altura: 600,
        nivel: 1
      });
    }

    if (btn.classList.contains("btnExcluir")) {
      const confirma = await Swal.fire({
        title: `Excluir categoria ${id}?`,
        text: "Essa ação não poderá ser desfeita.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sim, excluir',
        cancelButtonText: 'Cancelar'
      });
      if (!confirma.isConfirmed) return;
      try {
        const resp = await fetch(`/categoria/delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id })
        });
        const json = await resp.json();
        if (resp.ok && json.retorno) {
          Swal.fire("Sucesso", json.msg, "success");
          CategoriasHub.carregarDados();
        } else {
          Swal.fire("Erro", json.msg || "Erro ao excluir.", "error");
        }
      } catch (err) {
        Swal.fire("Erro inesperado", err.message, "error");
      }
    }
  });

  // Escuta mensagem para atualizar via postMessage
  window.addEventListener("message", function (event) {
    if (event.data && event.data.grupo === "atualizarTabela") {
      CategoriasHub.carregarDados();
    }
  });

  window.CategoriasHub.configurarEventos();
}
