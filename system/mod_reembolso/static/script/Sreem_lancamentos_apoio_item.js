console.log("✅ Sreem_lancamentos_apoio_item.js carregado");


let animacaoSalvar = null;
let bloqueadoFechamento = false;


window.addEventListener("DOMContentLoaded", () => {
  ApoioItem.init();
});

document.getElementById("anexo").addEventListener("change", function () {
  const span = document.getElementById("texto-arquivo");
  if (this.files.length > 0) {
    span.textContent = this.files[0].name;
  } else {
    span.textContent = "Nenhum arquivo escolhido";
  }
});

const ApoioItem = {
  init: function () {
    console.log("🚀 ApoioItem.init iniciado");

    const url = new URL(window.location.href);
    document.getElementById("id_reembolso").value = url.searchParams.get("id_reembolso") || "";
    document.getElementById("id_item").value = url.searchParams.get("id") || "";
    document.getElementById("id_empresa").value = App?.Varidcliente || sessionStorage.getItem("id_empresa") || "";

    this.carregarCombos();
    this.configurarEventos();
    if (document.getElementById("id_item").value) {
      this.carregarDados();
    }
  },

  configurarEventos: function () {
    const btnSalvar = document.getElementById("btnSalvar");
    if (!btnSalvar) {
      console.error("❌ Botão Salvar não encontrado");
      return;
    }

    btnSalvar.addEventListener("click", (e) => {
      e.preventDefault();
      console.log("🟢 Clique no botão Salvar detectado");
      this.salvar();
    });
  },

  carregarCombos: function () {
    const id_empresa = document.getElementById("id_empresa").value;
    GlobalUtils.carregarCategorias("reembolso", "id_categoria", id_empresa);
    GlobalUtils.carregarFormasPagamento("forma_pagamento", id_empresa);
  },

  salvar: async function () {
    const anexoInput = document.getElementById("anexo");
    if (!anexoInput || !anexoInput.files.length) {
      Swal.fire("Atenção", "É necessário anexar a nota fiscal.", "warning");
      return;
    }

    const obrigatorios = [
      { id: "data", nome: "Data da Nota" },
      { id: "descricao", nome: "Descrição" },
      { id: "documento", nome: "Número da Nota / Cupom" },
      { id: "valor", nome: "Valor" },
      { id: "id_categoria", nome: "Categoria" },
      { id: "forma_pagamento", nome: "Forma de Pagamento" },
      { id: "razao_social_emitente", nome: "Razão Social do Emitente" }
    ];

    for (let campo of obrigatorios) {
      const el = document.getElementById(campo.id);
      if (!el || !el.value.trim()) {
        Swal.fire("Campo obrigatório", `O campo "${campo.nome}" deve ser preenchido.`, "warning");
        return;
      }
    }

    const formData = new FormData();
    const campos = [
      "id_item", "id_reembolso", "id_empresa", "descricao", "data", "valor",
      "id_categoria", "forma_pagamento", "cidade", "uf",
      "cnpj_emitente", "razao_social_emitente", "tipo_documento", "chave_nfe",
      "documento"
    ];

    campos.forEach(id => {
      const el = document.getElementById(id);
      if (el) formData.append(id, el.value);
    });

    formData.append("anexo", anexoInput.files[0]);
    formData.append("origem_preenchimento", document.body.dataset.origem || "manual");

    try {
      const resp = await fetch("/reembolso/item/salvar", {
        method: "POST",
        body: formData
      });

      const json = await resp.json();
      if (resp.ok && json.sucesso) {
        Swal.fire("Sucesso", json.mensagem, "success").then(() => {
          window.opener?.postMessage({ grupo: "reembolsoalva" }, "*");
          window.close();
        });
      } else {
        throw new Error(json.erro || "Erro ao salvar item");
      }
    } catch (e) {
      Swal.fire("Erro", e.message, "error");
    }
  },

  carregarDados: async function () {
    const id = document.getElementById("id_item").value;
    if (!id) return;

    try {
      const resp = await fetch(`/reembolso/item/apoio/${id}`);
      const json = await resp.json();

      if (resp.ok && json) {
        for (const campo in json) {
          const el = document.getElementById(campo);
          if (el) el.value = json[campo];
        }

        if (json.anexo_nota) {
          const partes = json.anexo_nota.split(/[\\/]/);
          const nomeArquivo = partes[partes.length - 1];
          document.getElementById("texto-arquivo").textContent = nomeArquivo;
        }

        document.body.dataset.origem = "manual";
      } else {
        throw new Error("Item não encontrado");
      }
    } catch (e) {
      console.error("Erro ao carregar dados do item:", e);
      Swal.fire("Erro", e.message, "error");
    }
  }
};

document.getElementById("anexo").addEventListener("change", async function () {
  const file = this.files[0];
  if (!file || (!file.name.toLowerCase().endsWith(".xml") && !file.type.startsWith("image") && !file.name.toLowerCase().endsWith(".pdf"))) {
    return;
  }

  const formData = new FormData();
  formData.append("arquivo", file);
  formData.append("id_reembolso", document.getElementById("id_reembolso").value);

  try {
    // 🔒 Bloqueia botões e fecha
    const btnSalvar = document.getElementById("btnSalvar");
    const btnExcluir = document.getElementById("btnExcluir");

    btnSalvar.disabled = true;
    btnExcluir.disabled = true;
    btnSalvar.classList.add("botao-desativado");
    btnExcluir.classList.add("botao-desativado");

    bloqueadoFechamento = true;

    // ⏳ Anima botão Salvar...
    let pontos = 0;
    animacaoSalvar = setInterval(() => {
      pontos = (pontos + 1) % 4;
      btnSalvar.textContent = "Salvar" + ".".repeat(pontos);
    }, 500);

    const resp = await fetch("/reembolso/item/lernota", {
      method: "POST",
      body: formData
    });

    const json = await resp.json();
    console.log("📦 JSON bruto recebido da rota /reembolso/item/lernota:", json);
    console.log("📦 Conteúdo json.dados:", json.dados);
    console.log("📦 Conteúdo d usado pelo preenchimento:", json.dados || json);

    ["razao_social_emitente", "cnpj_emitente", "valor", "data", "documento", "tipo_documento"].forEach(campo => {
      console.log(`🔎 ${campo}:`, (json.dados || json)[campo]);
    });

    if (resp.ok && json && !json.erro) {
      const d = json.dados || json;
      console.log("🧠 Dados extraídos do GPT:", d);

      // 🔄 Preenchimento genérico
      const preencherCampo = (id, ...valores) => {
        const el = document.getElementById(id);
        if (el) el.value = valores.find(v => v) || "";
      };

      preencherCampo("razao_social_emitente", d.razao_social_emitente, d.razao_social);
      preencherCampo("cnpj_emitente", d.cnpj_emitente, d.cnpj);

      const cnpjBruto = d.cnpj_emitente || d.cnpj || "";
      const cnpjLimpo = cnpjBruto.replace(/\D/g, "");

      console.log("🟡 CNPJ bruto do GPT:", cnpjBruto);
      console.log("🟢 CNPJ limpo:", cnpjLimpo);
      console.log("📤 Enviando JSON:", JSON.stringify({ cnpj: cnpjLimpo }));

      if (cnpjLimpo.length === 14) {
        try {
          const resp = await fetch("/api/buscacnpj", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cnpj: cnpjLimpo })
          });
          const empresa = await resp.json();
          if (!empresa.erro) {
            preencherCampo("cidade", empresa.cidade);
            preencherCampo("uf", empresa.uf);
            window.__dadosReceita = empresa;
          }
        } catch (e) {
          console.warn("❌ Erro ao consultar CNPJ na Receita:", e);
        }
      } else {
        console.warn("⚠️ CNPJ inválido ou ausente, busca ignorada.");
      }

      const valorBruto = d.valor || d.valor_total || "";
      const valorNumerico = valorBruto.replace(/\./g, "").replace(",", ".");
      preencherCampo("valor", valorNumerico);
      if (d.data || d.data_emissao) {
        const dataISO = d.data || d.data_emissao;
        const campoData = document.getElementById("data");
        if (campoData) {
          const dataConvertida = window.Util?.formatarDataISO
            ? window.Util.formatarDataISO(dataISO)
            : new Date(dataISO).toISOString().split("T")[0]; // fallback manual
          campoData.value = dataConvertida;
        }
      }

      preencherCampo("documento", d.documento, d.numero_nota);
      preencherCampo("chave_nfe", d.chave_nfe);
      preencherCampo("tipo_documento", d.tipo_documento, "Cupom");

      document.body.dataset.origem = "automatico";
      clearInterval(animacaoSalvar);
      btnSalvar.textContent = "Salvar";
      btnSalvar.disabled = false;
      btnExcluir.disabled = false;
      btnSalvar.classList.remove("botao-desativado");
      btnExcluir.classList.remove("botao-desativado");
      bloqueadoFechamento = false;

      Swal.fire("Nota reconhecida", "Campos preenchidos automaticamente.", "success");
    } else {
      throw new Error(json.erro || "Falha ao interpretar");
    }


  } catch (e) {
    // ✅ Libera interface
    clearInterval(animacaoSalvar);
    btnSalvar.textContent = "Salvar";
    btnSalvar.disabled = false;
    btnExcluir.disabled = false;
    btnSalvar.classList.remove("botao-desativado");
    btnExcluir.classList.remove("botao-desativado");
    bloqueadoFechamento = false;
    Swal.fire("Leitura falhou", "Preencha os dados manualmente.", "warning");
    document.body.dataset.origem = "manual";
  }
});


window.addEventListener("beforeunload", function (e) {
  if (bloqueadoFechamento) {
    e.preventDefault();
    e.returnValue = "";
  }
});
