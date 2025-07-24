// ✅ Shub_livro_diario_apoio.js carregado
console.log("📘 Shub_livro_diario_apoio.js carregado");

let __idLivro__ = null;

window.addEventListener("DOMContentLoaded", () => {
  
  preencherTiposConta();

  document.getElementById("ob_btnSalvar").addEventListener("click", salvarLivro);
  document.getElementById("ob_btnexcluir").addEventListener("click", excluirLivro);

  document.getElementById("possui_integracao").addEventListener("change", function () {
    const mostrar = this.value === "true";
    document.querySelectorAll(".campos_integracao").forEach(div => {
      div.style.display = mostrar ? "block" : "none";
    });
  });
});

// ✅ Recebe ID enviado do principal
GlobalUtils.receberDadosApoio(async (id) => {
  __idLivro__ = id;
  if (id) {
    await carregarLivro(id);
  }
});

async function carregarLivro(id) {
  try {
    const resp = await fetch(`/livro_diario/apoio/${id}`);
    const dados = await resp.json();
    if (!resp.ok || dados.erro) throw new Error(dados.erro || "Erro ao carregar dados");

    document.getElementById("id").value = dados.id || "";
    document.getElementById("nome_exibicao").value = dados.nome_exibicao || "";
    document.getElementById("tipo_conta").value = dados.tipo_conta || "";
    document.getElementById("tipo_plano").value = dados.tipo_plano || "Ativo";
    document.getElementById("status").value = String(dados.status);
    document.getElementById("banco_codigo").value = dados.banco_codigo || "";
    document.getElementById("agencia_numero").value = dados.agencia_numero || "";
    document.getElementById("agencia_dv").value = dados.agencia_dv || "";
    document.getElementById("conta_numero").value = dados.conta_numero || "";
    document.getElementById("conta_dv").value = dados.conta_dv || "";
    document.getElementById("bandeira_cartao").value = dados.bandeira_cartao || "";
    document.getElementById("possui_integracao").value = String(dados.possui_integracao);
    document.getElementById("token_integracao").value = dados.token_integracao || "";
    document.getElementById("webhook_url").value = dados.webhook_url || "";
    document.getElementById("id_conta_contabil").value = dados.id_conta_contabil || "";
    const cod = dados.codigo_conta_contabil || "";
    const desc = dados.desc_conta_contabil || "";
    document.getElementById("combo_display").value = cod && desc ? `${cod} - ${desc}` : (desc || "Selecione");

    document.getElementById("possui_integracao").dispatchEvent(new Event("change"));
  } catch (erro) {
    Swal.fire("Erro", "Erro ao carregar dados.", "error");
  }
}

async function salvarLivro() {
  const dados = {
    id: document.getElementById("id").value || null,
    nome_exibicao: document.getElementById("nome_exibicao").value.trim(),
    tipo_conta: document.getElementById("tipo_conta").value,
    status: document.getElementById("status").value === "true",
    id_conta_contabil: document.getElementById("id_conta_contabil").value || null,
    banco_codigo: document.getElementById("banco_codigo").value.trim(),
    agencia_numero: document.getElementById("agencia_numero").value.trim(),
    agencia_dv: document.getElementById("agencia_dv").value.trim(),
    conta_numero: document.getElementById("conta_numero").value.trim(),
    conta_dv: document.getElementById("conta_dv").value.trim(),
    tipo_plano: document.getElementById("tipo_plano").value,
    bandeira_cartao: document.getElementById("bandeira_cartao").value,
    possui_integracao: document.getElementById("possui_integracao").value === "true",
    token_integracao: document.getElementById("token_integracao").value.trim(),
    webhook_url: document.getElementById("webhook_url").value.trim()
  };

  if (!dados.nome_exibicao) {
    Swal.fire("Atenção", "Preencha o campo Nome.", "warning");
    return;
  }

  try {
    const resp = await fetch("/livro_diario/salvar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados)
    });
    const json = await resp.json();

    if (resp.ok) {
      Swal.fire("Sucesso", json.mensagem, "success").then(() => {
        window.parent.postMessage({ grupo: "atualizarTabela" }, "*");
        GlobalUtils.fecharJanelaApoio();
      });
    } else {
      Swal.fire("Erro", json.erro || "Erro ao salvar.", "error");
    }
  } catch (e) {
    Swal.fire("Erro", "Erro inesperado ao salvar.", "error");
  }
}

async function excluirLivro() {
  const id = document.getElementById("id").value;
  if (!id) {
    Swal.fire("Erro", "Conta ainda não foi salva.", "warning");
    return;
  }

  const confirma = await Swal.fire({
    title: `Excluir conta ${id}?`,
    text: "Essa ação não poderá ser desfeita.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sim, excluir",
    cancelButtonText: "Cancelar"
  });

  if (!confirma.isConfirmed) return;

  try {
    const resp = await fetch("/livro_diario/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    const json = await resp.json();
    if (resp.ok && json.status === "sucesso") {
      Swal.fire("Sucesso", json.mensagem, "success").then(() => {
        window.parent.postMessage({ grupo: "atualizarTabela" }, "*");
        GlobalUtils.fecharJanelaApoio();
      });
    } else {
      Swal.fire("Erro", json.erro || "Erro ao excluir.", "error");
    }
  } catch (erro) {
    Swal.fire("Erro", "Erro inesperado ao excluir.", "error");
  }
}

function preencherTiposConta() {
  const select = document.getElementById("tipo_conta");
  if (!select) return;

  select.innerHTML = '<option value="">Selecione</option>'; // limpa antes de popular

  if (window.Util?.TIPOS_CONTA_PADRAO?.length) {
    Util.TIPOS_CONTA_PADRAO.forEach(item => {
      const opt = document.createElement("option");
      opt.value = item.valor;
      opt.textContent = item.label;
      select.appendChild(opt);
    });
  }
}
