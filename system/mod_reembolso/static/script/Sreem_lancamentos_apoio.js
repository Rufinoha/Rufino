console.log("Sreem_lancamentos_apoio.js carregado");


// ╔══════════════════════════════════════════════════╗
// ║BLOCO 1 - RECEBENDO DADOS DO PRINCIPAL (postMessage)
// ╚══════════════════════════════════════════════════╝
GlobalUtils.receberDadosApoio(async (id) => {

  // Preenche dados básicos da sessão
  const id_empresa = sessionStorage.getItem("id_empresa") || "";
  const id_usuario = sessionStorage.getItem("id_usuario") || "";
  document.getElementById("id_empresa").value = id_empresa;
  document.getElementById("criado_por").value = id_usuario;

  // Carrega categorias do tipo reembolso
  await GlobalUtils.carregarCategorias("reembolso", "id_categoria");

  // ──> BLOCO 3 - TRATATIVA DE ID
  if (id) {
    await carregarReembolso(id);
    controlarBotaoItens();
  } else {
    limparFormulario();
    controlarBotaoItens();
  }
});


// ╔══════════════════════════════════════════════════╗
// ║BLOCO 2 - EVENTOS DOS BOTÕES PRINCIPAIS
// ╚══════════════════════════════════════════════════╝
document.addEventListener("DOMContentLoaded", () => {

  //====================== Botão SALVAR ==========================================
  document.getElementById("ob_btnSalvar")?.addEventListener("click", async () => {
    const dados = {
      id:               document.getElementById("id").value || null,
      id_empresa:       document.getElementById("id_empresa").value,
      descricao:        document.getElementById("descricao").value.trim(),
      data:             document.getElementById("data").value,
      id_adiantamento:  document.getElementById("id_adiantamento").value || null,
      obs:              document.getElementById("obs").value.trim(),
      valor_total:      parseFloat((document.getElementById("valor_total").textContent || "0").replace(/\./g, "").replace(",", ".")) || 0.00
    };

    if (!dados.descricao || !dados.data) {
      Swal.fire("Atenção", "Preencha todos os campos obrigatórios.", "warning");
      return;
    }

    // Só valida status quando for EDIÇÃO (id preenchido)
    if (dados.id) {
      const badgeEl     = document.getElementById("statusBadge");
      const statusAtual = (badgeEl?.dataset.status || badgeEl?.textContent || "").trim().toUpperCase();
      const permitidos  = ["ABERTO", "PENDENTE", "RETORNADO"];
      if (!permitidos.includes(statusAtual)) {
        Swal.fire("Atenção", "Este reembolso não pode ser salvo no status atual.", "info");
        return;
      }
    }

    try {
      const resp = await fetch("/reembolso/lanc/salvar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados)
      });
      const json = await resp.json();

      if (!resp.ok || !json.id) throw new Error(json.erro || "Erro ao salvar");

      // Atualiza ID no form
      document.getElementById("id").value = json.id;

      // Inclusão: após salvar, mostra "Aberto" no badge
      if (!dados.id) {
        const badge = document.getElementById("statusBadge");
        if (badge) {
          badge.textContent    = "Aberto";
          badge.dataset.status = "ABERTO";
          badge.className      = "status-badge status-aberto";
        }
      }

      controlarBotaoItens();
      Swal.fire("Sucesso", json.mensagem || "Reembolso salvo.", "success");
      window.opener?.postMessage({ grupo: "reembolsoalva" }, "*");
    } catch (err) {
      Swal.fire("Erro", err.message || "Falha ao salvar.", "error");
    }
  });








  //======================  Botão INCLUIR NOTAS (antigo incluir itens) ====================== 
  document.getElementById("btnNovoNotas")?.addEventListener("click", () => {
    const id = document.getElementById("id")?.value?.trim();

    if (!id) {
      Swal.fire("Atenção", "Salve o reembolso antes de incluir notas.", "info");
      return;
    }

    // 🔑 chama no host (pai) para empilhar sobre o modal atual
    const Host = (window.parent && window.parent.GlobalUtils)
      ? window.parent.GlobalUtils
      : window.GlobalUtils;

    Host.abrirJanelaApoioModal({
      rota: "/reembolso/nota/incluir",
      titulo: "Incluir Nota",
      largura: 900,
      altura: 650,
      nivel: 2                 // empilha sobre o nível 1
    });
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
  try {
    const resp = await fetch(`/reembolso/lanc/apoio/${id}`);
    if (!resp.ok) throw new Error("Erro ao carregar dados");

    const dados = await resp.json();

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
  const btn = document.getElementById("btnNovoNotas"); // ou btnNovonota
  const id  = document.getElementById("id").value;
  if (!btn) return;

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
    try {
      // pegue do DOM (ou do localStorage como fallback)
      const id_reembolso = document.getElementById("id")?.value;
      const id_empresa   = document.getElementById("id_empresa")?.value
                        || window.Util?.localstorage("id_empresa", 0);

      if (!id_reembolso) {
        // sem ID ainda (novo registro não salvo)
        const tbody = document.getElementById("listaItens");
        if (tbody) tbody.innerHTML = `<tr><td colspan="8">Nenhum nota incluído.</td></tr>`;
        return;
      }

      // id_empresa NÃO é necessário para o back (ele usa a sessão),
      // mas deixei se você quiser logar/inspecionar.
      const url = `/reembolso/nota/dados?id_reembolso=${encodeURIComponent(id_reembolso)}`;

      const resp = await fetch(url, { credentials: "include" });
      if (!resp.ok) throw new Error("Erro na requisição dos itens");

      const dados = await resp.json();

      const tbody = document.getElementById("listaItens");
      tbody.innerHTML = "";

      if (!Array.isArray(dados) || !dados.length) {
        tbody.innerHTML = `<tr><td colspan="8">Nenhum nota incluído.</td></tr>`;
        return;
      }

      dados.forEach(nota => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${nota.id}</td>
          <td>${nota.data ? (window.Util?.formatarData?.(nota.data) || nota.data) : ""}</td>
          <td>${nota.descricao || "-"}</td>
          <td>${nota.nome_categoria || "-"}</td>
          <td>${nota.razao_social_emitente || "-"}</td>
          <td>${nota.forma_pagamento || "-"}</td>
          <td>R$ ${parseFloat(nota.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
          <td>
            <button class="btn-icon btnEditarnota" data-id="${nota.id}" title="Editar">
              ${window.Util?.gerarIconeTech?.('editar') || ''}
            </button>
            <button class="btn-icon btnExcluirnota" data-id="${nota.id}" title="Excluir">
              ${window.Util?.gerarIconeTech?.('excluir') || ''}
            </button>
            ${nota.anexo_nota ? `
              <a class="btn-icon" href="${nota.anexo_nota}" target="_blank" title="Ver anexo">
                ${window.Util?.gerarIconeTech?.('anexo') || ''}
              </a>` : ``}
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



 