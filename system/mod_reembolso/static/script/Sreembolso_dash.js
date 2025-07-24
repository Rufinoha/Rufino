console.log("Sreembolso_dash.js - Script de Inicialização do Módulo de reembolso");

(async function () {
  console.log("Sreembolso_dash.js - Script de Inicialização do Módulo de reembolso");

  await carregarResumoreembolso();
  desenharGraficoreembolso();
})();


async function carregarResumoreembolso() {
  try {
    const res = await fetch("/reembolso/dashboard/resumo");
    const data = await res.json();

    // 🔐 Proteção contra campos indefinidos ou nulos
    const total = typeof data.total_mes === "number" ? data.total_mes : 0;
    const pendentes = Number.isInteger(data.pendentes) ? data.pendentes : 0;
    const caixinha = typeof data.saldo_caixinha === "number" ? data.saldo_caixinha : 0;
    const enviadas = Number.isInteger(data.total_enviadas) ? data.total_enviadas : 0;
    const retornadas = Number.isInteger(data.retornadas) ? data.retornadas : 0;



  } catch (error) {
    console.error("❌ Erro ao carregar dados de resumo:", error);
  }
}

function desenharGraficoreembolso() {
  const ctx = document.getElementById('grafico-reembolso');
  if (!ctx) {
    console.warn("❌ Canvas 'grafico-reembolso' não encontrado");
    return;
  }

  new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['Transporte', 'Alimentação', 'Hospedagem', 'Outros'],
      datasets: [{
        label: 'reembolso por categoria',
        data: [15000, 12000, 10000, 5400],
        backgroundColor: ['#85C300', '#6FA700', '#ccc', '#bbb']
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } }
    }
  });
}


function formatarMoeda(valor) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(valor);
}



// ------------------------------
// CARREGAR PÁGINA DINAMICAMENTE
// ------------------------------


document.querySelectorAll('[data-link]').forEach(el => {
  el.addEventListener('click', () => {
    const page = el.getAttribute('data-page');
    if (page) GlobalUtils.carregarPagina(page);
  });
});
