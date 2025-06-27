// ✅ Shub_categoria.js carregado
console.log("✅ Shub_categoria.js carregado");

if (typeof window.CategoriaHub === "undefined") {
  window.CategoriaHub = {
    paginaAtual: 1,
    registrosPorPagina: 20,
    totalPaginas: 1,
    dadosCache: {},

    configurarEventos: function () {
    let janelaCategoriaIncluir = null;

    document.querySelector("#ob_btnIncluir").addEventListener("click", () => {
      const largura = 800;
      const altura = 340;
      const esquerda = (window.screen.width - largura) / 2;
      const topo = (window.screen.height - altura) / 2;

      if (janelaCategoriaIncluir && !janelaCategoriaIncluir.closed) {
        janelaCategoriaIncluir.focus();
        return;
      }

      janelaCategoriaIncluir = window.open(
        '/categoria/incluir',
        'NovaCategoria',
        `width=${largura},height=${altura},top=${topo},left=${esquerda},resizable=no`
      );
    });


      document.querySelector("#ob_btnFiltrar").addEventListener("click", () => {
        CategoriaHub.paginaAtual = 1;
        CategoriaHub.carregarDados();
      });

      document.querySelector("#ob_btnlimparFiltro").addEventListener("click", () => {
        document.querySelector("#ob_filtroNome").value = "";
        document.querySelector("#ob_filtroOndeUsa").value = "";
        document.querySelector("#ob_filtroStatus").value = "true";
        CategoriaHub.paginaAtual = 1;
        CategoriaHub.carregarDados();
      });

      ["ob_btnPrimeiro", "ob_btnAnterior", "ob_btnProximo", "ob_btnUltimo"].forEach(id => {
        document.getElementById(id).addEventListener("click", () => {
          if (id === "ob_btnPrimeiro") CategoriaHub.paginaAtual = 1;
          else if (id === "ob_btnAnterior" && CategoriaHub.paginaAtual > 1) CategoriaHub.paginaAtual--;
          else if (id === "ob_btnProximo" && CategoriaHub.paginaAtual < CategoriaHub.totalPaginas) CategoriaHub.paginaAtual++;
          else if (id === "ob_btnUltimo") CategoriaHub.paginaAtual = CategoriaHub.totalPaginas;

          CategoriaHub.carregarDados();
        });
      });

      CategoriaHub.carregarDados();
    },

    carregarDados: function () {
      const nome = document.querySelector("#ob_filtroNome").value.trim();
      const ondeUsa = document.querySelector("#ob_filtroOndeUsa").value.trim();
      const status = document.querySelector("#ob_filtroStatus").value;

      let url = `/categoria/dados?pagina=${CategoriaHub.paginaAtual}&porPagina=${CategoriaHub.registrosPorPagina}`;
      if (nome) url += `&nome_categoria=${encodeURIComponent(nome)}`;
      if (ondeUsa) url += `&onde_usa=${encodeURIComponent(ondeUsa)}`;
      if (status !== "") url += `&status=${status}`;

      fetch(url)
        .then(res => res.ok ? res.json() : Promise.reject(res))
        .then(data => {
          CategoriaHub.dadosCache[CategoriaHub.paginaAtual] = data.dados;
          CategoriaHub.totalPaginas = data.total_paginas || 1;
          CategoriaHub.renderizarTabela();
        })
        .catch(err => {
          console.error("❌ Erro ao carregar categorias:", err);
          document.querySelector("#ob_listaCategorias").innerHTML = `<tr><td colspan='6'>Erro ao carregar dados.</td></tr>`;
        });
    },

    renderizarTabela: function () {
      const tbody = document.querySelector("#ob_listaCategorias");
      tbody.innerHTML = "";
      const dados = CategoriaHub.dadosCache[CategoriaHub.paginaAtual];

      if (!dados || dados.length === 0) {
        tbody.innerHTML = `<tr><td colspan='6'>Nenhuma categoria encontrada.</td></tr>`;
        return;
      }

      dados.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${item.id}</td>
          <td>${item.nome_categoria}</td>
          <td>${item.onde_usa}</td>
          <td>${item.desc_conta_contabil || "-"}</td>
          <td>${item.status ? "Ativo" : "Inativo"}</td>
          <td>
            <button class="Cl_BtnAcao btnEditar" data-id="${item.id}">✏️</button>
            <button class="Cl_BtnAcao btnExcluir" data-id="${item.id}">🗑️</button>
          </td>
        `;
        tbody.appendChild(tr);
      });

      CategoriaHub.atualizarPaginacao();
    },

    atualizarPaginacao: function () {
      document.querySelector("#ob_paginaAtual").textContent = CategoriaHub.paginaAtual;
      document.querySelector("#ob_totalPaginas").textContent = CategoriaHub.totalPaginas;
      document.querySelector("#ob_btnPrimeiro").disabled = CategoriaHub.paginaAtual === 1;
      document.querySelector("#ob_btnAnterior").disabled = CategoriaHub.paginaAtual === 1;
      document.querySelector("#ob_btnProximo").disabled = CategoriaHub.paginaAtual === CategoriaHub.totalPaginas;
      document.querySelector("#ob_btnUltimo").disabled = CategoriaHub.paginaAtual === CategoriaHub.totalPaginas;
    
    
      CategoriaHub.carregarcombo();
    },

    carregarcombo: function () {
      const select = document.getElementById("ob_filtroOndeUsa");

      if (!select) return;

      // Evita duplicar opções ao recarregar
      select.querySelectorAll("option:not([value=''])").forEach(opt => opt.remove());

      Util.TIPOS_ORIGEM.forEach((item) => {
        const opt = document.createElement("option");
        opt.value = item.replace(/\s/g, ''); // opcional: normaliza o value
        opt.textContent = item;
        select.appendChild(opt);
      });
    }

  };

  document.querySelector("#ob_listaCategorias").addEventListener("click", async function (e) {
    if (e.target.classList.contains("btnEditar")) {
      const id = e.target.dataset.id;
      window.__idCategoriaEditando__ = id;

      const largura = 800;
      const altura = 340;
      const esquerda = (window.screen.width - largura) / 2;
      const topo = (window.screen.height - altura) / 2;

      if (window.janelaEditarCategoria && !window.janelaEditarCategoria.closed) {
        window.janelaEditarCategoria.focus();
      } else {
        window.janelaEditarCategoria = window.open(
          "/categoria/editar",
          "EditarCategoria",
          `width=${largura},height=${altura},top=${topo},left=${esquerda},resizable=no`
        );
      }

    }

    if (e.target.classList.contains("btnExcluir")) {
      const id = e.target.dataset.id;
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
        if (resp.ok && json.status === "sucesso") {
          Swal.fire("Sucesso", json.mensagem, "success");
          CategoriaHub.carregarDados();
        } else {
          Swal.fire("Erro", json.erro || "Erro ao excluir.", "error");
        }
      } catch (err) {
        Swal.fire("Erro inesperado", err.message, "error");
      }
    }
  });

  window.addEventListener("message", function (event) {
    if (event.data && event.data.grupo === "apoioPronto") {
      const id = window.__idCategoriaEditando__;
      if (id) {
        event.source.postMessage({ grupo: "carregarCategoria", id }, "*");
        window.__idCategoriaEditando__ = null;
      }
    }
  });

  // 🚀 Inicializar

    window.CategoriaHub.configurarEventos();
    window.CategoriaHub.carregarcombo();

}
    window.CategoriaHub.configurarEventos();
    window.CategoriaHub.carregarcombo();

