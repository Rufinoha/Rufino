// ✅ Shub_projetos.js carregado
console.log("📘 Shub_projetos.js carregado");

if (typeof window.ProjetosHub === "undefined") {
  window.ProjetosHub = {
    paginaAtual: 1,
    registrosPorPagina: 20,
    totalPaginas: 1,
    dadosCache: {},

    configurarEventos: function () {
      document.querySelector("#ob_btnIncluir").addEventListener("click", () => {
        GlobalUtils.abrirJanelaApoioModal({
          rota: '/projetos/incluir',
          titulo: 'Novo Projeto',
          largura: 600,
          altura: 500,
          nivel: 1
        });
      });

      document.querySelector("#ob_btnFiltrar").addEventListener("click", () => {
        ProjetosHub.paginaAtual = 1;
        ProjetosHub.carregarDados();
      });

      document.querySelector("#ob_btnlimparFiltro").addEventListener("click", () => {
        document.getElementById("ob_filtroNome").value = "";
        document.getElementById("ob_filtroStatus").value = "true";
        ProjetosHub.paginaAtual = 1;
        ProjetosHub.carregarDados();
      });

      ["ob_btnPrimeiro", "ob_btnAnterior", "ob_btnProximo", "ob_btnUltimo"].forEach(id => {
        document.getElementById(id).addEventListener("click", () => {
          if (id === "ob_btnPrimeiro") ProjetosHub.paginaAtual = 1;
          else if (id === "ob_btnAnterior" && ProjetosHub.paginaAtual > 1) ProjetosHub.paginaAtual--;
          else if (id === "ob_btnProximo" && ProjetosHub.paginaAtual < ProjetosHub.totalPaginas) ProjetosHub.paginaAtual++;
          else if (id === "ob_btnUltimo") ProjetosHub.paginaAtual = ProjetosHub.totalPaginas;
          ProjetosHub.carregarDados();
        });
      });

      ProjetosHub.carregarDados();
    },

    carregarDados: function () {
      const filtros = {
        nome: document.getElementById("ob_filtroNome").value.trim(),
        status: document.getElementById("ob_filtroStatus").value
      };

      let url = `/projetos/dados?id_empresa=${App.Varidcliente}&pagina=${ProjetosHub.paginaAtual}&porPagina=${ProjetosHub.registrosPorPagina}`;
      Object.entries(filtros).forEach(([key, val]) => {
        if (val) url += `&${key}=${encodeURIComponent(val)}`;
      });

      fetch(url).then(res => res.json()).then(data => {
        ProjetosHub.totalPaginas = data.total_paginas || 1;
        ProjetosHub.dadosCache[ProjetosHub.paginaAtual] = data.dados;
        ProjetosHub.renderizarTabela();
      });
    },

    renderizarTabela: function () {
      const tbody = document.getElementById("ob_listaProjetos");
      tbody.innerHTML = "";

      const dados = ProjetosHub.dadosCache[ProjetosHub.paginaAtual] || [];

      if (dados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4">Nenhum projeto encontrado.</td></tr>`;
        return;
      }

      dados.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${item.id}</td>
          <td>${item.nome}</td>
          <td>${item.status ? "Ativo" : "Inativo"}</td>
          <td>
            <button class="Cl_BtnAcao btnEditar" data-id="${item.id}">${Util.gerarIconeTech('editar')}</button>
            <button class="Cl_BtnAcao btnExcluir" data-id="${item.id}">${Util.gerarIconeTech('excluir')}</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
      lucide.createIcons();
    }
  };

  document.querySelector("#ob_listaProjetos").addEventListener("click", async function (e) {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.dataset.id;

    if (btn.classList.contains("btnEditar")) {
      GlobalUtils.abrirJanelaApoioModal({
        rota: "/projetos/editar",
        id: parseInt(id),
        titulo: "Editar Projeto",
        largura: 600,
        altura: 500,
        nivel: 1
      });
    }

    if (btn.classList.contains("btnExcluir")) {
      const confirma = await Swal.fire({
        title: `Excluir projeto ${id}?`,
        text: "Essa ação não poderá ser desfeita.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sim, excluir',
        cancelButtonText: 'Cancelar'
      });
      if (!confirma.isConfirmed) return;

      try {
        const resp = await fetch(`/projetos/delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id })
        });
        const json = await resp.json();
        if (resp.ok && json.retorno) {
          Swal.fire("Sucesso", json.msg, "success");
          ProjetosHub.carregarDados();
        } else {
          Swal.fire("Erro", json.msg || "Erro ao excluir.", "error");
        }
      } catch (err) {
        Swal.fire("Erro inesperado", err.message, "error");
      }
    }
  });

  window.addEventListener("message", function (event) {
    if (event.data && event.data.grupo === "atualizarTabela") {
      ProjetosHub.carregarDados();
    }
  });

  window.ProjetosHub.configurarEventos();
}
