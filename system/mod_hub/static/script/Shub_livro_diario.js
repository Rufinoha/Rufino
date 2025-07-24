//Shub_livro_diario.js carregado
console.log("Shub_livro_diario.js carregado");

if (typeof window.LivroDiarioHub === "undefined") {
  window.LivroDiarioHub = {
    paginaAtual: 1,
    registrosPorPagina: 20,
    totalPaginas: 1,
    dadosCache: {},

    configurarEventos: function () {
      let janelaLivroIncluir = null;

      document.querySelector("#ob_btnIncluir").addEventListener("click", () => {
        GlobalUtils.abrirJanelaApoioModal({
          rota: '/livro_diario/incluir',
          titulo: 'Nova Conta no Livro Diário',
          largura: 800,
          altura: 550,
          nivel: 1
        });
      });


      document.querySelector("#ob_btnFiltrar").addEventListener("click", () => {
        LivroDiarioHub.paginaAtual = 1;
        LivroDiarioHub.carregarDados();
      });

      document.querySelector("#ob_btnlimparFiltro").addEventListener("click", () => {
        document.querySelector("#ob_filtroNome").value = "";
        document.querySelector("#ob_filtroTipoConta").value = "";
        document.querySelector("#ob_filtroStatus").value = "true";
        LivroDiarioHub.paginaAtual = 1;
        LivroDiarioHub.carregarDados();
      });

      ["ob_btnPrimeiro", "ob_btnAnterior", "ob_btnProximo", "ob_btnUltimo"].forEach(id => {
        document.getElementById(id).addEventListener("click", () => {
          if (id === "ob_btnPrimeiro") LivroDiarioHub.paginaAtual = 1;
          else if (id === "ob_btnAnterior" && LivroDiarioHub.paginaAtual > 1) LivroDiarioHub.paginaAtual--;
          else if (id === "ob_btnProximo" && LivroDiarioHub.paginaAtual < LivroDiarioHub.totalPaginas) LivroDiarioHub.paginaAtual++;
          else if (id === "ob_btnUltimo") LivroDiarioHub.paginaAtual = LivroDiarioHub.totalPaginas;

          LivroDiarioHub.carregarDados();
        });
      });

      LivroDiarioHub.carregarDados();
      LivroDiarioHub.carregarTipoContaCombo();
    },

    carregarDados: function () {
      const nome = document.querySelector("#ob_filtroNome").value.trim();
      const tipoConta = document.querySelector("#ob_filtroTipoConta").value.trim();
      const status = document.querySelector("#ob_filtroStatus").value;

      let url = `/livro_diario/dados?id_empresa=${App.Varidcliente}&pagina=${LivroDiarioHub.paginaAtual}&porPagina=${LivroDiarioHub.registrosPorPagina}`;
      if (nome) url += `&nome=${encodeURIComponent(nome)}`;
      if (tipoConta) url += `&tipo_conta=${encodeURIComponent(tipoConta)}`;
      if (status !== "") url += `&status=${status}`;

      fetch(url)
        .then(res => res.ok ? res.json() : Promise.reject(res))
        .then(data => {
          LivroDiarioHub.dadosCache[LivroDiarioHub.paginaAtual] = data.dados;
          LivroDiarioHub.totalPaginas = data.total_paginas || 1;
          LivroDiarioHub.renderizarTabela();
        })
        .catch(err => {
          console.error("Erro ao carregar dados do Livro Diário:", err);
          document.querySelector("#ob_listaLivroDiario").innerHTML = `<tr><td colspan='6'>Erro ao carregar dados.</td></tr>`;
        });
    },

    renderizarTabela: function () {
      const tbody = document.querySelector("#ob_listaLivroDiario");
      tbody.innerHTML = "";
      const dados = LivroDiarioHub.dadosCache[LivroDiarioHub.paginaAtual];

      if (!dados || dados.length === 0) {
        tbody.innerHTML = `<tr><td colspan='6'>Nenhuma conta encontrada.</td></tr>`;
        return;
      }

      dados.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${item.id}</td>
          <td>${item.nome_exibicao}</td>
          <td>${item.tipo_conta}</td>
          <td>${item.desc_conta_contabil || "-"}</td>
          <td>${item.status ? "Ativo" : "Inativo"}</td>
          <td>
            <button class="Cl_BtnAcao btnEditar" data-id="${item.id}">
              ${Util.gerarIconeTech('editar')}
            </button>
            <button class="Cl_BtnAcao btnExcluir" data-id="${item.id}">
              ${Util.gerarIconeTech('excluir')}
            </button>
          </td>

        `;
        tbody.appendChild(tr);
        lucide.createIcons();
      });

      LivroDiarioHub.atualizarPaginacao();
    },

    atualizarPaginacao: function () {
      document.querySelector("#ob_paginaAtual").textContent = LivroDiarioHub.paginaAtual;
      document.querySelector("#ob_totalPaginas").textContent = LivroDiarioHub.totalPaginas;
      document.querySelector("#ob_btnPrimeiro").disabled = LivroDiarioHub.paginaAtual === 1;
      document.querySelector("#ob_btnAnterior").disabled = LivroDiarioHub.paginaAtual === 1;
      document.querySelector("#ob_btnProximo").disabled = LivroDiarioHub.paginaAtual === LivroDiarioHub.totalPaginas;
      document.querySelector("#ob_btnUltimo").disabled = LivroDiarioHub.paginaAtual === LivroDiarioHub.totalPaginas;
    },

    carregarTipoContaCombo: function () {
      const select = document.getElementById("ob_filtroTipoConta");
      if (!select) return;

      select.querySelectorAll("option:not([value=''])").forEach(opt => opt.remove());

      Util.TIPOS_CONTA_PADRAO.forEach(tipo => {
        const opt = document.createElement("option");
        opt.value = tipo.valor;
        opt.textContent = tipo.label;
        select.appendChild(opt);
      });
    }
  };

  document.querySelector("#ob_listaLivroDiario").addEventListener("click", async function (e) {
    const btnEditar = e.target.closest(".btnEditar");
    const btnExcluir = e.target.closest(".btnExcluir");

    if (btnEditar) {
      const id = btnEditar.dataset.id;
      window.__idLivroEditando__ = id;

      GlobalUtils.abrirJanelaApoioModal({
        rota: '/livro_diario/editar',
        id: id,
        titulo: 'Editar Conta do Livro Diário',
        largura: 800,
        altura: 550,
        nivel: 1
      });
    }

    if (btnExcluir) {
      const id = btnExcluir.dataset.id;
      const confirma = await Swal.fire({
        title: `Excluir conta ${id}?`,
        text: "Essa ação não poderá ser desfeita.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sim, excluir',
        cancelButtonText: 'Cancelar'
      });

      if (!confirma.isConfirmed) return;

      try {
        const resp = await fetch(`/livro_diario/delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id })
        });

        const json = await resp.json();
        if (resp.ok && json.status === "sucesso") {
          Swal.fire("Sucesso", json.mensagem, "success");
          LivroDiarioHub.carregarDados();
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
      const id = window.__idLivroEditando__;
      if (id) {
        event.source.postMessage({ grupo: "carregarLivro", id }, "*");
        window.__idLivroEditando__ = null;
      }
    }
  });

  window.LivroDiarioHub.configurarEventos();
}