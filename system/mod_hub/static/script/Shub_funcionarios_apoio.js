// ✅ Shub_funcionarios_apoio.js carregado
console.log("Shub_funcionarios_apoio.js carregado");

let __nivelModal__ = null;
let __idFuncionario__ = null;

GlobalUtils.receberDadosApoio(function (id, nivel) {
  __nivelModal__ = nivel;
  __idFuncionario__ = id;

  if (id !== undefined && id !== null) {
    carregarFuncionarioPorID(id);
  } else {
    document.getElementById("status").checked = true;
  }
});

window.addEventListener("DOMContentLoaded", () => {
  window.parent.postMessage({ grupo: "apoioPronto" }, "*");

  document.getElementById("ob_btnSalvar").addEventListener("click", salvarFuncionario);
  document.getElementById("ob_btnexcluir").addEventListener("click", excluirFuncionario);

  document.getElementById("documento").addEventListener("input", function() {
    this.value = Util.formatarCPF(this.value);
  });

  document.getElementById("telefone").addEventListener("input", function() {
    this.value = Util.formatarTelefone(this.value);
  });

  document.getElementById("cep").addEventListener("input", function() {
    this.value = Util.formatarCEP(this.value);
  });

  document.getElementById("documento").addEventListener("blur", function() {
    const cpf = this.value;
    if (cpf && !Util.validarCPF(cpf)) {
      Swal.fire("Atenção", "CPF informado é inválido!", "warning");
    }
  });

  document.getElementById("btnBuscarCEP").addEventListener("click", async function() {
    const cep = document.getElementById("cep").value.replace(/\D/g, "");
    if (cep.length !== 8) {
      Swal.fire("Atenção", "CEP inválido, deve conter 8 números.", "warning");
      return;
    }
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const dados = await resp.json();
      if (dados.erro) {
        Swal.fire("Erro", "CEP não encontrado.", "error");
        return;
      }
      document.getElementById("logradouro").value = dados.logradouro || "";
      document.getElementById("bairro").value = dados.bairro || "";
      document.getElementById("cidade").value = dados.localidade || "";
      document.getElementById("uf").value = dados.uf || "";
      Swal.fire("Sucesso", "Endereço preenchido automaticamente!", "success");
    } catch (e) {
      Swal.fire("Erro", "Erro ao consultar o CEP.", "error");
    }
  });
  carregarDepartamentos();

});

async function carregarFuncionarioPorID(id) {
  try {
    const resp = await fetch(`/funcionarios/apoio/${id}`);
    const dados = await resp.json();
    if (!resp.ok || dados.erro) throw new Error(dados.erro);

    const campos = ["id","documento","nome","departamento","funcao","email","telefone",
      "data_abertura","data_situacao","cep","logradouro","numero","complemento",
      "bairro","cidade","uf","observacoes"];
    campos.forEach(campo => {
      if (document.getElementById(campo)) {
        document.getElementById(campo).value = dados[campo] || "";
      }
    });
    document.getElementById("status").checked = dados.status === true;
  } catch (e) {
    Swal.fire("Erro", "Erro ao carregar funcionário.", "error");
  }
}

async function salvarFuncionario() {
  const campos = ["documento","nome","departamento","funcao","email","telefone",
    "data_abertura","data_situacao","cep","logradouro","numero","complemento",
    "bairro","cidade","uf","observacoes"];
  const dados = {
    id: document.getElementById("id").value || null,
    status: document.getElementById("status").checked
  };
  campos.forEach(campo => {
    dados[campo] = document.getElementById(campo)?.value?.trim() || "";
  });
  if (!dados.nome) return Swal.fire("Atenção", "Preencha o nome.", "warning");

  try {
    const resp = await fetch("/funcionarios/salvar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados)
    });
    const json = await resp.json();
    if (resp.ok) {
      Swal.fire("Sucesso", json.mensagem, "success").then(() => {
        window.parent.postMessage({ grupo: "atualizarTabela" }, "*");
        GlobalUtils.fecharJanelaApoio(__nivelModal__);
      });
    } else {
      Swal.fire("Erro", json.erro || "Erro ao salvar.", "error");
    }
  } catch (e) {
    Swal.fire("Erro", "Erro inesperado ao salvar.", "error");
  }
}

async function excluirFuncionario() {
  const id = document.getElementById("id").value;
  if (!id) return Swal.fire("Erro", "Registro não salvo.", "warning");
  const confirma = await Swal.fire({
    title: `Excluir funcionário ${id}?`,
    text: "Essa ação não poderá ser desfeita.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sim, excluir",
    cancelButtonText: "Cancelar"
  });
  if (!confirma.isConfirmed) return;
  try {
    const resp = await fetch("/funcionarios/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    const json = await resp.json();
    if (resp.ok && json.status === "sucesso") {
      Swal.fire("Sucesso", json.mensagem, "success").then(() => {
        window.parent.postMessage({ grupo: "atualizarTabela" }, "*");
        GlobalUtils.fecharJanelaApoio(__nivelModal__);
      });
    } else {
      Swal.fire("Erro", json.erro || "Erro ao excluir.", "error");
    }
  } catch (e) {
    Swal.fire("Erro", "Erro ao excluir.", "error");
  }
}


async function carregarDepartamentos() {
  try {
    const resp = await fetch("/departamentos/ativos");
    const lista = await resp.json();

    const select = document.getElementById("departamento");
    select.innerHTML = '<option value="">Selecione...</option>';

    lista.forEach(dep => {
      const opt = document.createElement("option");
      opt.value = dep.id;
      opt.textContent = dep.nome;
      select.appendChild(opt);
    });
  } catch (e) {
    console.error("Erro ao carregar departamentos:", e);
  }
}
