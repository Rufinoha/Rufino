// Atualização do Shub_categoria_apoio.js com expansão dinâmica da janela

console.log("📘 Scategoria_apoio.js carregado");

window.addEventListener("DOMContentLoaded", () => {
  console.log("📘 DOM pronto, enviando apoioPronto...");
  window.opener?.postMessage({ grupo: "apoioPronto" }, "*");
  configurarAutoComplete();

  document.getElementById("ob_btnSalvar").addEventListener("click", salvarCategoria);
  document.getElementById("ob_btnexcluir").addEventListener("click", excluirCategoria);

  const select = document.getElementById("onde_usa");
  if (select && Util?.TIPOS_ORIGEM?.length) {
    Util.TIPOS_ORIGEM.forEach((item) => {
      const opt = document.createElement("option");
      opt.value = item;
      opt.textContent = item;
      select.appendChild(opt);
    });
  }
});

function configurarAutoComplete() {
  const combo = document.getElementById("combo_conta");
  const inputVisivel = document.getElementById("conta_contabil_input");
  const inputOculto = document.getElementById("id_conta_contabil");
  const display = document.getElementById("combo_display");
  const lista = document.getElementById("sugestoes_contas");
  const area = document.getElementById("combo_area");
  const tipoPlanoSelect = document.getElementById("tipo_plano");

  let timeout = null;
  let alturaOriginal = window.outerHeight;

  combo.addEventListener("click", () => {
    const aberto = area.style.display === "block";
    area.style.display = aberto ? "none" : "block";
    area.style.display = aberto ? "none" : "block";
    if (aberto) {
      window.resizeTo(window.outerWidth, alturaOriginal);
    } else {
      inputVisivel.focus();
      lista.innerHTML = "<li class='autocomplete-item'>Digite 3 ou mais caracteres</li>";
    }


  });

  document.addEventListener("click", (e) => {
    if (!combo.contains(e.target) && !area.contains(e.target)) {
      area.style.display = "none";
      window.resizeTo(window.outerWidth, alturaOriginal);
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
    const tipo = tipoPlanoSelect.value;
    try {
      const resp = await fetch(`/plano_contas/buscar?termo=${encodeURIComponent(termo)}&tipo=${tipo}`);
      const sugestoes = await resp.json();
      lista.innerHTML = "";
      window.resizeTo(window.outerWidth, alturaOriginal); // sempre reseta antes

      if (sugestoes.length === 0) {
        lista.innerHTML = "<li class='autocomplete-item'>Nenhum resultado</li>";
        return;
      }

      sugestoes.forEach(item => {
        const li = document.createElement("li");
        li.classList.add("autocomplete-item");

        li.innerHTML = item.hierarquia.map(n => {
          const indent = (n.nivel - 2) * 20;
          const texto = n.nivel === 5 ? `<strong>${n.descricao}</strong>` : n.descricao;
          return `<div style="padding-left:${indent}px">${texto}</div>`;
        }).join("");

        li.addEventListener("mouseenter", () => li.style.backgroundColor = "#f1f1f1");
        li.addEventListener("mouseleave", () => li.style.backgroundColor = "#fff");

        li.addEventListener("click", () => {
          display.value = `${item.codigo} - ${item.descricao_final}`;
          inputOculto.value = item.id;
          area.style.display = "none";
          lista.innerHTML = "";
          window.resizeTo(window.outerWidth, alturaOriginal);
        });

        lista.appendChild(li);
      });

      // calcular expansão proporcional à quantidade de itens
      const itemAltura = 34; // altura média de cada item
      const limiteVisivel = Math.min(sugestoes.length, 5); // máximo de itens visíveis
      const alturaExtra = limiteVisivel * itemAltura + 30;

      window.resizeTo(window.outerWidth, alturaOriginal + alturaExtra);

    } catch (e) {
      console.error("❌ Erro ao buscar sugestões:", e);
    }
  }

}

async function salvarCategoria() {
  const dados = {
    id: document.getElementById("id").value || null,
    nome_categoria: document.getElementById("nome_categoria").value.trim(),
    onde_usa: document.getElementById("onde_usa").value.trim(),
    tipo_plano: document.getElementById("tipo_plano").value,
    id_conta_contabil: document.getElementById("id_conta_contabil").value || null,
    status: document.getElementById("status").value === "true"
  };

  if (!dados.nome_categoria) {
    Swal.fire("Atenção", "Preencha o campo Nome da Categoria.", "warning");
    return;
  }

  try {
    const resp = await fetch("/categoria/salvar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados)
    });
    const json = await resp.json();
    if (resp.ok) {
      Swal.fire("Sucesso", json.mensagem, "success").then(() => {
        window.opener?.CategoriaHub?.carregarDados?.();
        window.close();
      });
    } else {
      Swal.fire("Erro", json.erro || "Erro ao salvar categoria.", "error");
    }
  } catch (erro) {
    Swal.fire("Erro", "Erro inesperado ao salvar.", "error");
  }
}

async function excluirCategoria() {
  const id = document.getElementById("id").value;
  if (!id) {
    Swal.fire("Erro", "Categoria ainda não foi salva.", "warning");
    return;
  }

  const confirma = await Swal.fire({
    title: `Excluir categoria ${id}?`,
    text: "Esta ação não poderá ser desfeita.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sim, excluir",
    cancelButtonText: "Cancelar"
  });

  if (!confirma.isConfirmed) return;

  try {
    const resp = await fetch("/categoria/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    const json = await resp.json();
    if (resp.ok && json.status === "sucesso") {
      Swal.fire("Sucesso", json.mensagem, "success").then(() => {
        window.opener?.CategoriaHub?.carregarDados?.();
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
  if (event.data && event.data.grupo === "carregarCategoria") {
    const id = event.data.id;
    try {
      const resp = await fetch(`/categoria/apoio/${id}`);
      const dados = await resp.json();
      if (!resp.ok || dados.erro) throw new Error(dados.erro || "Erro ao carregar categoria");

      document.getElementById("id").value = dados.id || "";
      document.getElementById("nome_categoria").value = dados.nome_categoria || "";
      document.getElementById("onde_usa").value = dados.onde_usa || "";
      document.getElementById("tipo_plano").value = dados.tipo_plano || "Ativo";
      document.getElementById("conta_contabil_input").value = dados.desc_conta_contabil || "";
      document.getElementById("id_conta_contabil").value = dados.id_conta_contabil || "";
      const cod = dados.codigo_conta_contabil || "";
      const desc = dados.desc_conta_contabil || "";

      document.getElementById("combo_display").value =
        cod && desc ? `${cod} - ${desc}` : (desc || "Selecione");

      document.getElementById("status").value = String(dados.status);

    } catch (erro) {
      Swal.fire("Erro", "Erro ao carregar dados da categoria.", "error");
    }
  }
});
