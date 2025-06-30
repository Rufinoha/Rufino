// ✅ Shub_livro_diario_apoio.js carregado
console.log("📘 Shub_livro_diario_apoio.js carregado");

window.addEventListener("DOMContentLoaded", () => {
  window.opener?.postMessage({ grupo: "apoioPronto" }, "*");
  configurarAutoComplete();
  preencherTiposConta();

  document.getElementById("ob_btnSalvar").addEventListener("click", salvarLivro);
  document.getElementById("ob_btnexcluir").addEventListener("click", excluirLivro);
});

document.getElementById("possui_integracao").addEventListener("change", function () {
  const mostrar = this.value === "true";
  document.querySelectorAll(".campos_integracao").forEach(div => {
    div.style.display = mostrar ? "block" : "none";
  });
});



function preencherTiposConta() {
  const select = document.getElementById("tipo_conta");
  Util.TIPOS_CONTA_PADRAO.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item.valor;
    opt.textContent = item.label;
    select.appendChild(opt);
  });
}

function configurarAutoComplete() {
  const combo = document.getElementById("combo_conta");
  const inputVisivel = document.getElementById("conta_contabil_input");
  const inputOculto = document.getElementById("id_conta_contabil");
  const display = document.getElementById("combo_display");
  const lista = document.getElementById("sugestoes_contas");
  const area = document.getElementById("combo_area");
  const tipoPlanoSelect = document.getElementById("tipo_plano");

  let timeout = null;

  combo.addEventListener("click", () => {
    const aberto = area.style.display === "block";
    area.style.display = aberto ? "none" : "block";
    if (!aberto) inputVisivel.focus();
  });

  document.addEventListener("click", (e) => {
    if (!combo.contains(e.target) && !area.contains(e.target)) {
      area.style.display = "none";
    }
  });

  inputVisivel.addEventListener("input", () => {
    clearTimeout(timeout);
    const termo = inputVisivel.value.trim();
    if (termo.length >= 3) {
      timeout = setTimeout(() => buscarSugestoes(termo), 300);
    } else {
      lista.innerHTML = "<li class='autocomplete-item'>Digite 3 ou mais caracteres</li>";
      inputOculto.value = "";
    }
  });

  async function buscarSugestoes(termo) {
    try {
      const tipo = tipoPlanoSelect.value;
      const resp = await fetch(`/plano_contas/buscar?termo=${encodeURIComponent(termo)}&tipo=${tipo}`);
      const sugestoes = await resp.json();
      lista.innerHTML = "";

      if (sugestoes.length === 0) {
        lista.innerHTML = "<li class='autocomplete-item'>Nenhum resultado</li>";
        return;
      }

      sugestoes.forEach(item => {
        const li = document.createElement("li");
        li.className = "autocomplete-item";
        li.innerHTML = item.hierarquia.map(n => {
          const indent = (n.nivel - 2) * 20;
          const texto = n.nivel === 5 ? `<strong>${n.descricao}</strong>` : n.descricao;
          return `<div style="padding-left:${indent}px">${texto}</div>`;
        }).join("");

        li.addEventListener("click", () => {
          display.value = `${item.codigo} - ${item.descricao_final}`;
          inputOculto.value = item.id;
          area.style.display = "none";
          lista.innerHTML = "";
        });

        lista.appendChild(li);
      });
    } catch (e) {
      console.error("❌ Erro ao buscar sugestões:", e);
    }
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
        window.opener?.LivroDiarioHub?.carregarDados?.();
        window.close();
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
        window.opener?.LivroDiarioHub?.carregarDados?.();
        window.close();
      });
    } else {
      Swal.fire("Erro", json.erro || "Erro ao excluir.", "error");
    }
  } catch (erro) {
    Swal.fire("Erro", "Erro inesperado ao excluir.", "error");
  }
}

window.addEventListener("message", async (event) => {
  if (event.data && event.data.grupo === "carregarLivro") {
    const id = event.data.id;
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

      // Garante exibição correta após preenchimento
      document.getElementById("possui_integracao").dispatchEvent(new Event("change"));

    } catch (erro) {
      Swal.fire("Erro", "Erro ao carregar dados.", "error");
    }
  }
});

window.addEventListener("DOMContentLoaded", () => {
  const select = document.getElementById("possui_integracao");
  if (select) {
    const evento = new Event("change");
    select.dispatchEvent(evento); // dispara o change pra aplicar o display inicial
  }
});
