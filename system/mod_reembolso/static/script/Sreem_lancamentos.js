// ✅ Sreem_lancamentos.js carregado
console.log("✅ Sreem_lancamentos.js carregado");

if (typeof window.Lancamentosreembolso === "undefined") {
  window.Lancamentosreembolso = {
    paginaAtual: 1,
    registrosPorPagina: 20,
    totalPaginas: 1,
    dadosCache: {},
    janelareembolsoApoio: null,

    configurarEventos: function () {
      const userGrupo = App.Vargrupo || "";
      const filtroMinhasreembolsoArea = document.querySelector("#filtroMinhasreembolsoArea");
      if (userGrupo.toLowerCase() === "admin") {
        filtroMinhasreembolsoArea.style.display = "block";
      }

      document.querySelector("#btnFiltrar").addEventListener("click", () => {
        this.paginaAtual = 1;
        this.carregarDados();
      });

      document.querySelector("#btnLimparFiltro").addEventListener("click", () => {
        document.querySelector("#filtroDescricao").value = "";
        document.querySelector("#filtroData").value = "";
        Array.from(document.querySelector("#filtroStatus").options).forEach(opt => opt.selected = false);
        document.querySelector("#filtroMinhasreembolso").checked = true;
        this.paginaAtual = 1;
        this.carregarDados();
      });

      document.querySelector("#ob_btnIncluir").addEventListener("click", () => {
        GlobalUtils.abrirJanelaApoioModal({
          rota: "/reembolso/incluir",
          id: null,
          titulo: "Novo Reembolso",
          largura: 1100,
          altura: 700
        });
      });


      ["btnPrimeiro", "btnAnterior", "btnProximo", "btnUltimo"].forEach(id => {
        document.getElementById(id).addEventListener("click", () => {
          if (id === "btnPrimeiro") this.paginaAtual = 1;
          else if (id === "btnAnterior" && this.paginaAtual > 1) this.paginaAtual--;
          else if (id === "btnProximo" && this.paginaAtual < this.totalPaginas) this.paginaAtual++;
          else if (id === "btnUltimo") this.paginaAtual = this.totalPaginas;

          this.carregarDados();
        });
      });


      document.addEventListener("DOMContentLoaded", () => {
        const comboInput = document.getElementById("comboStatusDisplay");
        const selectOriginal = document.getElementById("filtroStatus");

        const selecionados = Array.from(selectOriginal.selectedOptions);

        if (selecionados.length === 1) {
          comboInput.value = selecionados[0].value;
        } else if (selecionados.length > 1) {
          comboInput.value = `Filtros = ${selecionados.length}`;
        } else {
          comboInput.value = "";
        }
      });

      // Preenche o input com o valor inicial baseado nas opções já selecionadas
      const selecionados = Array.from(selectOriginal.selectedOptions);
      if (selecionados.length === 1) {
        comboInput.value = selecionados[0].value;
      } else if (selecionados.length > 1) {
        comboInput.value = `Filtros = ${selecionados.length}`;
      } else {
        comboInput.value = "";
      }


      this.carregarDados();
    },

    carregarDados: function () {
      const descricao = document.querySelector("#filtroDescricao").value.trim();
      const data = document.querySelector("#filtroData").value.trim();
      const statusOptions = Array.from(document.querySelector("#filtroStatus").selectedOptions).map(opt => opt.value);
      const somenteMinhas = document.querySelector("#filtroMinhasreembolso")?.checked;

      let url = `/reembolso/dados?pagina=${this.paginaAtual}&porPagina=${this.registrosPorPagina}`;
      if (descricao) url += `&descricao=${encodeURIComponent(descricao)}`;
      if (data) url += `&data=${data}`;
      if (statusOptions.length) url += `&status=${statusOptions.join(",")}`;
      if (somenteMinhas !== undefined) url += `&somente_minhas=${somenteMinhas}`;

      fetch(url)
        .then(res => res.ok ? res.json() : Promise.reject(res))
        .then(data => {
          this.dadosCache[this.paginaAtual] = data.dados;
          this.totalPaginas = data.total_paginas || 1;
          this.renderizarTabela();
        })
        .catch(err => {
          console.error("❌ Erro ao carregar reembolso:", err);
          document.querySelector("#listareembolso").innerHTML = `<tr><td colspan='7'>Erro ao carregar dados.</td></tr>`;
        });
    },

    renderizarTabela: function () {
      const tbody = document.querySelector("#listareembolso");
      tbody.innerHTML = "";
      const dados = this.dadosCache[this.paginaAtual];

      if (!dados || dados.length === 0) {
        tbody.innerHTML = `<tr><td colspan='7'>Nenhuma reembolso encontrada.</td></tr>`;
        return;
      }

      dados.forEach(item => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.id_reembolso}</td>
        <td>${Util.formatarData(item.data)}</td>
        <td>${item.descricao}</td>
        <td>${item.valor_total ? Util.formatarMoeda(item.valor_total) : '-'}</td>
        <td>${item.status || '-'}</td>
        <td style="text-align:center">${item.qtd_itens || 0}</td>
        <td>
          <button class="Cl_BtnAcao btnEditar" data-id="${item.id_reembolso}" title="Editar">
            ${Util.gerarIconeTech("editar")}
          </button>
          <button class="Cl_BtnAcao btnExcluir" data-id="${item.id_reembolso}" title="Excluir">
            ${Util.gerarIconeTech("excluir")}
          </button>
        </td>

      `;
      tbody.appendChild(tr);
    });

      lucide.createIcons();
      this.atualizarPaginacao();
    },

    atualizarPaginacao: function () {
      document.querySelector("#paginaAtual").textContent = this.paginaAtual;
      document.querySelector("#totalPaginas").textContent = this.totalPaginas;
      document.querySelector("#btnPrimeiro").disabled = this.paginaAtual === 1;
      document.querySelector("#btnAnterior").disabled = this.paginaAtual === 1;
      document.querySelector("#btnProximo").disabled = this.paginaAtual === this.totalPaginas;
      document.querySelector("#btnUltimo").disabled = this.paginaAtual === this.totalPaginas;
    }
  };


  document.querySelector("#listareembolso").addEventListener("click", async function (e) {
    const btnEditar = e.target.closest(".btnEditar");
    const btnExcluir = e.target.closest(".btnExcluir");

    // Botão Editar
    if (btnEditar) {
      const id = btnEditar.dataset.id;
      GlobalUtils.abrirJanelaApoioModal({
        rota: "/reembolso/editar",
        id: id,
        titulo: "Editar Reembolso",
        largura: 1100,
        altura: 700
      });
    }

    // Botão Excluir
    if (btnExcluir) {
      const id = btnExcluir.dataset.id;

      const confirma = await Swal.fire({
        title: `Excluir Reembolso ${id}?`,
        text: "Essa ação não poderá ser desfeita.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sim, excluir',
        cancelButtonText: 'Cancelar'
      });

      if (!confirma.isConfirmed) return;

      try {
        const resp = await fetch(`/reembolso/delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id })
        });

        const json = await resp.json();

        if (resp.ok && json.status === "sucesso") {
          Swal.fire("Sucesso", json.mensagem, "success");
          window.Lancamentosreembolso.carregarDados();
        } else {
          Swal.fire("Erro", json.erro || "Erro ao excluir.", "error");
        }
      } catch (err) {
        Swal.fire("Erro inesperado", err.message, "error");
      }
    }
  });





  const comboInput = document.getElementById("comboStatusDisplay");
  const dropdown = document.getElementById("statusDropdown");
  const btnOK = document.getElementById("btnStatusOK");
  const btnCancel = document.getElementById("btnStatusnoOK");
  const selectOriginal = document.getElementById("filtroStatus");

  // Controle de estado inicial
  let dropdownAberto = false;
  let valoresAntesDoCancel = [];

  // Abrir/fechar ao clicar no input
  comboInput.addEventListener("click", () => {
    dropdownAberto = !dropdownAberto;
    dropdown.style.display = dropdownAberto ? "block" : "none";

    // Salva o estado atual das opções quando abrir
    if (dropdownAberto) {
      valoresAntesDoCancel = Array.from(
        dropdown.querySelectorAll("input[type=checkbox]")
      ).map(chk => chk.checked);
    }
  });

  // Botão OK: aplicar filtros
  btnOK.addEventListener("click", () => {
    const selecionados = [];
    dropdown.querySelectorAll("input[type=checkbox]").forEach((chk, index) => {
      const option = selectOriginal.querySelector(`option[value="${chk.value}"]`);
      if (chk.checked) {
        selecionados.push(chk.value);
        option.selected = true;
      } else {
        option.selected = false;
      }
    });

    comboInput.value =
      selecionados.length === 1
        ? selecionados[0]
        : selecionados.length > 1
        ? `Filtros = ${selecionados.length}`
        : "";

    dropdown.style.display = "none";
    dropdownAberto = false;
  });

  // Botão Cancelar: desfaz alterações e fecha
  btnCancel.addEventListener("click", () => {
    const checkboxes = dropdown.querySelectorAll("input[type=checkbox]");
    checkboxes.forEach((chk, index) => {
      chk.checked = valoresAntesDoCancel[index];
    });

    dropdown.style.display = "none";
    dropdownAberto = false;
  });




  window.Lancamentosreembolso.configurarEventos();
}


window.Lancamentosreembolso.configurarEventos();

window.addEventListener("message", (event) => {
  if (event.data?.grupo === "carregarDados") {
    window.Lancamentosreembolso?.carregarDados?.();

    if (event.data.fecharModal) {
      GlobalUtils.fecharJanelaApoio();
    }
  }
});


