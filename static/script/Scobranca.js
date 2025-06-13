// ========================================================================
// 📌 CONTROLE DE ABAS
// ========================================================================
document.querySelectorAll('.tab-button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// ========================================================================
// 📄 ABA: FATURAMENTOS PENDENTES
// ========================================================================

let popupFatura = null;

// 🧠 Preenche competência com mês anterior
(function preencherCompetenciaAnterior() {
  const hoje = new Date();
  hoje.setMonth(hoje.getMonth() - 1);
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  document.getElementById("filtroCompetencia").value = `${ano}-${mes}`;
})();

// 🔎 Buscar pendentes
async function carregarPendentes() {
  const competencia = document.getElementById("filtroCompetencia").value.trim();
  const cliente = document.getElementById("filtroClientePendentes").value.trim();

  if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) {
    Swal.fire("⚠️ Competência obrigatória", "Informe a competência no formato YYYY-MM.", "warning");
    return;
  }

  try {
    const params = new URLSearchParams({ competencia });
    if (cliente) params.append("id_empresa", cliente);

    const resposta = await fetch(`/cobranca/pendentes?${params.toString()}`);
    const pendentes = await resposta.json();
    const tbody = document.getElementById('tbodyPendentes');
    tbody.innerHTML = "";

    if (!pendentes.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="5">✅ Nenhum faturamento pendente.</td>`;
      tbody.appendChild(tr);
      return;
    }

    pendentes.forEach(item => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.nome}</td>
        <td>${item.competencia}</td>
        <td>R$ ${parseFloat(item.valor_estimado || 0).toFixed(2)}</td>
        <td>Pendente</td>
      `;

      const tdAcoes = document.createElement("td");
      const btnGerar = document.createElement("button");
      btnGerar.textContent = "💰 Gerar Fatura";

      btnGerar.addEventListener("click", () => {
        const dadosFatura = {
          id_empresa: item.id_empresa,
          nome_cliente: item.nome,
          competencia: item.competencia,
          valor_estimado: item.valor_estimado
        };

        const url = "/cobranca/fatura_pre";


        if (!popupFatura || popupFatura.closed) {
          popupFatura = window.open(url, "PopupFaturaPre", "width=800,height=500");

          const intervalo = setInterval(() => {
            if (popupFatura && popupFatura.document.readyState === "complete") {
              popupFatura.postMessage(dadosFatura, "*");
              clearInterval(intervalo);
            }
          }, 300);
        } else {
          popupFatura.focus();
          popupFatura.postMessage(dadosFatura, "*");
        }
      });

      tdAcoes.appendChild(btnGerar);
      tr.appendChild(tdAcoes);
      tbody.appendChild(tr);
    });

  } catch (e) {
    console.error("❌ Erro ao buscar pendentes:", e);
    alert("Erro ao buscar faturamentos pendentes.");
  }
}



// 🎯 Botão "Buscar"
document.getElementById("btnBuscarPendentes").addEventListener("click", carregarPendentes);


// 🔁 Carregamento inicial da aba pendentes
document.addEventListener("DOMContentLoaded", carregarPendentes);

// ========================================================================
// 📄 ABA: FATURAS EMITIDAS
// ========================================================================
document.getElementById('btnBuscarFaturas').addEventListener('click', async () => {
  const cliente = document.getElementById('filtroCliente').value;
  const inicio = document.getElementById('filtroInicio').value;
  const fim = document.getElementById('filtroFim').value;
  const status = document.getElementById('filtroStatus').value;

  if (!cliente && !inicio && !fim && !status) {
    Swal.fire("⚠️ Filtros obrigatórios", "Informe ao menos um filtro para pesquisar faturas.", "warning");
    return;
  }

  try {
    const resposta = await fetch("/cobranca/faturas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cliente: cliente,
        data_inicio: inicio,
        data_fim: fim,
        status: status
      })
    });

    const faturas = await resposta.json();
    const tbody = document.getElementById("tbodyFaturas");
    tbody.innerHTML = "";

    if (faturas.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="6">✅ Nenhuma fatura encontrada.</td>`;
      tbody.appendChild(tr);
      return;
    }

    faturas.forEach(f => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${f.nome}</td>
        <td>${formatarCompetencia(f.dt_referencia)}</td>
        <td>R$ ${parseFloat(f.valor_total).toFixed(2)}</td>
        <td>${f.status_pagamento}</td>
        <td>${formatarData(f.vencimento)}</td>
      `;

      const td = document.createElement("td");
      td.appendChild(criarCelulaAcoes(f.id));
      tr.appendChild(td);

      tbody.appendChild(tr);
    });

  } catch (e) {
    console.error("❌ Erro ao buscar faturas:", e);
    alert("Erro ao buscar faturas emitidas.");
  }
});

// ========================================================================
// 🧩 BOTÕES DE AÇÃO (Faturas)
// ========================================================================
function criarCelulaAcoes(idFatura) {
  const container = document.createElement('div');
  container.className = 'acoes-container';

  const btnEditar = document.createElement('button');
  btnEditar.className = 'btn-acao';
  btnEditar.innerHTML = '✏️';
  btnEditar.title = 'Editar Fatura';
  btnEditar.addEventListener('click', () => {
    console.log(`📝 Editar fatura ${idFatura}`);
    // TODO: abrir modal ou redirecionar
  });

  const btnMais = document.createElement('button');
  btnMais.className = 'btn-acao';
  btnMais.innerHTML = '⏷';
  btnMais.title = 'Mais ações';

  const menu = document.createElement('div');
  menu.className = 'menu-dropdown';
  menu.innerHTML = `
    <button onclick="gerarBoleto(${idFatura})">Gerar Boleto</button>
    <button onclick="baixarManual(${idFatura})">Baixa Manual</button>
    <button onclick="emitirNota(${idFatura})">Nota Fiscal</button>
    <button onclick="enviarLembrete(${idFatura})">Lembrete de Vencimento</button>
    <button onclick="reenviarEmail(${idFatura})">Reenviar por E-mail</button>
    <button onclick="cancelarFatura(${idFatura})">Cancelar</button>
  `;

  btnMais.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('show');
  });

  container.appendChild(btnEditar);
  container.appendChild(btnMais);
  container.appendChild(menu);
  return container;
}

// ========================================================================
// 🧩 FUNÇÕES AUXILIARES
// ========================================================================
function formatarCompetencia(dataISO) {
  const [ano, mes] = dataISO.split("-");
  return `${mes}/${ano}`;
}

function formatarData(dataISO) {
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

// ========================================================================
// 🎯 AÇÕES EXTRAS DOS BOTÕES (Placeholders)
// ========================================================================
function gerarBoleto(id) { console.log("Gerar boleto", id); }
function baixarManual(id) { console.log("Baixa manual", id); }
function emitirNota(id) { console.log("Emitir nota fiscal", id); }
function enviarLembrete(id) { console.log("Enviar lembrete", id); }
function reenviarEmail(id) { console.log("Reenviar e-mail", id); }
function cancelarFatura(id) { console.log("Cancelar fatura", id); }

// ========================================================================
// 🧩 CONTROLE DE DROPDOWNS (fechar ao clicar fora)
// ========================================================================
document.addEventListener('click', (e) => {
  document.querySelectorAll('.menu-dropdown').forEach(menu => {
    if (!menu.contains(e.target) && !menu.previousElementSibling?.contains(e.target)) {
      menu.classList.remove('show');
    }
  });
});
