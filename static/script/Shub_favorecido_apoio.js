console.log("📘 Shub_favorecido_apoio.js carregado");

window.addEventListener("DOMContentLoaded", async () => {
  window.opener?.postMessage({ grupo: "apoioPronto" }, "*");
  document.getElementById("id_empresa").value = sessionStorage.getItem("id_empresa") || "";

  aplicarComportamentoTipoFavorecido();

  // Aguarda as categorias carregarem primeiro
  await GlobalUtils.carregarCategorias();

  const id = new URLSearchParams(window.location.search).get("id");
  if (id) await carregarFavorecido(id);
  else limparFormulario();

  // Demais listeners
  document.getElementById("tipo").addEventListener("change", aplicarComportamentoTipoFavorecido);
  document.getElementById("razao_social").addEventListener("blur", preencherPrimeiroNome);
  document.getElementById("ob_btnSalvar").addEventListener("click", salvarFavorecido);
  document.getElementById("ob_btnexcluir").addEventListener("click", excluirFavorecido);
  document.getElementById("btnBuscarCEP").addEventListener("click", buscarCep);
  document.getElementById("btnBuscarCNPJ").addEventListener("click", buscarCnpj);

  document.getElementById("documento").addEventListener("input", () => {
    const input = document.getElementById("documento");
    const tipo = document.getElementById("tipo").value === "F" ? "cpf" : "cnpj";
    input.value = window.Util.formatarCNPJ(input.value, tipo);
  });
});


async function carregarFavorecido(id) {
  try {
    const resp = await fetch(`/favorecido/apoio/${id}`);
    if (!resp.ok) throw new Error("Registro não encontrado");

    const dados = await resp.json();

    for (const campo in dados) {

      // Trata campos de data para o input[type="date"]
      ["data_abertura", "data_situacao"].forEach((campo) => {
        const el = document.getElementById(campo);
        const valor = dados[campo];
        if (el && valor) {
          try {
            el.value = new Date(valor).toISOString().split("T")[0]; // formata para YYYY-MM-DD
          } catch (e) {
            console.warn(`❗ Erro ao formatar ${campo}:`, valor);
          }
        }
      });

      const el = document.getElementById(campo);

      if (el) {
        // Se for o select de categoria, converte para string e seta o value
        if (campo === "id_categoria") {
          el.value = String(dados[campo]);
        } else {
          el.value = dados[campo] || "";
        }
      }
    }

    if (dados.status !== undefined) {
      document.getElementById("status").value = String(dados.status);
    }

  } catch (err) {
    console.error("Erro ao carregar favorecido:", err);
    Swal.fire("Erro", "Não foi possível carregar os dados.", "error");
  }
}


function limparFormulario() {
  const form = document.getElementById("formFavorecido");
  const inputs = form.querySelectorAll("input");
  const selects = form.querySelectorAll("select");

  inputs.forEach(input => {
    if (input.type !== "hidden") input.value = "";
  });

  selects.forEach(select => {
    // Define o primeiro valor como padrão (o primeiro <option>)
    select.selectedIndex = 0;
  });

  // Aplica a máscara correta e mostra/esconde campos conforme o tipo
  aplicarComportamentoTipoFavorecido();
}


function aplicarComportamentoTipoFavorecido() {
  const tipo = document.getElementById("tipo").value;
  const isFisica = tipo === "F";

  // Ajusta os textos dos labels
  document.querySelector("label[for='documento']").textContent = isFisica ? "CPF:" : "CNPJ:";
  document.getElementById("btnBuscarCNPJ").style.display = isFisica ? "none" : "inline-block";
  document.querySelector("label[for='razao_social']").textContent = isFisica ? "Nome Completo:" : "Razão Social:";
  document.querySelector("label[for='nome']").textContent = isFisica ? "Primeiro Nome:" : "Nome Amigável:";
  document.querySelector("label[for='data_abertura']").textContent = isFisica ? "Data de Nascimento:" : "Data de Abertura:";

  // Oculta todos os campos marcados com data-tipo
  document.querySelectorAll('.form-campo[data-tipo]').forEach(el => {
    el.classList.remove("ativo");
  });

  // Ativa apenas os do tipo atual
  const tipoAlvo = isFisica ? "pf" : "pj";
  document.querySelectorAll(`.form-campo[data-tipo="${tipoAlvo}"]`).forEach(el => {
    el.classList.add("ativo");
  });
}





function preencherPrimeiroNome() {
  const tipo = document.getElementById("tipo").value;
  if (tipo === "F") {
    const nomeCompleto = document.getElementById("razao_social").value.trim();
    const primeiroNome = nomeCompleto.split(" ")[0] || "";
    document.getElementById("nome").value = primeiroNome;
  }
}

async function salvarFavorecido() {
  const form = document.getElementById("formFavorecido");
  const dados = {
    id: document.getElementById("id").value || null
  };

  form.querySelectorAll("input, select, textarea").forEach(el => {
    if (el.id && el.id !== "id") dados[el.id] = el.value.trim();
  });


  // 🔒 Validação de campos obrigatórios
  const camposObrigatorios = [
    { id: "documento", nome: "Documento (CPF ou CNPJ)" },
    { id: "razao_social", nome: "Razão Social" },
    { id: "nome", nome: "Nome Amigável" },
    { id: "id_categoria", nome: "Categoria" },
    { id: "cep", nome: "CEP" },
    { id: "logradouro", nome: "Logradouro" },
    { id: "numero", nome: "Número" },
    { id: "bairro", nome: "Bairro" },
    { id: "cidade", nome: "Cidade" },
    { id: "uf", nome: "UF" }
  ];

  for (const campo of camposObrigatorios) {
    const el = document.getElementById(campo.id);
    if (!el || !el.value.trim()) {
      await Swal.fire("Atenção", `O campo "${campo.nome}" é obrigatório.`, "warning");
      el?.focus();
      return;
    }
  }

  try {
    const resp = await fetch("/favorecido/salvar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    });

    const json = await resp.json();
    if (resp.ok && json.sucesso) {
      Swal.fire("Sucesso", json.mensagem || "Favorecido salvo com sucesso!", "success").then(() => {
        window.opener?.FavorecidoHub?.carregarDados?.();
        window.close();
      });
    } else {
      Swal.fire("Erro", json.mensagem || "Erro ao salvar.", "error");
    }
  } catch (err) {
    Swal.fire("Erro", "Erro ao se comunicar com o servidor.", "error");
  }
}

async function excluirFavorecido() {
  const id = document.getElementById("id").value;
  if (!id) return;

  const confirm = await Swal.fire({
    title: "Excluir?",
    text: "Essa ação não pode ser desfeita.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sim, excluir",
    cancelButtonText: "Cancelar",
  });

  if (confirm.isConfirmed) {
    try {
      const resp = await fetch("/favorecido/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const json = await resp.json();
      if (json.sucesso) {
        Swal.fire("Excluído", "Registro removido.", "success")
          .then(() => window.close());
      } else {
        Swal.fire("Erro", json.mensagem || "Erro ao excluir.", "error");
      }
    } catch (err) {
      Swal.fire("Erro", "Erro ao se comunicar com o servidor.", "error");
    }
  }
}




async function buscarCep() {
  const cep = document.getElementById("cep").value.replace(/\D/g, "");
  if (cep.length !== 8) {
    Swal.fire("CEP inválido", "Informe um CEP com 8 dígitos.", "warning");
    return;
  }

  try {
    const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await resp.json();

    if (data.erro) throw new Error("CEP não encontrado");

    document.getElementById("logradouro").value = data.logradouro || "";
    document.getElementById("complemento").value = data.complemento || "";
    document.getElementById("bairro").value = data.bairro || "";
    document.getElementById("cidade").value = data.localidade || "";
    document.getElementById("uf").value = data.uf || "";

  } catch (error) {
    Swal.fire("Erro ao buscar CEP", error.message, "error");
  }
}




async function buscarCnpj() {
  const cnpj = document.getElementById("documento").value.replace(/\D/g, "");
  if (cnpj.length !== 14) {
    Swal.fire("CNPJ inválido", "Informe um CNPJ com 14 dígitos.", "warning");
    return;
  }

  try {
    const resp = await fetch("/api/buscacnpj", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cnpj })
    });

    const data = await resp.json();

    if (data.erro) {
      Swal.fire("Erro", data.erro, "error");
      return;
    }

    // ⚙️ Preenche os campos
    document.getElementById("razao_social").value = data.razao_social || data.nome || "";
    document.getElementById("nome").value = data.fantasia?.trim() || data.razao_social || data.nome || "";
    document.getElementById("email").value = data.email || "";
    document.getElementById("telefone").value = data.telefone || "";

    document.getElementById("cep").value = data.cep || "";
    document.getElementById("logradouro").value = data.endereco || "";
    document.getElementById("numero").value = data.numero || "";
    document.getElementById("bairro").value = data.bairro || "";
    document.getElementById("cidade").value = data.cidade || "";
    document.getElementById("uf").value = data.uf || "";

    document.getElementById("inscricao_estadual").value = data.ie || "";
    document.getElementById("data_abertura").value = data.data_abertura || "";
    document.getElementById("natureza_juridica").value = data.natureza_juridica || "";
    document.getElementById("cnae_principal").value = data.cnae_principal || "";
    document.getElementById("cnaes_secundarios").value = data.cnaes_secundarios || "";
    document.getElementById("situacao_cadastral").value = data.situacao_cadastral || "";
    document.getElementById("data_abertura").value = data.data_abertura || "";
    document.getElementById("data_situacao").value = data.data_situacao || "";

    aplicarComportamentoTipoFavorecido();

  } catch (err) {
    console.error("Erro ao buscar CNPJ", err);
    Swal.fire("Erro", "Falha ao consultar o CNPJ.", "error");
  }
}

