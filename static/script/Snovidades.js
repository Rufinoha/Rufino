if (typeof window.Novidades === "undefined") {
  window.Novidades = {
      paginaAtual: 1,
      registrosPorPagina: 20,
      totalPaginas: 0,
      dadosNovidades: [],
      cachePaginas: {},

      configurarEventos: function () {
          document.querySelector("#ob_btnIncluir").addEventListener("click", () => {
              const largura = 800;
              const altura = 430;
              const esquerda = (screen.width - largura) / 2;
              const topo = (screen.height - altura) / 2;

              window.open("/novidades/incluir", "NovaNovidade",
                  `width=${largura},height=${altura},top=${topo},left=${esquerda},resizable=no`);
          });

          document.querySelector("#ob_btnFiltrar").addEventListener("click", () => {
              Novidades.paginaAtual = 1;
              Novidades.carregarNovidades();
          });

          document.querySelector("#ob_btnlimparFiltro").addEventListener("click", () => {
              document.querySelector("#ob_filtroModulo").value = "";
              document.querySelector("#ob_filtroData").value = "";
              Novidades.paginaAtual = 1;
              Novidades.carregarNovidades();
          });

          Novidades.carregarNovidades();
      },

      carregarNovidades: function () {
          const modulo = document.querySelector("#ob_filtroModulo").value.trim();
          const emissao = document.querySelector("#ob_filtroData").value;

          let url = `/novidades/dados?pagina=${this.paginaAtual}&porPagina=${this.registrosPorPagina}`;
          if (modulo) url += `&modulo=${encodeURIComponent(modulo)}`;
          if (emissao) url += `&emissao=${encodeURIComponent(emissao)}`;

          fetch(url)
              .then(resp => resp.json())
              .then(data => {
                  this.dadosNovidades = data.dados || [];
                  this.totalPaginas = data.total_paginas || 1;
                  this.cachePaginas[this.paginaAtual] = [...this.dadosNovidades];
                  this.renderizarTabela();
              })
              .catch(erro => {
                  console.error("Erro ao carregar novidades:", erro);
                  document.querySelector("#ob_listaNovidades").innerHTML = `<tr><td colspan='6'>Erro ao carregar novidades</td></tr>`;
              });
      },

      renderizarTabela: function () {
          const tabela = document.querySelector("#ob_listaNovidades");
          tabela.innerHTML = "";
          const dados = this.cachePaginas[this.paginaAtual] || [];

          if (!dados.length) {
              tabela.innerHTML = `<tr><td colspan='6'>Nenhuma novidade encontrada.</td></tr>`;
              return;
          }

          dados.forEach(n => {
              const linha = document.createElement("tr");
              linha.innerHTML = `
                  <td>${n.id}</td>
                  <td>${window.Util.formatarData(n.emissao)}</td>
                  <td>${n.modulo}</td>
                  <td>${n.descricao}</td>
                  <td>${n.link ? `<a href='${n.link}' target='_blank'>Link</a>` : "-"}</td>
                  <td>
                      <button class="Cl_BtnAcao btnEditar" data-id="${n.id}">✏️</button>
                      <button class="Cl_BtnAcao btnExcluir" data-id="${n.id}">🗑️</button>
                  </td>
              `;
              tabela.appendChild(linha);
          });

          this.adicionarListeners();
      },

      adicionarListeners: function () {
          document.querySelectorAll(".btnEditar").forEach(btn => {
              btn.addEventListener("click", e => {
                  const id = e.currentTarget.getAttribute("data-id");
                  const largura = 800;
                  const altura = 430;
                  const esquerda = (screen.width - largura) / 2;
                  const topo = (screen.height - altura) / 2;
                  const janela = window.open("/novidades/editar", "EditarNovidade",
                      `width=${largura},height=${altura},top=${topo},left=${esquerda},resizable=no`);

                  window.addEventListener("message", function listener(ev) {
                      if (ev.data?.grupo === "apoioPronto") {
                          const dados = Novidades.dadosNovidades.find(n => n.id == id);
                          janela.postMessage({ grupo: "dadosNovidade", payload: dados }, "*");
                          window.removeEventListener("message", listener);
                      }
                  });
              });
          });

          document.querySelectorAll(".btnExcluir").forEach(btn => {
              btn.addEventListener("click", async e => {
                  const id = e.currentTarget.getAttribute("data-id");

                  const confirmacao = await Swal.fire({
                      title: "Excluir?",
                      text: "Deseja realmente excluir esta novidade?",
                      icon: "warning",
                      showCancelButton: true,
                      confirmButtonText: "Sim",
                      cancelButtonText: "Não"
                  });

                  if (!confirmacao.isConfirmed) return;

                  const resp = await fetch("/novidades/delete", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id })
                  });

                  const resultado = await resp.json();

                  if (resp.ok) {
                      Swal.fire("Sucesso", resultado.mensagem, "success");
                      Novidades.carregarNovidades();
                  } else {
                      Swal.fire("Erro", resultado.mensagem || "Erro ao excluir.", "error");
                  }
              });
          });
      }
  };
} else {
  console.warn("⚠️ A variável Novidades já está declarada.");
}

// Inicializar eventos
if (window.Novidades?.configurarEventos) {
  window.Novidades.configurarEventos();
}

// Botão Voltar (modelo oficial igual ao Usuário)
if (document.getElementById("ob_btnVoltar")) {
  document.getElementById("ob_btnVoltar").addEventListener("click", () => {
      carregarPagina("configuracoes"); // Chamando o painel de configurações
  });

  window.Util?.removerCSSAtual("frm_novidades.html"); // Se precisar remover o CSS antigo
}
