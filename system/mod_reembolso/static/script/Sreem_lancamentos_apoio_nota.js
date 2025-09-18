// =============================== Sreem_lancamentos_apoio_nota.js ===============================
console.log("📘 Sreem_lancamentos_apoio_nota.js carregado");

(function () {
  "use strict";

  // ---------------------------------------------------------------------------------------------
  // REGRAS GERAIS / CONSTANTES
  // ---------------------------------------------------------------------------------------------
  const NIVEL_PADRAO = 2;
  let NIVEL_MODAL = NIVEL_PADRAO;

  let ID_NOTA = null;       // id da tbl_reem_lancamento_nota (edição)
  let ID_REEMBOLSO = null;  // id da tbl_reem_lancamento (pai), usado só para inclusão

  // Cache de elementos
  const DOM = {};

  // Utils mínimos (no padrão TECH)
  const U = {
    idEmpresa() {
      try { return window.Util?.localstorage?.("id_empresa") ?? null; } catch { return null; }
    },
    assertEmpresa() {
      const ok = !!U.idEmpresa();
      if (!ok) Swal.fire("Sessão inválida", "Empresa ativa não identificada.", "warning");
      return ok;
    },
    setIdVisual(id) {
      DOM.campoExibicaoId.value = id ? String(id) : "NOVO";
      DOM.hidIdNota.value = id ?? "";
    },
    toUpperInput(el) {
      if (!el) return;
      el.addEventListener("input", () => { el.value = (el.value || "").toUpperCase(); });
    },
    validarCampos() {
      const faltando = [];
      if (!DOM.data.value) faltando.push("Data da Nota");
      if (!DOM.descricao.value.trim()) faltando.push("Descrição");
      if (!DOM.documento.value.trim()) faltando.push("Nº Documento");
      if (!DOM.valor.value || Number(DOM.valor.value) <= 0) faltando.push("Valor");
      if (!DOM.idCategoria.value) faltando.push("Categoria");
      if (!DOM.formaPagamento.value) faltando.push("Forma de Pagamento");
      if (faltando.length) {
        Swal.fire("Campos obrigatórios", `Preencha: ${faltando.join(", ")}`, "warning");
        return false;
      }
      return true;
    },
    refreshNivel1EFechar() {
      const p = window.parent;
      const fn = p?.ReemLancHub?.carregar || p?.ReemLancHub?.recarregar || p?.ReemLancApoio?.carregar || null;
      try { if (typeof fn === "function") fn.call(p.ReemLancHub || p.ReemLancApoio); } catch {}
      try { p?.postMessage?.({ origem: "apoio-nota", acao: "refresh-nivel1" }, "*"); } catch {}
      window.GlobalUtils?.fecharJanelaApoio?.(NIVEL_MODAL || NIVEL_PADRAO);
    }
  };

  // =============================================================================================
  // ║BLOCO 1 - RECEBENDO DADOS DO PRINCIPAL (postMessage)
  //   Regras:
  //   - Se vier com id  -> EDIÇÃO da NOTA (tbl_reem_lancamento_nota)
  //   - Se vier sem id  -> INCLUSÃO (ID_NOTA=null); usa id_reembolso somente se vier em extras
  // =============================================================================================
  function configurarRecebimentoDoPrincipal() {
    if (window.GlobalUtils?.receberDadosApoio) {
      window.GlobalUtils.receberDadosApoio(async function (id, nivel, extras) {
        NIVEL_MODAL = nivel || NIVEL_PADRAO;

        // id recebido SEMPRE é tratado como id da NOTA
        ID_NOTA = id || null;

        // id do reembolso só vem via extras (ou ficará no hidden se o principal já preencher)
        ID_REEMBOLSO = extras?.id_reembolso ?? null;
        if (ID_REEMBOLSO) DOM.hidIdReembolso.value = ID_REEMBOLSO;

        U.setIdVisual(ID_NOTA);

        if (ID_NOTA) {
          await carregarRegistro(ID_NOTA); // edição
        } else {
          limparFormulario();              // inclusão
        }
      });
    } else {
      // Sem mensagem do principal -> inclusão
      U.setIdVisual(null);
      limparFormulario();
    }
  }

  // =============================================================================================
  // ║BLOCO 2 - EVENTOS DOS BOTÕES PRINCIPAIS
  // =============================================================================================
  async function onSalvar() {
    if (!U.assertEmpresa()) return;
    if (!U.validarCampos()) return;

    try {
      const idEmpresa = U.idEmpresa();
      const fd = new FormData();

      // Identificadores
      fd.append("id_empresa", idEmpresa);
      if (ID_NOTA) fd.append("id_nota", ID_NOTA);

      // id_reembolso pode vir do extras ou já estar no hidden (preenchido pelo principal)
      const idReem = ID_REEMBOLSO || DOM.hidIdReembolso.value || "";
      if (!ID_NOTA) fd.append("id_reembolso", idReem); // obrigatório só na inclusão

      // Campos principais
      fd.append("data", DOM.data.value);
      fd.append("descricao", DOM.descricao.value.trim());
      fd.append("documento", DOM.documento.value.trim());
      fd.append("valor", DOM.valor.value);
      fd.append("id_categoria", DOM.idCategoria.value);
      fd.append("forma_pagamento", DOM.formaPagamento.value);
      fd.append("cidade", DOM.cidade.value.trim());
      fd.append("uf", (DOM.uf.value || "").toUpperCase());

      // Emitente
      fd.append("cnpj_emitente", DOM.cnpjEmitente.value.trim());
      fd.append("razao_social_emitente", DOM.razaoEmitente.value.trim());

      // Outros
      fd.append("tipo_documento", DOM.tipoDocumento.value.trim());
      fd.append("chave_nfe", DOM.chaveNfe.value.trim());

      // Anexo opcional
      const file = DOM.anexo.files?.[0] || null;
      if (file) fd.append("anexo", file);

      const resp = await fetch("/reembolso/nota/salvar", { method: "POST", body: fd });
      const isJson = (resp.headers.get("content-type") || "").includes("application/json");
      const js = isJson ? await resp.json() : {};
      if (!resp.ok) throw new Error(js?.erro || `Falha ao salvar (HTTP ${resp.status})`);

      Swal.fire("Sucesso", "Nota salva com sucesso!", "success").then(U.refreshNivel1EFechar);
    } catch (e) {
      console.error(e);
      Swal.fire("Erro", e.message || "Não foi possível salvar a nota.", "error");
    }
  }

  async function onExcluir() {
    if (!ID_NOTA) return Swal.fire("Atenção", "Este registro ainda não foi salvo.", "info");

    if (!U.assertEmpresa()) return;
    const ok = await Swal.fire({
      title: "Excluir nota?",
      text: "Esta ação não poderá ser desfeita.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sim, excluir",
      cancelButtonText: "Cancelar",
    });
    if (!ok.isConfirmed) return;

    try {
      const idEmp = U.idEmpresa();
      const resp = await fetch(`/reembolso/nota/excluir/${ID_NOTA}?id_empresa=${encodeURIComponent(idEmp)}`, {
        method: "DELETE",
      });
      const isJson = (resp.headers.get("content-type") || "").includes("application/json");
      const js = isJson ? await resp.json() : {};
      if (!resp.ok) throw new Error(js?.erro || `Falha ao excluir (HTTP ${resp.status})`);

      Swal.fire("Excluído", "Nota excluída com sucesso.", "success").then(U.refreshNivel1EFechar);
    } catch (e) {
      console.error(e);
      Swal.fire("Erro", e.message || "Não foi possível excluir a nota.", "error");
    }
  }

  function configurarEventosPrincipais() {
    DOM.btnSalvar.addEventListener("click", onSalvar);
    DOM.btnExcluir.addEventListener("click", onExcluir);

    DOM.anexo.addEventListener("change", () => {
      DOM.textoArquivo.textContent = DOM.anexo.files?.[0]?.name || "Nenhum arquivo escolhido";
    });

    U.toUpperInput(DOM.uf);
  }

  // =============================================================================================
  // ║BLOCO 3 - FUNÇÕES DE TRATAMENTO DE ID
  //   - carregar combos
  //   - limpar formulário (inclusão)
  //   - carregar registro (edição)
  // =============================================================================================
  async function carregarCombos() {
    if (!U.assertEmpresa()) return;
    const idEmp = U.idEmpresa();

    // helper seguro para buscar JSON (e exibir erro legível quando vier HTML/500)
    async function fetchJsonSeguro(url, erroPadrao) {
      const r = await fetch(url);
      const ct = (r.headers.get("content-type") || "").toLowerCase();
      let payload;
      try {
        payload = ct.includes("application/json") ? await r.json() : await r.text();
      } catch {
        payload = await r.text().catch(() => "");
      }

      if (!r.ok) {
        const msg = typeof payload === "string" && payload.trim()
          ? payload.slice(0, 300)
          : (payload?.erro || `${erroPadrao} (HTTP ${r.status})`);
        throw new Error(msg);
      }

      if (!ct.includes("application/json")) {
        throw new Error(`${erroPadrao}: a rota não retornou JSON válido.`);
      }
      return payload;
    }

    try {
      // Categorias
      const categorias = await fetchJsonSeguro(
        `/reembolso/nota/categorias?id_empresa=${encodeURIComponent(idEmp)}`,
        "Falha ao carregar categorias"
      );
      if (!Array.isArray(categorias)) throw new Error("Categorias: JSON inesperado.");
      preencherSelect(DOM.idCategoria, categorias, "id", "nome", true);

      // Formas de pagamento
      const formas = await fetchJsonSeguro(
        `/reembolso/nota/formas_pagamento?id_empresa=${encodeURIComponent(idEmp)}`,
        "Falha ao carregar formas de pagamento"
      );
      if (!Array.isArray(formas)) throw new Error("Formas de pagamento: JSON inesperado.");
      preencherSelect(DOM.formaPagamento, formas, "codigo", "descricao", true);

    } catch (e) {
      console.error(e);
      Swal.fire("Erro", e.message || "Não foi possível carregar os combos.", "error");
    }
  }


  function preencherSelect(sel, lista, valueKey, labelKey, manterSelecione) {
    sel.innerHTML = "";
    if (manterSelecione) {
      const o = document.createElement("option");
      o.value = ""; o.textContent = "Selecione";
      sel.appendChild(o);
    }
    (lista || []).forEach(it => {
      const op = document.createElement("option");
      op.value = String(it[valueKey]);
      op.textContent = String(it[labelKey]);
      sel.appendChild(op);
    });
  }

  function limparFormulario() {
    DOM.form.reset?.();
    DOM.textoArquivo.textContent = "Nenhum arquivo escolhido";
    DOM.hidIdNota.value = "";
    DOM.hidIdEmpresa.value = U.idEmpresa() || "";
    if (ID_REEMBOLSO) DOM.hidIdReembolso.value = ID_REEMBOLSO;
    DOM.valor.value = "";
  }

  async function carregarRegistro(idNota) {
    try {
      if (!U.assertEmpresa()) return;
      const idEmp = U.idEmpresa();
      const resp = await fetch(`/reembolso/nota/apoio/${idNota}?id_empresa=${encodeURIComponent(idEmp)}`);
      const d = await resp.json();
      if (!resp.ok) throw new Error(d?.erro || `Falha ao carregar (HTTP ${resp.status})`);

      DOM.hidIdNota.value = d.id_nota ?? idNota;
      DOM.hidIdEmpresa.value = idEmp;
      DOM.hidIdReembolso.value = d.id_reembolso ?? "";

      DOM.data.value = (d.data || "").slice(0, 10);
      DOM.descricao.value = d.descricao || "";
      DOM.documento.value = d.documento || "";
      DOM.valor.value = (d.valor != null) ? String(d.valor) : "";

      DOM.idCategoria.value = d.id_categoria ?? "";
      DOM.formaPagamento.value = d.forma_pagamento ?? "";

      DOM.cidade.value = d.cidade || "";
      DOM.uf.value = (d.uf || "").toUpperCase();

      DOM.cnpjEmitente.value = d.cnpj_emitente || "";
      DOM.razaoEmitente.value = d.razao_social_emitente || "";

      DOM.tipoDocumento.value = d.tipo_documento || "";
      DOM.chaveNfe.value = d.chave_nfe || "";

      U.setIdVisual(d.id_nota ?? idNota);
      DOM.textoArquivo.textContent = d.nome_arquivo || "Nenhum arquivo escolhido";
    } catch (e) {
      console.error(e);
      Swal.fire("Erro", e.message || "Não foi possível carregar a nota.", "error");
    }
  }

  // ---------------------------------------------------------------------------------------------
  // BOOTSTRAP
  // ---------------------------------------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", async () => {
    // Header
    DOM.campoExibicaoId = document.getElementById("id");

    // Hidden
    DOM.hidIdNota = document.getElementById("id_nota");
    DOM.hidIdReembolso = document.getElementById("id_reembolso");
    DOM.hidIdEmpresa = document.getElementById("id_empresa");

    // Linha 01
    DOM.anexo = document.getElementById("anexo");
    DOM.textoArquivo = document.getElementById("texto-arquivo");
    DOM.data = document.getElementById("data");

    // Linha 02
    DOM.descricao = document.getElementById("descricao");
    DOM.documento = document.getElementById("documento");
    DOM.valor = document.getElementById("valor");

    // Linha 03
    DOM.idCategoria = document.getElementById("id_categoria");
    DOM.formaPagamento = document.getElementById("forma_pagamento");
    DOM.cidade = document.getElementById("cidade");
    DOM.uf = document.getElementById("uf");

    // Linha 04
    DOM.cnpjEmitente = document.getElementById("cnpj_emitente");
    DOM.razaoEmitente = document.getElementById("razao_social_emitente");

    // Linha 05
    DOM.tipoDocumento = document.getElementById("tipo_documento");
    DOM.chaveNfe = document.getElementById("chave_nfe");

    // Botões
    DOM.btnSalvar = document.getElementById("btnSalvar");
    DOM.btnExcluir = document.getElementById("btnExcluir");

    // Form
    DOM.form = document.querySelector("form") || document.body;

    // Defaults
    if (U.assertEmpresa()) DOM.hidIdEmpresa.value = U.idEmpresa();

    await carregarCombos();
    configurarEventosPrincipais();

    // Começa como NOVO até o principal mandar dados
    U.setIdVisual(null);
    configurarRecebimentoDoPrincipal();
  });
})();
