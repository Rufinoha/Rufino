console.log("Sreem_lancamentos_apoio.js carregado");


// ╔══════════════════════════════════════════════════╗
// ║BLOCO 1 - RECEBENDO DADOS DO PRINCIPAL (postMessage)
// ╚══════════════════════════════════════════════════╝
GlobalUtils.receberDadosApoio(async (id) => {
  console.log("📩 ID recebido via postMessage:", id);

  // Preenche dados básicos da sessão
  const id_empresa = sessionStorage.getItem("id_empresa") || "";
  const id_usuario = sessionStorage.getItem("id_usuario") || "";
  document.getElementById("id_empresa").value = id_empresa;
  document.getElementById("criado_por").value = id_usuario;

  // Carrega categorias do tipo reembolso
  await GlobalUtils.carregarCategorias("reembolso", "id_categoria");

  // ──> BLOCO 3 - TRATATIVA DE ID
  if (id) {
    console.log("🔄 Carregando reembolso com ID:", id);
    await carregarReembolso(id);
    controlarBotaoItens();
  } else {
    console.log("🆕 Modo inclusão: limpando formulário");
    limparFormulario();
    controlarBotaoItens();
  }
});


// ╔══════════════════════════════════════════════════╗
// ║BLOCO 2 - EVENTOS DOS BOTÕES PRINCIPAIS
// ╚══════════════════════════════════════════════════╝
document.addEventListener("DOMContentLoaded", () => {
  console.log("🟢 DOM totalmente carregado.");

  //====================== Botão SALVAR ==========================================
  document.getElementById("ob_btnSalvar")?.addEventListener("click", async () => {
  const dados = {
    id: document.getElementById("id").value || null,
    id_empresa: document.getElementById("id_empresa").value,
    descricao: document.getElementById("descricao").value.trim(),
    data: document.getElementById("data").value,
    id_adiantamento: document.getElementById("id_adiantamento").value || null,
    obs: document.getElementById("obs").value.trim(),
    valor_total: parseFloat((document.getElementById("valor_total").textContent || "0").replace(/\./g, "").replace(",", ".")) || 0.00
  };

  if (!dados.descricao || !dados.data) {
    Swal.fire("Atenção", "Preencha todos os campos obrigatórios.", "warning");
    return;
  }

  const status = document.getElementById("statusBadge")?.textContent?.trim()?.toLowerCase();
  if (dados.id_reembolso && status !== "Aberto") {
    Swal.fire("Atenção", "Só é possível editar quando o status for 'Aberto'.", "info");
    return;
  }

  try {
    const resp = await fetch("/reembolso/salvar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados)
    });

    const json = await resp.json();

    if (resp.ok && json.id) {
      document.getElementById("id").value = json.id;
      controlarBotaoItens();
      Swal.fire("Sucesso", json.mensagem || "Reembolso salvo.", "success");
      window.opener?.postMessage({ grupo: "reembolsoalva" }, "*");
    } else {
      throw new Error(json.erro || "Erro ao salvar");
    }
  } catch (err) {
    Swal.fire("Erro", err.message, "error");
  }
});




  //======================  Botão INCLUIR NOTAS (antigo incluir itens) ====================== 
  document.getElementById("btnNovoItem")?.addEventListener("click", () => {
    const idField = document.getElementById("id");
    const id = idField ? idField.value : null;

    if (!id) {
      Swal.fire("Atenção", "Salve o reembolso antes de incluir itens.", "info");
      return;
    }

    window.open(`/reembolso/item/incluir?id_reembolso=${id}`, "_blank", "width=900,height=650");
  });




  // ====================== Botão EXCLUIR ======================
  document.getElementById("ob_btnExcluir")?.addEventListener("click", async () => {
    const id = document.getElementById("id").value;
    if (!id) return;

    const confirm = await Swal.fire({
      title: "Excluir?",
      text: "Essa ação não pode ser desfeita.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sim, excluir",
      cancelButtonText: "Cancelar"
    });

    if (!confirm.isConfirmed) return;

    try {
      const resp = await fetch("/reembolso/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });

      const json = await resp.json();

      if (resp.ok && json.status === "sucesso") {
        await Swal.fire("Excluído", "Reembolso removido com sucesso.", "success");

        // Atualiza o principal (se função estiver acessível)
        window.parent?.postMessage({ grupo: "carregarDados", fecharModal: true }, "*");


      } else {
        throw new Error(json.erro || "Erro ao excluir");
      }
    } catch (err) {
      Swal.fire("Erro", err.message, "error");
    }
  });



  // ======================  Botão IMPRIMIR ======================
  // document.getElementById("btnImprimir")?.addEventListener("click", () => {
  //   ...
  // });
});


// ╔══════════════════════════════════════════════════╗
// ║BLOCO 3 - FUNÇÕES DE TRATAMENTO DE ID
// ╚══════════════════════════════════════════════════╝
function limparFormulario() {
  document.querySelectorAll("#formreembolso input, #formreembolso select, #formreembolso textarea").forEach(el => {
    if (el.type !== "hidden") el.value = "";
  });
  document.getElementById("valor_total").textContent = "0,00";
}

async function carregarReembolso(id) {
  console.log("📦 Chamando rota /reembolso/apoio/" + id);
  try {
    const resp = await fetch(`/reembolso/apoio/${id}`);
    if (!resp.ok) throw new Error("Erro ao carregar dados");

    const dados = await resp.json();
    console.log("📝 Dados carregados do backend:", dados);

    for (const campo in dados) {
      const el = document.getElementById(campo);
      if (el) {
        if (el.type === "date" && dados[campo]) {
          el.value = new Date(dados[campo]).toISOString().split("T")[0];
        } else {
          el.value = dados[campo] ?? "";
        }
      }
    }

    // -> BLOCO 4 - TRATATIVA DO VALOR TOTAL
    if (dados.valor_total !== undefined) {
      const valor = parseFloat(dados.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
      document.getElementById("valor_total").textContent = valor;
    }

    // Auditoria
    if (dados.criado_nome && dados.criado_em) {
      preencherAuditoria(dados.criado_nome, dados.criado_em);
    }

    // Define ID
    document.getElementById("id").value = dados.id_reembolso;

    // -> BLOCO 5 - TRATATIVA DAS CORES DO STATUS
    const statusEl = document.getElementById("statusBadge");
    if (statusEl && dados.status) {
      const status = dados.status.trim().toLowerCase();
      statusEl.textContent = dados.status;
      statusEl.className = "status-badge";
      switch (status) {
        case "aberto": statusEl.classList.add("status-aberto"); break;
        case "retornado":
        case "retornado ao solicitante": statusEl.classList.add("status-retornado"); break;
        case "rejeitado": statusEl.classList.add("status-rejeitado"); break;
        case "aprovado": statusEl.classList.add("status-aprovado"); break;
        case "finalizado": statusEl.classList.add("status-finalizado"); break;
        default: statusEl.classList.add("status-desconhecido"); break;
      }
    }

    reembolsoItens.carregar();

  } catch (err) {
    console.error("❌ Erro ao carregar reembolso:", err);
    Swal.fire("Erro", "Não foi possível carregar os dados.", "error");
  }
}



// ╔══════════════════════════════════════════════════╗
// ║FUNÇÕES COMPLEMENTARES
// ╚══════════════════════════════════════════════════╝

function preencherAuditoria(nome, dataHora) {
  try {
    const dt = new Date(dataHora);
    const data = dt.toLocaleDateString("pt-BR");
    const hora = dt.toLocaleTimeString("pt-BR").slice(0, 5);
    document.getElementById("rodapeAuditoria").textContent = `Criado por ${nome} em ${data} às ${hora}`;
  } catch (e) {
    console.warn("Erro ao formatar data/hora da auditoria", dataHora);
  }
}

function controlarBotaoItens() {
  const btn = document.getElementById("btnNovoNotas");
  const id = document.getElementById("id").value;

  if (id) {
    btn.disabled = false;
    btn.classList.remove("disabled");
  } else {
    btn.disabled = true;
    btn.classList.add("disabled");
  }
}



// ╔══════════════════════════════════════════════════╗
// ║ ITENS DA TABELA DE REEMBOLSO
// ╚══════════════════════════════════════════════════╝
const reembolsoItens = {
  async carregar() {
    const id_reembolso = document.getElementById("id")?.value;
    const usuario = GlobalUtils.getUsuarioLogado();
    const id_empresa = usuario?.id_empresa;

    console.log("🔎 Carregando itens com:", { id_reembolso, id_empresa });

    if (!id_reembolso || !id_empresa) {
      console.warn("⚠️ ID do reembolso ou empresa não informado.");
      return;
    }

    try {
      const resp = await fetch(`/reembolso/item/dados?id_reembolso=${id_reembolso}&id_empresa=${id_empresa}`);
      if (!resp.ok) throw new Error("Erro na requisição dos itens");

      const dados = await resp.json();
      console.log("📦 Itens recebidos:", dados);

      const tbody = document.getElementById("listaItens");
      tbody.innerHTML = "";

      if (!dados.length) {
        tbody.innerHTML = `<tr><td colspan="8">Nenhum item incluído.</td></tr>`;
        return;
      }

      dados.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${item.id}</td>
          <td>${item.data ? Util.formatarData(item.data) : ""}</td>
          <td>${item.descricao}</td>
          <td>${item.nome_categoria || "-"}</td>
          <td>${item.razao_social_emitente || "-"}</td>
          <td>${item.forma_pagamento || "-"}</td>
          <td>R$ ${parseFloat(item.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
          <td>
            <button class="btn-icon btnEditarItem" data-id="${item.id}" title="Editar">
              ${Util.gerarIconeTech('editar')}
            </button>
            <button class="btn-icon btnExcluirItem" data-id="${item.id}" title="Excluir">
              ${Util.gerarIconeTech('excluir')}
            </button>
            <a class="btn-icon" href="${item.anexo_nota}" target="_blank" title="Ver anexo">
              ${Util.gerarIconeTech('anexo')}
            </a>
          </td>
        `;
        tbody.appendChild(tr);
      });
      lucide.createIcons();

    } catch (err) {
      console.error("❌ Erro ao carregar itens:", err);
      Swal.fire("Erro", "Falha ao carregar os itens do reembolso.", "error");
    }
  }
};


