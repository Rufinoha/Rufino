console.log("📘 Sreem_lancamentos.js carregado");

if (typeof window.ReemLancHub === "undefined") {
  window.ReemLancHub = {
    paginaAtual: 1,
    registrosPorPagina: 20,
    totalPaginas: 1,
    cache: {},
    // 🔴 padrão: true (oculto para usuários comuns)
    somenteMinhas: true,
    podeVerToggle: false,

    configurarEventos: function () {
      // incluir, filtrar, limpar (iguais aos seus)
      document.querySelector("#ob_btnIncluir").addEventListener("click", () => {
        GlobalUtils.abrirJanelaApoioModal({
          rota: "/reembolso/lanc/incluir",
          titulo: "Novo Reembolso",
          largura: 900,
          altura: 620,
          nivel: 1
        });
      });

      document.querySelector("#ob_btnFiltrar").addEventListener("click", () => {
        ReemLancHub.paginaAtual = 1;
        ReemLancHub.carregar();
      });

      document.querySelector("#ob_btnlimparFiltro").addEventListener("click", () => {
        document.getElementById("ob_filtroDescricao").value = "";
        document.getElementById("ob_filtroData").value = "";
        document.querySelectorAll("#ob_painelStatus input[type='checkbox']").forEach((cb, i) => {
          cb.checked = (i < 5);
        });
        ReemLancHub._atualizarResumoStatus();
        ReemLancHub.paginaAtual = 1;
        // não mexe no toggle aqui — deixa como está
        ReemLancHub.carregar();
      });

      // dropdown de status, paginação… (mantém igual aos seus)
      // ...

      // 🔘 inicializa o toggle conforme a permissão do usuário
      ReemLancHub._bootstrapSomenteMinhasToggle()
        .finally(() => {
          ReemLancHub._atualizarResumoStatus();
          ReemLancHub.carregar();
        });
    },

    // ──────────────────────────────────────────────────────────
    // Permissão: só dev/adm vê o toggle. Demais: oculto=true
    // ──────────────────────────────────────────────────────────
    _bootstrapSomenteMinhasToggle: async function () {
      try {
        const id_usuario = window.Util.localstorage("id_usuario", null);
        if (!id_usuario) {
          console.warn("⚠️ id_usuario não encontrado no localStorage. Toggle ficará oculto (true).");
          return;
        }

        const r = await fetch(`/reembolso/lanc/flags?id_usuario=${encodeURIComponent(id_usuario)}`, {
          credentials: "include",
          headers: { "Accept": "application/json" }
        });
        const j = await r.json().catch(() => ({}));

        const dev  = !!j.is_developer;
        const adm  = !!j.is_administrator;
        ReemLancHub.podeVerToggle = (dev || adm);

        const wrap = document.getElementById("ob_wrapSomenteMinhas");
        const chk  = document.getElementById("ob_toggleSomenteMinhas");

        if (ReemLancHub.podeVerToggle && wrap && chk) {
          wrap.style.display = "flex";
          chk.checked = true;                  // padrão true
          ReemLancHub.somenteMinhas = true;

          chk.addEventListener("change", () => {
            ReemLancHub.somenteMinhas = !!chk.checked;
            ReemLancHub.paginaAtual = 1;
            ReemLancHub.carregar();
          });
        } else {
          // Usuário comum: mantém oculto+true
          if (wrap) wrap.style.display = "none";
          ReemLancHub.somenteMinhas = true;
        }
      } catch (e) {
        console.error("Erro ao checar flags do usuário:", e);
        // fallback seguro
        ReemLancHub.somenteMinhas = true;
      }
    },

    _selecoesStatus: function () {
      const vals = [];
      document.querySelectorAll("#ob_painelStatus input[type='checkbox']").forEach(cb => {
        if (cb.checked) vals.push(cb.value);
      });
      return vals;
    },

    _atualizarResumoStatus: function () {
        const n = ReemLancHub._selecoesStatus().length;
        const btn = document.querySelector("#ob_btnStatus");
        // Nada de innerHTML com <span>; o chevron vira CSS ::after (abaixo)
        btn.textContent = `Filtros = ${n}`;
    },


    _qs: function () {
      const desc = encodeURIComponent(document.getElementById("ob_filtroDescricao").value || "");
      const data = encodeURIComponent(document.getElementById("ob_filtroData").value || "");
      const st   = encodeURIComponent(ReemLancHub._selecoesStatus().join(","));
      const pag  = encodeURIComponent(ReemLancHub.paginaAtual);
      const qtd  = encodeURIComponent(ReemLancHub.registrosPorPagina);
      const minhas = ReemLancHub.somenteMinhas ? "true" : "false"; // 🔘 novo

      return `descricao=${desc}&data=${data}&status=${st}&pagina=${pag}&qtd=${qtd}&somente_minhas=${minhas}`;
    },

    carregar: async function () {
      const tbody = document.getElementById("ob_listaLanc");
      tbody.innerHTML = `<tr class="Cl_Carregando"><td colspan="7">Carregando...</td></tr>`;

      try {
        const resp = await fetch(`/reembolso/lanc/dados?${ReemLancHub._qs()}`, {
          credentials: "include",
          headers: { "Accept": "application/json" }
        });

        const raw = await resp.text();
        let j = null;
        try { j = raw ? JSON.parse(raw) : null; }
        catch (e) {
          console.error("Resposta não-JSON do servidor:", raw);
          throw new Error("RESPOSTA_NAO_JSON");
        }

        if (!resp.ok) {
          const msg = (j && j.erro) ? j.erro : "Falha ao carregar";
          throw new Error(msg);
        }

        ReemLancHub.paginaAtual  = j.pagina || 1;
        ReemLancHub.totalPaginas = j.total_paginas || 1;

        document.getElementById("ob_paginaAtual").textContent  = ReemLancHub.paginaAtual;
        document.getElementById("ob_totalPaginas").textContent = ReemLancHub.totalPaginas;
        ReemLancHub._atualizarPaginacao();

        const itens = Array.isArray(j.itens) ? j.itens : [];
        if (!itens.length) {
          tbody.innerHTML = `<tr><td colspan="7">Nenhum reembolso encontrado.</td></tr>`;
          return;
        }

        tbody.innerHTML = "";
        itens.forEach((it) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${it.id}</td>
            <td>${it.data || ""}</td>
            <td>${ReemLancHub._safe(it.descricao)}</td>
            <td>${ReemLancHub._safe(it.valor_total_fmt || "R$ 0,00")}</td>
            <td>${ReemLancHub._badge(it.status)}</td>
            <td>${Number(it.notas_qtde || 0)}</td>
            <td>
              <button class="icon-tech btnEditar"  title="Editar"  data-id="${it.id}"><i data-lucide="pencil"></i></button>
              <button class="icon-tech btnExcluir" title="Excluir" data-id="${it.id}"><i data-lucide="trash-2"></i></button>
              <button class="icon-tech btnStatus"  title="Status"  data-id="${it.id}"><i data-lucide="list-checks"></i></button>
              <button class="icon-tech btnNotas"   title="Notas"   data-id="${it.id}"><i data-lucide="file-text"></i></button>
            </td>`;
          tbody.appendChild(tr);
        });

        lucide.createIcons();
        ReemLancHub._bindAcoes();

      } catch (e) {
        console.error(e);
        Swal.fire("Erro", e.message || "Não foi possível carregar os lançamentos.", "error");
      }
    },


        _bindAcoes: function () {
            const tbody = document.getElementById("ob_listaLanc");

            tbody.querySelectorAll(".btnEditar").forEach((btn) => {
                btn.addEventListener("click", () => {
                    const id = Number(btn.dataset.id);
                    GlobalUtils.abrirJanelaApoioModal({
                        rota: "/reembolso/lanc/editar",
                        id,
                        titulo: "Editar Reembolso",
                        largura: 900,
                        altura: 620,
                        nivel: 1
                    });
                });
            });

            tbody.querySelectorAll(".btnExcluir").forEach((btn) => {
                btn.addEventListener("click", async () => {
                    const id = Number(btn.dataset.id);
                    const ok = await Swal.fire({
                        title: "Confirmar exclusão?",
                        text: `Reembolso #${id}`,
                        icon: "warning",
                        showCancelButton: true,
                        confirmButtonText: "Sim, excluir",
                        cancelButtonText: "Cancelar"
                    }).then(r => r.isConfirmed);
                    if (!ok) return;

                    const r = await fetch(`/reembolso/lanc/delete`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({ id })
                    });
                    const j = await r.json().catch(() => ({}));
                    if (r.ok) {
                        Swal.fire("Sucesso", "Excluído.", "success");
                        ReemLancHub.carregar();
                    } else {
                        Swal.fire("Erro", j.erro || "Falha ao excluir.", "error");
                    }
                });
            });

            tbody.querySelectorAll(".btnStatus").forEach((btn) => {
                btn.addEventListener("click", () => {
                    const id = Number(btn.dataset.id);
                    GlobalUtils.abrirJanelaApoioModal({
                        rota: "/reembolso/lanc/status",
                        id,
                        titulo: "Acompanhamento / Aprovação",
                        largura: 900,
                        altura: 620,
                        nivel: 1
                    });
                });
            });

            tbody.querySelectorAll(".btnNotas").forEach((btn) => {
                btn.addEventListener("click", () => {
                    const id = Number(btn.dataset.id);
                    GlobalUtils.abrirJanelaApoioModal({
                        rota: "/reembolso/lanc/notas",
                        id,
                        titulo: "Notas do Reembolso",
                        largura: 900,
                        altura: 620,
                        nivel: 1
                    });
                });
            });
        },

        _atualizarPaginacao: function () {
            document.getElementById("ob_btnPrimeiro").disabled = (this.paginaAtual === 1);
            document.getElementById("ob_btnAnterior").disabled = (this.paginaAtual === 1);
            document.getElementById("ob_btnProximo").disabled  = (this.paginaAtual === this.totalPaginas);
            document.getElementById("ob_btnUltimo").disabled   = (this.paginaAtual === this.totalPaginas);
        },

        _badge: function (status) {
            const s = (status || "").toUpperCase();
            if (s === "ABERTO")     return `<span class="Cl_Badge Cl_Badge--aberto">Aberto</span>`;
            if (s === "RETORNADO")  return `<span class="Cl_Badge Cl_Badge--retornado">Retornado</span>`;
            if (s === "REJEITADO")  return `<span class="Cl_Badge Cl_Badge--rejeitado">Rejeitado</span>`;
            if (s === "APROVADO")   return `<span class="Cl_Badge Cl_Badge--aprovado">Aprovado</span>`;
            if (s === "FINALIZADO") return `<span class="Cl_Badge Cl_Badge--finalizado">Finalizado</span>`;
            return `<span class="Cl_Badge">-</span>`;
        },

        _safe: function (v) {
            return (v === null || v === undefined) ? "" : String(v);
        }
    };

    // bootstrap
    (function bootstrapReemLancHub(){
        const start = () => ReemLancHub.configurarEventos();
        if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, { once: true });
        } else { start(); }
    })();

}
