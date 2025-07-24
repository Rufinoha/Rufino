console.log("✅ Susuario_grupo.js carregado");

if (typeof window.UsuarioGrupo === "undefined") {
  window.UsuarioGrupo = {
    paginaAtual: 1,
    registrosPorPagina: 20,
    totalPaginas: 1,
    dadosCache: {},

    configurarEventos: function () {
      document.querySelector("#ob_btnIncluir").addEventListener("click", () => {
        GlobalUtils.abrirJanelaApoioModal({
          rota: "/usuario/grupo/incluir",
          titulo: "Novo Grupo de Acesso",
          largura: 800,
          altura: 450,
          nivel: 1
        });
      });

      document.querySelector("#ob_btnFiltrar").addEventListener("click", () => {
        UsuarioGrupo.paginaAtual = 1;
        UsuarioGrupo.carregarDados();
      });

      document.querySelector("#ob_btnlimparFiltro").addEventListener("click", () => {
        document.querySelector("#ob_filtroNome").value = "";
        document.querySelector("#ob_filtroAprovador").value = "";
        UsuarioGrupo.paginaAtual = 1;
        UsuarioGrupo.carregarDados();
      });

      ["ob_btnPrimeiro", "ob_btnAnterior", "ob_btnProximo", "ob_btnUltimo"].forEach(id => {
        document.getElementById(id).addEventListener("click", () => {
          if (id === "ob_btnPrimeiro") UsuarioGrupo.paginaAtual = 1;
          else if (id === "ob_btnAnterior" && UsuarioGrupo.paginaAtual > 1) UsuarioGrupo.paginaAtual--;
          else if (id === "ob_btnProximo" && UsuarioGrupo.paginaAtual < UsuarioGrupo.totalPaginas) UsuarioGrupo.paginaAtual++;
          else if (id === "ob_btnUltimo") UsuarioGrupo.paginaAtual = UsuarioGrupo.totalPaginas;

          UsuarioGrupo.carregarDados();
        });
      });

      UsuarioGrupo.carregarDados();
    },

    carregarDados: function () {
      const nome = document.querySelector("#ob_filtroNome").value.trim();
      const aprovador = document.querySelector("#ob_filtroAprovador").value;

      let url = `/usuario/grupo/dados?pagina=${UsuarioGrupo.paginaAtual}&porPagina=${UsuarioGrupo.registrosPorPagina}`;
      if (nome) url += `&nome=${encodeURIComponent(nome)}`;
      if (aprovador !== "") url += `&aprovador=${aprovador}`;



      fetch(url)
        .then(res => res.ok ? res.json() : Promise.reject(res))
        .then(data => {
          UsuarioGrupo.dadosCache[UsuarioGrupo.paginaAtual] = data.dados;
          UsuarioGrupo.totalPaginas = data.total_paginas || 1;
          UsuarioGrupo.renderizarTabela();
        })
        .catch(err => {
          console.error("❌ Erro ao carregar grupos:", err);
          document.querySelector("#ob_listaGrupos").innerHTML = `<tr><td colspan='5'>Erro ao carregar dados.</td></tr>`;
        });
    },

    renderizarTabela: function () {
      const tbody = document.querySelector("#ob_listaGrupos");
      tbody.innerHTML = "";
      const dados = UsuarioGrupo.dadosCache[UsuarioGrupo.paginaAtual];

      if (!dados || dados.length === 0) {
        tbody.innerHTML = `<tr><td colspan='5'>Nenhum grupo encontrado.</td></tr>`;
        return;
      }

      dados.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${item.id}</td>
          <td>${item.nome_grupo}</td>
          <td>${item.descricao || "-"}</td>
          <td>${item.aprovador ? "Sim" : "Não"}</td>
          <td>
            <button class="Cl_BtnAcao btnEditar" data-id="${item.id}">
              ${Util.gerarIconeTech("editar")}
            </button>
            <button class="Cl_BtnAcao btnModulos" data-id="${item.id}">
              ${Util.gerarIconeTech("configuracoes")}
            </button>
            <button class="Cl_BtnAcao btnExcluir" data-id="${item.id}">
              ${Util.gerarIconeTech("excluir")}
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });
      lucide.createIcons();
      UsuarioGrupo.atualizarPaginacao();
    },

    atualizarPaginacao: function () {
      document.querySelector("#ob_paginaAtual").textContent = UsuarioGrupo.paginaAtual;
      document.querySelector("#ob_totalPaginas").textContent = UsuarioGrupo.totalPaginas;
      document.querySelector("#ob_btnPrimeiro").disabled = UsuarioGrupo.paginaAtual === 1;
      document.querySelector("#ob_btnAnterior").disabled = UsuarioGrupo.paginaAtual === 1;
      document.querySelector("#ob_btnProximo").disabled = UsuarioGrupo.paginaAtual === UsuarioGrupo.totalPaginas;
      document.querySelector("#ob_btnUltimo").disabled = UsuarioGrupo.paginaAtual === UsuarioGrupo.totalPaginas;
    }
  };

  // Eventos de Ação (editar, módulos, excluir)
  document.querySelector("#ob_listaGrupos").addEventListener("click", async function (e) {
    const id = e.target.dataset.id;
    if (!id) return;

    if (e.target.classList.contains("btnEditar")) {
      GlobalUtils.abrirJanelaApoioModal({
        rota: "/usuario/grupo/editar",
        id: parseInt(id),
        titulo: "Editar Grupo",
        largura: 800,
        altura: 450,
        nivel: 1
      });
    }

    if (e.target.classList.contains("btnModulos")) {
      GlobalUtils.abrirJanelaApoioModal({
        rota: "/usuario/grupo/editar_modulo",
        id: parseInt(id),
        titulo: "Gerenciar Módulos",
        largura: 900,
        altura: 550,
        nivel: 1
      });
    }

    if (e.target.classList.contains("btnExcluir")) {
      const confirma = await Swal.fire({
        title: `Excluir grupo ${id}?`,
        text: "Essa ação não poderá ser desfeita.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sim, excluir",
        cancelButtonText: "Cancelar"
      });

      if (!confirma.isConfirmed) return;

      try {
        const resp = await fetch(`/usuario/grupo/delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id })
        });

        const json = await resp.json();
        if (resp.ok && json.status === "sucesso") {
          Swal.fire("Sucesso", json.mensagem, "success");
          UsuarioGrupo.carregarDados();
        } else {
          Swal.fire("Erro", json.erro || "Erro ao excluir grupo.", "error");
        }
      } catch (err) {
        Swal.fire("Erro inesperado", err.message, "error");
      }
    }
  });

  // Inicializa
  window.UsuarioGrupo.configurarEventos();
}
