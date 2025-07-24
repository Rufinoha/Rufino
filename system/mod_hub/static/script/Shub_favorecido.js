// ✅ Shub_favorecido.js carregado
console.log("Shub_favorecido.js carregado");

if (typeof window.FavorecidoHub === "undefined") {
  window.FavorecidoHub = {
    paginaAtual: 1,
    registrosPorPagina: 20,
    totalPaginas: 1,
    dadosCache: {},

    configurarEventos: function () {
      let janelaFavorecido = null;

      document.querySelector("#ob_btnIncluir").addEventListener("click", () => {
        GlobalUtils.abrirJanelaApoioModal({
          rota: '/favorecido/incluir',
          titulo: 'Novo Favorecido',
          largura: 950,
          altura: 800,
          nivel: 1
        });
      });


      document.querySelector("#ob_btnFiltrar").addEventListener("click", () => {
        FavorecidoHub.paginaAtual = 1;
        FavorecidoHub.carregarDados();
      });

      document.querySelector("#ob_btnlimparFiltro").addEventListener("click", () => {
        document.querySelector("#ob_filtroDocumento").value = "";
        document.querySelector("#ob_filtroCategoria").value = "";
        document.querySelector("#ob_filtroRazao").value = "";
        document.querySelector("#ob_filtroStatus").value = "true";
        FavorecidoHub.paginaAtual = 1;
        FavorecidoHub.carregarDados();
      });

      ["ob_btnPrimeiro", "ob_btnAnterior", "ob_btnProximo", "ob_btnUltimo"].forEach(id => {
        document.getElementById(id).addEventListener("click", () => {
          if (id === "ob_btnPrimeiro") FavorecidoHub.paginaAtual = 1;
          else if (id === "ob_btnAnterior" && FavorecidoHub.paginaAtual > 1) FavorecidoHub.paginaAtual--;
          else if (id === "ob_btnProximo" && FavorecidoHub.paginaAtual < FavorecidoHub.totalPaginas) FavorecidoHub.paginaAtual++;
          else if (id === "ob_btnUltimo") FavorecidoHub.paginaAtual = FavorecidoHub.totalPaginas;

          FavorecidoHub.carregarDados();
        });
      });

      FavorecidoHub.carregarcombo();
      FavorecidoHub.carregarDados();
    },

    carregarDados: function () {
      const documento = document.querySelector("#ob_filtroDocumento").value.trim();
      const categoria = document.querySelector("#ob_filtroCategoria").value.trim();
      const razao = document.querySelector("#ob_filtroRazao").value.trim();
      const status = document.querySelector("#ob_filtroStatus").value;

      let url = `/favorecido/dados?pagina=${FavorecidoHub.paginaAtual}&porPagina=${FavorecidoHub.registrosPorPagina}`;
      if (documento) url += `&documento=${encodeURIComponent(documento)}`;
      if (categoria) url += `&id_categoria=${encodeURIComponent(categoria)}`;
      if (razao) url += `&razao_social=${encodeURIComponent(razao)}`;
      if (status !== "") url += `&status=${status}`;

      fetch(url)
        .then(res => res.ok ? res.json() : Promise.reject(res))
        .then(data => {
          FavorecidoHub.dadosCache[FavorecidoHub.paginaAtual] = data.dados;
          FavorecidoHub.totalPaginas = data.total_paginas || 1;
          FavorecidoHub.renderizarTabela();
        })
        .catch(err => {
          console.error("Erro ao carregar favorecidos:", err);
          document.querySelector("#ob_listaFavorecidos").innerHTML = `<tr><td colspan='8'>Erro ao carregar dados.</td></tr>`;
        });
    },

    renderizarTabela: function () {
      const tbody = document.querySelector("#ob_listaFavorecidos");
      tbody.innerHTML = "";
      const dados = FavorecidoHub.dadosCache[FavorecidoHub.paginaAtual];

      if (!dados || dados.length === 0) {
        tbody.innerHTML = `<tr><td colspan='7'>Nenhum favorecido encontrado.</td></tr>`;
        return;
      }

      dados.forEach(item => {
        const cidadeUf = item.cidade ? `${item.cidade} - ${item.uf || ''}` : "-";
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${item.id}</td>
          <td>${item.documento || "-"}</td>
          <td>${item.razao_social || "-"}</td>
          <td>${cidadeUf}</td>
          <td>${item.categoria_nome || "-"}</td>
          <td>${item.status ? "Ativo" : "Inativo"}</td>
          <td>
            <button type="button" class="Cl_BtnAcao btnEditar" data-id="${item.id}" title="Editar">
              ${Util.gerarIconeTech('editar')}
            </button>
            <button type="button" class="Cl_BtnAcao btnExcluir" data-id="${item.id}" title="Excluir">
              ${Util.gerarIconeTech('excluir')}
            </button>
          </td>

        `;
        tbody.appendChild(tr);
        lucide.createIcons();
      });

      FavorecidoHub.atualizarPaginacao();
    },

    atualizarPaginacao: function () {
      document.querySelector("#ob_paginaAtual").textContent = FavorecidoHub.paginaAtual;
      document.querySelector("#ob_totalPaginas").textContent = FavorecidoHub.totalPaginas;
      document.querySelector("#ob_btnPrimeiro").disabled = FavorecidoHub.paginaAtual === 1;
      document.querySelector("#ob_btnAnterior").disabled = FavorecidoHub.paginaAtual === 1;
      document.querySelector("#ob_btnProximo").disabled = FavorecidoHub.paginaAtual === FavorecidoHub.totalPaginas;
      document.querySelector("#ob_btnUltimo").disabled = FavorecidoHub.paginaAtual === FavorecidoHub.totalPaginas;
    },

    carregarcombo: function () {
      const select = document.getElementById("ob_filtroCategoria");
      if (!select) return;

      select.querySelectorAll("option:not([value=''])").forEach(opt => opt.remove());
      Util.TIPOS_ORIGEM.forEach((item) => {
        const opt = document.createElement("option");
        opt.value = item.replace(/\s/g, '');
        opt.textContent = item;
        select.appendChild(opt);
      });
    }
  };

  document.querySelector("#ob_listaFavorecidos").addEventListener("click", async function (e) {
    const botao = e.target.closest("button");
    if (!botao || !botao.dataset.id) return;

    const id = botao.dataset.id;

    if (botao.classList.contains("btnEditar")) {
      GlobalUtils.abrirJanelaApoioModal({
        rota: `/favorecido/editar?id=${id}`,
        id: id,
        titulo: 'Editar Favorecido',
        largura: 950,
        altura: 800,
        nivel: 1
      });

      return;
    }


    if (botao.classList.contains("btnExcluir")) {
      const confirma = await Swal.fire({
        title: `Excluir favorecido ${id}?`,
        text: "Essa ação não poderá ser desfeita.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sim, excluir',
        cancelButtonText: 'Cancelar'
      });

      if (!confirma.isConfirmed) return;

      try {
        const resp = await fetch(`/favorecido/delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id })
        });

        const json = await resp.json();
        if (resp.ok && json.status === "sucesso") {
          Swal.fire("Sucesso", json.mensagem, "success");
          FavorecidoHub.carregarDados();
        } else {
          Swal.fire("Erro", json.erro || "Erro ao excluir.", "error");
        }
      } catch (err) {
        Swal.fire("Erro inesperado", err.message, "error");
      }
    }
  });

  window.FavorecidoHub.configurarEventos();
}
window.FavorecidoHub.configurarEventos();

window.addEventListener("message", (event) => {
  if (event.data?.grupo === "atualizarTabela") {
    window.FavorecidoHub.configurarEventos();
  }
});
