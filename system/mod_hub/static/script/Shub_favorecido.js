// ✅ Shub_favorecido.js (IDs alinhados ao HTML)
console.log("Shub_favorecido.js carregado");

// Registra na mesma chave o mount/unmount criado pelo carregador Global de HTML que esta no global
(function (s) {
const pageKey = s.getAttribute('data-page-script'); 

async function mount(root, ctx, scope) {
    // sua lógica (se quiser, pode continuar rodando código no topo do arquivo;
    // o Global já captura e vai limpar tudo ao sair)
}

function unmount() {
    // opcional — o Global já limpa eventos/timers/fetch/observers/Chart
}

GlobalUtils.registerPage(pageKey, { mount, unmount });
})(document.currentScript);

var FavorecidoHub = window.FavorecidoHub || {
  __started: false,
  paginaAtual: 1,
  registrosPorPagina: 20,
  totalPaginas: 1,
  dadosCache: {},
  el: {},

  

  req(sel, nome) {
    const el = document.querySelector(sel);
    if (!el) throw new Error(`Elemento obrigatório não encontrado: ${nome} (${sel})`);
    return el;
  },

  start() {
    // raiz única da tela
    const root = document.querySelector(".Cl_ConfigContainer");
    if (!root) throw new Error("Root da tela ('.Cl_ConfigContainer') não encontrado.");

    // se já estou montado no MESMO root: apenas recarrega dados
    if (this._rootEl === root) {
      this.carregarDados();
      return;
    }

    // (re)montagem: novo root => re-hidrata todos os elementos
    this._rootEl = root;
    this.el = {}; // zera referências antigas

    this.el.btnFiltrar        = this.req("#ob_btnFiltrar",        "Botão Filtrar");
    this.el.btnLimpar         = this.req("#ob_btnlimpar",         "Botão Limpar Filtro");
    this.el.btnIncluir        = this.req("#ob_btnIncluir",        "Botão Novo Favorecido");

    this.el.filtroDocumento   = this.req("#ob_filtroDocumento",   "Filtro Documento");
    this.el.filtroFavorecido  = this.req("#ob_filtroFavorecido",  "Filtro Favorecido");
    this.el.filtroCategoria   = this.req("#ob_filtroCategoria",   "Filtro Categoria");
    this.el.filtroStatus      = this.req("#ob_filtroStatus",      "Filtro Status");

    this.el.tbody             = this.req("#ob_listaFavorecidos",  "Tabela Favorecidos");

    this.el.pgPrimeiro        = this.req("#ob_btnPrimeiro",       "Paginação Primeiro");
    this.el.pgAnterior        = this.req("#ob_btnAnterior",       "Paginação Anterior");
    this.el.pgProximo         = this.req("#ob_btnProximo",        "Paginação Próximo");
    this.el.pgUltimo          = this.req("#ob_btnUltimo",         "Paginação Último");
    this.el.lblPagAtual       = this.req("#ob_paginaAtual",       "Label Página Atual");
    this.el.lblTotalPags      = this.req("#ob_totalPaginas",      "Label Total Páginas");

    // binds sempre nos NOVOS elementos
    this.binds();

    // carrega combos e dados (evita duplicar opções)
    this.carregarCategoriasFiltro();
    this.paginaAtual = 1;
    this.carregarDados();

    // listener global de retorno do modal (registra só 1x)
    if (!this._messageBound) {
      window.addEventListener("message", (ev) => {
        if (ev.data?.grupo === "atualizarTabela") {
          this.paginaAtual = 1;
          this.carregarDados();
        }
      });
      this._messageBound = true;
    }
  },


  binds() {
    this.el.btnIncluir.addEventListener("click", () => {
      GlobalUtils.abrirJanelaApoioModal({
        rota: '/favorecido/incluir',
        titulo: 'Novo Favorecido',
        largura: 950,
        altura: 800,
        nivel: 1
      });
    });

    this.el.btnFiltrar.addEventListener("click", () => {
      this.paginaAtual = 1;
      this.carregarDados();
    });

    this.el.btnLimpar.addEventListener("click", () => {
      this.el.filtroDocumento.value  = "";
      this.el.filtroFavorecido.value = "";
      this.el.filtroCategoria.value  = "";
      this.el.filtroStatus.value     = "A"; // padrão Ativo
      this.paginaAtual = 1;
      this.carregarDados();
    });

    [["pgPrimeiro",1],["pgAnterior","-1"],["pgProximo","+1"],["pgUltimo","last"]]
      .forEach(([k, op]) => {
        this.el[k].addEventListener("click", () => {
          if (op===1) this.paginaAtual = 1;
          else if (op==="last") this.paginaAtual = this.totalPaginas;
          else if (op==="+1" && this.paginaAtual < this.totalPaginas) this.paginaAtual++;
          else if (op==="-1" && this.paginaAtual > 1) this.paginaAtual--;
          this.carregarDados();
        });
      });
  },

  async carregarCategoriasFiltro() {
    const sel = this.el.filtroCategoria;
    try {
      // remove tudo menos "Todos"
      sel.querySelectorAll("option:not([value=''])").forEach(o => o.remove());

      const resp = await fetch("/combobox/categorias?limite=500");
      const lista = await resp.json();
      (lista || [])
        .map(c => ({ id: String(c.id ?? c.value ?? c.ID), nome: String(c.nome ?? c.nome_categoria ?? c.text ?? "") }))
        .sort((a,b) => a.nome.localeCompare(b.nome,"pt-BR"))
        .forEach(c => {
          const op = document.createElement("option");
          op.value = c.id;
          op.textContent = c.nome;
          sel.appendChild(op);
        });
    } catch (e) {
      console.error("Erro ao carregar categorias do filtro:", e);
    }
  },


  carregarDados() {
    const documento  = this.el.filtroDocumento.value.trim();
    const favorecido = this.el.filtroFavorecido.value.trim();
    const categoria  = this.el.filtroCategoria.value.trim();
    const statusSel  = this.el.filtroStatus.value; // 'A' | 'I' | ''

    // mapeia para backend (true/false) somente se houver filtro
    const statusParam = statusSel === "A" ? "true" : (statusSel === "I" ? "false" : "");

    let url = `/favorecido/dados?pagina=${this.paginaAtual}&porPagina=${this.registrosPorPagina}`;
    if (documento)  url += `&documento=${encodeURIComponent(documento)}`;
    if (favorecido) url += `&razao_social=${encodeURIComponent(favorecido)}`;
    if (categoria)  url += `&id_categoria=${encodeURIComponent(categoria)}`;
    if (statusParam) url += `&status=${statusParam}`;

    fetch(url)
      .then(res => res.ok ? res.json() : Promise.reject(res))
      .then(data => {
        this.dadosCache[this.paginaAtual] = data.dados || [];
        this.totalPaginas = data.total_paginas || 1;
        this.render();
      })
      .catch(err => {
        console.error("Erro ao carregar favorecidos:", err);
        this.el.tbody.innerHTML = `<tr><td colspan="7">Erro ao carregar dados.</td></tr>`;
      });
  },

  render() {
    const dados = this.dadosCache[this.paginaAtual] || [];
    const tbody = this.el.tbody;
    tbody.innerHTML = "";

    if (!dados.length) {
      tbody.innerHTML = `<tr><td colspan="7">Nenhum favorecido encontrado.</td></tr>`;
    } else {
      dados.forEach(item => {
        const cidadeUf = item.cidade ? `${item.cidade} - ${item.uf || ""}` : "-";
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
          </td>`;
        tbody.appendChild(tr);
      });
      lucide.createIcons();
    }

    // paginação
    this.el.lblPagAtual.textContent = this.paginaAtual;
    this.el.lblTotalPags.textContent = this.totalPaginas;
    this.el.pgPrimeiro.disabled = this.paginaAtual === 1;
    this.el.pgAnterior.disabled = this.paginaAtual === 1;
    this.el.pgProximo.disabled  = this.paginaAtual === this.totalPaginas;
    this.el.pgUltimo.disabled   = this.paginaAtual === this.totalPaginas;

    // delegação ações (editar/excluir)
    tbody.onclick = async (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const id = btn.dataset.id;
      if (!id) return;

      if (btn.classList.contains("btnEditar")) {
        GlobalUtils.abrirJanelaApoioModal({
          rota: `/favorecido/editar?id=${id}`,
          id,
          titulo: 'Editar Favorecido',
          largura: 950,
          altura: 800,
          nivel: 1
        });
        return;
      }

      if (btn.classList.contains("btnExcluir")) {
        const confirma = await Swal.fire({
          title: `Excluir favorecido ${id}?`,
          text: "Essa ação não poderá ser desfeita.",
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "Sim, excluir",
          cancelButtonText: "Cancelar"
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
            Swal.fire("Sucesso", json.mensagem || "Excluído!", "success");
            this.carregarDados();
          } else {
            Swal.fire("Erro", json.erro || "Erro ao excluir.", "error");
          }
        } catch (err) {
          Swal.fire("Erro inesperado", err.message, "error");
        }
      }
    };
  }
};

window.FavorecidoHub = FavorecidoHub;

// start pós-DOM (se já iniciou, o próprio start ignora)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => FavorecidoHub.start());
} else {
  FavorecidoHub.start();
}
