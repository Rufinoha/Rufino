

// ========================================================================
// 🔐 Sessão e Variáveis Globais
// ========================================================================
const usuario = JSON.parse(localStorage.getItem("usuarioLogado") || "{}");
let dadosRecebidos = null;

if (!usuario || !usuario.id_cliente) {
  Swal.fire("⚠️ Sessão expirada", "Faça login novamente.", "warning").then(() => {
    window.location.href = "/login.html";
  });
}

// ========================================================================
// 📄 Carregar Resumo da Fatura
// ========================================================================
async function carregarResumoFatura() {
  try {
    const id_cliente = dadosRecebidos?.id_cliente || usuario.id_cliente;
    const competencia = dadosRecebidos?.competencia;
    document.getElementById("ob_competencia").value = competencia || "";

    const url = `/cobranca/pendentes?id_cliente=${id_cliente}&competencia=${competencia}`;

    const resposta = await fetch(url);
    const dados = await resposta.json();

    if (!dados || dados.length === 0) {
      Swal.fire("📭 Nenhum dado", "Nenhuma assinatura encontrada para esse cliente.", "info");
      return;
    }

    const tbody = document.querySelector("#tabelaResumoFatura tbody");
    const totalEl = document.getElementById("valorTotal");

    tbody.innerHTML = "";
    let valorTotal = 0;

    dados.forEach(modulo => {
      const tr = document.createElement("tr");

      // 🧮 Processamento de datas
      const [rawInicio, rawFim] = modulo.periodo.split(" a ");
      const inicio = new Date(`${rawInicio}T00:00:00`);
      const fim = rawFim ? new Date(`${rawFim}T00:00:00`) : null;


      const inicioFormatado = inicio.toLocaleDateString("pt-BR");
      const fimFormatado = fim ? fim.toLocaleDateString("pt-BR") : "";
      const periodoStr = `${inicioFormatado} a ${fimFormatado} | ${competencia}`;


      const valor = parseFloat(modulo.valor);
      valorTotal += valor;

      tr.innerHTML = `
        <td>${modulo.nome_modulo}</td>
        <td>${periodoStr}</td>
        <td>${valor.toFixed(2)}</td>
      `;
      tbody.appendChild(tr);
    });
    totalEl.textContent = valorTotal.toFixed(2);

    await carregarFormaPagamentoPadrao(id_cliente);



    // 📅 Sugestão de vencimento (15 do mês seguinte à competência)
    const [ano, mes] = competencia.split("-");
    const venc = new Date(parseInt(ano), parseInt(mes), 15);
    document.getElementById("vencimentoInput").value = venc.toISOString().split("T")[0];

  } catch (erro) {
    console.error("❌ Erro ao carregar fatura:", erro);
    Swal.fire("Erro", "Erro ao carregar dados da fatura", "error");
  }
}

// ========================================================================
// 🚀 Inicialização ao carregar a tela
// ========================================================================
window.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (!dadosRecebidos) {
      carregarResumoFatura();
    }
  }, 300);
});

// ========================================================================
// 📨 Recebe dados via postMessage (quando aberto por popup)
// ========================================================================
window.addEventListener("message", (event) => {
  if (event.data && event.data.id_cliente) {
    dadosRecebidos = event.data;
    document.getElementById("ob_idcliente").value = event.data.id_cliente;
    carregarResumoFatura();
  }
});

// ========================================================================
// Confirmação da Fatura
// ========================================================================

document.getElementById("btnConfirmarFatura").addEventListener("click", async () => {
  const confirmacao = await Swal.fire({
    title: "Deseja realmente gerar esta fatura?",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Sim, gerar",
    cancelButtonText: "Cancelar"
  });

  if (!confirmacao.isConfirmed) {
    window.close(); // ❌ Aborta e fecha a janela
    return;
  }

  // 📦 Coleta de dados da tela
  const id_cliente = parseInt(document.getElementById("ob_idcliente")?.value);
  const competencia = document.getElementById("ob_competencia").value.trim();
  const vencimento = document.getElementById("vencimentoInput")?.value;
  

 const valor_total = parseFloat(
  document.getElementById("valorTotal")?.textContent?.replace("R$", "").replace(",", ".") || 0
);

  const forma_pagamento = document.getElementById("formaPagamentoSelect")?.value;
  console.log("🧪 valor_total:", valor_total);
  console.log("🧪 vencimento:", vencimento);
  console.log("🧪 competencia:", competencia);
  console.log("🧪 forma_pagamento:", forma_pagamento);
  console.log("id_cliente:", id_cliente)

  if (!id_cliente || !competencia || !vencimento || !forma_pagamento || isNaN(valor_total)) {
    Swal.fire("Erro", "Todos os campos devem estar preenchidos corretamente.", "error");
    return;
  }

  try {
    const resp = await fetch("/cobranca/gerar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_cliente, competencia, vencimento, valor_total, forma_pagamento })
    });

    const data = await resp.json();

    if (resp.ok && data.status === "sucesso") {
      Swal.fire("✅ Sucesso", data.mensagem, "success").then(() => {
        window.close(); // ✅ Fecha janela após sucesso
      });
    } else {
      Swal.fire("Erro", data.mensagem || "Erro ao gerar fatura.", "error");
    }
  } catch (error) {
    console.error("❌ Erro na requisição:", error);
    Swal.fire("Erro", "Erro inesperado ao enviar os dados.", "error");
  }
});


// ========================================================================
// Botão Cancelar
// ========================================================================
document.getElementById("btnCancelarFatura").addEventListener("click", () => {
  window.history.back();
});




// ========================================================================
// Carregar forma de pagamento padrão
// ========================================================================
async function carregarFormaPagamentoPadrao(id_cliente) {
  try {
    const resposta = await fetch(`/empresa/forma_pagamento?id_cliente=${id_cliente}`);
    const resultado = await resposta.json();

    if (resultado && resultado.forma_pagamento_padrao) {
      const select = document.getElementById("formaPagamentoSelect");
      select.value = resultado.forma_pagamento_padrao;
    }
  } catch (erro) {
    console.error("❌ Erro ao carregar forma de pagamento:", erro);
  }
}





function recalcularTotalFatura() {
  const subtotal = parseFloat(document.getElementById("campoSubTotal").textContent.replace(",", ".")) || 0;
  const desconto = parseFloat(document.getElementById("campoDesconto").value) || 0;
  const acrescimo = parseFloat(document.getElementById("campoAcrescimo").value) || 0;

  const total = Math.max(0, (subtotal - desconto + acrescimo));  // Nunca menor que 0
  document.getElementById("valorTotal").textContent = total.toFixed(2).replace(".", ",");
}
