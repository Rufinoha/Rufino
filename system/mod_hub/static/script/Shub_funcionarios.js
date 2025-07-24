console.log("📌 Shub_funcionarios.js carregado");

if (typeof window.FuncionariosHub === "undefined") {
  window.FuncionariosHub = {
    paginaAtual: 1,
    registrosPorPagina: 20,
    totalPaginas: 1,
    dadosCache: {},

    configurarEventos: function () {
      document.getElementById("ob_btnIncluir").addEventListener("click", () => {
        GlobalUtils.abrirJanelaApoioModal({
          rota: '/funcionarios/incluir',
          titulo: 'Novo Funcionário',
          largura: 800,
          altura: 750
        });
      });

      document.getElementById("ob_btnFiltrar").addEventListener("click", () => {
        FuncionariosHub.paginaAtual = 1;
        FuncionariosHub.carregarDados();
      });

      document.getElementById("ob_btnlimparFiltro").addEventListener("click", () => {
        ["ob_filtroNome", "ob_filtroDepartamento", "ob_filtroFuncao"].forEach(id => document.getElementById(id).value = "");
        document.getElementById("ob_filtroStatus").value = "true";
        FuncionariosHub.paginaAtual = 1;
        FuncionariosHub.carregarDados();
      });

      ["ob_btnPrimeiro", "ob_btnAnterior", "ob_btnProximo", "ob_btnUltimo"].forEach(id => {
        document.getElementById(id).addEventListener("click", () => {
          if (id === "ob_btnPrimeiro") FuncionariosHub.paginaAtual = 1;
          else if (id === "ob_btnAnterior" && FuncionariosHub.paginaAtual > 1) FuncionariosHub.paginaAtual--;
          else if (id === "ob_btnProximo" && FuncionariosHub.paginaAtual < FuncionariosHub.totalPaginas) FuncionariosHub.paginaAtual++;
          else if (id === "ob_btnUltimo") FuncionariosHub.paginaAtual = FuncionariosHub.totalPaginas;
          FuncionariosHub.carregarDados();
        });
      });

      FuncionariosHub.carregarDados();
    },

    carregarDados: function () {
      const filtros = {
        nome: document.getElementById("ob_filtroNome").value.trim(),
        departamento: document.getElementById("ob_filtroDepartamento").value.trim(),
        funcao: document.getElementById("ob_filtroFuncao").value.trim(),
        status: document.getElementById("ob_filtroStatus").value
      };

      let url = `/funcionarios/dados?id_empresa=${App.Varidcliente}&pagina=${FuncionariosHub.paginaAtual}&porPagina=${FuncionariosHub.registrosPorPagina}`;
      Object.entries(filtros).forEach(([key, val]) => {
        if (val) url += `&${key}=${encodeURIComponent(val)}`;
      });

      fetch(url).then(res => res.json()).then(data => {
        FuncionariosHub.totalPaginas = data.total_paginas || 1;
        FuncionariosHub.dadosCache[FuncionariosHub.paginaAtual] = data.dados;
        FuncionariosHub.renderizarTabela();
      });
    },

    renderizarTabela: function () {
      const tbody = document.getElementById("ob_listaFuncionarios");
      tbody.innerHTML = "";

      const dados = FuncionariosHub.dadosCache[FuncionariosHub.paginaAtual] || [];

      if (dados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9">Nenhum funcionário encontrado.</td></tr>`;
        return;
      }

      dados.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${item.id}</td>
          <td>${item.documento}</td>
          <td>${item.nome}</td>
          <td>${item.departamento || "-"}</td>
          <td>${item.funcao || "-"}</td>
          <td>${item.email || "-"}</td>
          <td>${item.telefone || "-"}</td>
          <td>${item.status ? "Ativo" : "Inativo"}</td>
          <td>
            <button class="Cl_BtnAcao btnEditar" data-id="${item.id}">${Util.gerarIconeTech('editar')}</button>
            <button type="button" class="Cl_BtnAcao btnExcluir" data-id="${item.id}" title="Excluir">${Util.gerarIconeTech('excluir')}
          </td>
        `;
        tbody.appendChild(tr);
        lucide.createIcons();
      });
    }
  };

  window.FuncionariosHub.configurarEventos();
}
window.addEventListener("message", function(event) {
  if (event.data && event.data.grupo === "atualizarTabela") {
    window.LivroDiarioHub?.configurarEventos?.();
  }
});
