console.log("schub.js carregado");

function inicializarGraficosHub() {
    if (typeof Chart === "undefined") return;
    const ctxPizza = document.getElementById("graficoPizza");
    const ctxLinha = document.getElementById("graficoLinha");
    const ctxBarra = document.getElementById("graficoBarra");

    if (!ctxPizza || !ctxLinha || !ctxBarra) {
        console.warn("Algum canvas não encontrado.");
        return;
    }

    new Chart(ctxPizza, {
        type: 'pie',
        data: {
            labels: ["Contas", "Categorias", "Favorecidos"],
            datasets: [{
                data: [154, 23, 12],
                backgroundColor: ["#85C300", "#6FA700", "#ccc"]
            }]
        }
    });

    new Chart(ctxBarra, {
        type: 'bar',
        data: {
            labels: ["Jan", "Fev", "Mar", "Abr"],
            datasets: [{
                label: "Registros por Mês",
                data: [40, 55, 72, 61],
                backgroundColor: "#85C300"
            }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });

    new Chart(ctxLinha, {
        type: 'line',
        data: {
            labels: ["Jan", "Fev", "Mar", "Abr"],
            datasets: [{
                data: [10, 30, 50, 80],
                borderColor: "#333",
                tension: 0.4
            }]
        },
        options: { responsive: true }
    });
}
inicializarGraficosHub();
