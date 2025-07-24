// --------------------------------------------------------------------------
// ✅ Shub_departamentos.js carregado
// --------------------------------------------------------------------------
console.log("📘 Shub_departamentos.js carregado");

if (typeof window.DepartamentosHub === "undefined") {
  window.DepartamentosHub = {
    paginaAtual: 1,
    registrosPorPagina: 20,
    totalPaginas: 1,
    dadosCache: {},

    configurarEventos: function () {
      document.querySelector("#ob_btnIncluir").addEventListener("click", () => {
        GlobalUtils.abrirJanelaApoioModal({
          rota: "/departamentos/incluir",
          titulo: "Novo Departamento",
          largura: 600,
          altura: 500,
          nivel: 1
        });
      });

      document.querySelector("#ob_btnFiltrar").addEventListener("click", () => {
        DepartamentosHub.paginaAtual = 1;
        DepartamentosHub.carregarDados();
      });

      document.querySelector("#ob_btnlimparFiltro").addEventListener("click", () => {
        document.getElementById("ob_filtroNome").value = "";
        document.getElementById("ob_filtroStatus").value = "true";
        DepartamentosHub.paginaAtual = 1;
        DepartamentosHub.carregarDados();
      });

      ["ob_btnPrimeiro", "ob_btnAnterior", "ob_btnProximo", "ob_btnUltimo"].forEach(id => {
        document.getElementById(id).addEventListener("click", () => {
          if (id === "ob_btnPrimeiro") DepartamentosHub.paginaAtual = 1;
          else if (id === "ob_btnAnterior" && DepartamentosHub.paginaAtual > 1) DepartamentosHub.paginaAtual--;
          else if (id === "ob_btnProximo" && DepartamentosHub.paginaAtual < DepartamentosHub.totalPaginas) DepartamentosHub.paginaAtual++;
          else if (id === "ob_btnUltimo") DepartamentosHub.paginaAtual = DepartamentosHub.totalPaginas;
          DepartamentosHub.carregarDados();
        });
      });

      DepartamentosHub.carregarDados();
    },

    carregarDados: function () {
      const filtros = {
        nome: document.getElementById("ob_filtroNome").value.trim(),
        status: document.getElementById("ob_filtroStatus").value
      };

      let url = `/departamentos/dados?id_empresa=${App.Varidcliente}&pagina=${DepartamentosHub.paginaAtual}&porPagina=${DepartamentosHub.registrosPorPagina}`;
      Object.entries(filtros).forEach(([key, val]) => {
        if (val) url += `&${key}=${encodeURIComponent(val)}`;
      });

      fetch(url).then(res => res.json()).then(data => {
        DepartamentosHub.totalPaginas = data.total_paginas || 1;
        DepartamentosHub.dadosCache[DepartamentosHub.paginaAtual] = data.dados;
        DepartamentosHub.renderizarTabela();
      });
    },

    renderizarTabela: function () {
      const tbody = document.getElementById("ob_listaDepartamentos");
      tbody.innerHTML = "";

      const dados = DepartamentosHub.dadosCache[DepartamentosHub.paginaAtual] || [];

      if (dados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5">Nenhum departamento encontrado.</td></tr>`;
        return;
      }

      dados.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${item.id}</td>
          <td>${item.nome}</td>
          <td>${item.obs || ""}</td>
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

  // --------------------------------------------------------------------------
  // EVENTOS DELEGADOS: Editar e Excluir
  // --------------------------------------------------------------------------
  document.querySelector("#ob_listaDepartamentos").addEventListener("click", async function (e) {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.dataset.id;

    if (btn.classList.contains("btnEditar")) {
      GlobalUtils.abrirJanelaApoioModal({
        rota: "/departamentos/editar",
        id: parseInt(id),
        titulo: "Editar Departamento",
        largura: 600,
        altura: 500,
        nivel: 1
      });
    }

    if (btn.classList.contains("btnExcluir")) {
      const confirma = await Swal.fire({
        title: `Excluir departamento ${id}?`,
        text: "Essa ação não poderá ser desfeita.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sim, excluir',
        cancelButtonText: 'Cancelar'
      });
      if (!confirma.isConfirmed) return;
      try {
        const resp = await fetch(`/departamentos/delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id })
        });
        const json = await resp.json();
        if (resp.ok && json.retorno) {
          Swal.fire("Sucesso", json.msg, "success");
          DepartamentosHub.carregarDados();
        } else {
          Swal.fire("Erro", json.msg || "Erro ao excluir.", "error");
        }
      } catch (err) {
        Swal.fire("Erro inesperado", err.message, "error");
      }
    }
  });

  // --------------------------------------------------------------------------
  // ESCUTAR MENSAGEM DE APOIO
  // --------------------------------------------------------------------------
  window.addEventListener("message", function (event) {
    if (event.data && event.data.grupo === "atualizarTabela") {
      DepartamentosHub.carregarDados();
    }
  });

  window.DepartamentosHub.configurarEventos();
}
