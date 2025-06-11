console.log("🟢 Smarketplace.js carregado");

if (typeof window.Marketplace === "undefined") {
    window.Marketplace = {
        async carregar() {
            console.log("🟢 Executando Marketplace.carregar");

            const container = document.getElementById("listaApps");
            const modal = document.getElementById("modalDetalhes");
            if (!container) return;

            // Carrega dados da API
            const apps = await fetch("/marketplace/api").then(res => res.json());
            console.log("📦 Apps recebidos:", apps);

            container.innerHTML = "";
            apps.forEach(app => {
                const card = this.criarCard(app);
                container.appendChild(card);
            });

            document.getElementById("btnFecharModal").onclick = () => {
                modal.style.display = "none";
            };
        },

        criarCard(app) {
            const card = document.createElement("div");
            card.className = "card-app";
            if (app.assinado) card.classList.add("assinado");

            card.innerHTML = `
                <h4>${app.nome_menu}</h4>
                <p>${app.descricao}</p>
                <p><strong>R$ ${app.valor.toFixed(2)}</strong></p>
            `;

            card.addEventListener("click", () => {
                document.getElementById("modalTitulo").innerText = app.nome_menu;
                document.getElementById("modalDescricao").innerText = app.descricao;
                document.getElementById("modalObs").innerText = app.obs || "";
                document.getElementById("modalValor").innerText = app.valor.toFixed(2);
                document.getElementById("btnAssinar").onclick = () => this.assinar(app.id, app.nome_menu);
                document.getElementById("modalDetalhes").style.display = "flex";
            });

            return card;
        },

        async assinar(id_app, nome_modulo) {
            const confirmar = await Swal.fire({
                title: "Confirma a assinatura?",
                html: `Ao confirmar, o módulo <b>${nome_modulo}</b> será liberado imediatamente e a cobrança ocorrerá no próximo ciclo de faturamento.`,
                icon: "question",
                showCancelButton: true,
                confirmButtonText: "Sim, confirmar assinatura",
                cancelButtonText: "Cancelar"
            });

            if (!confirmar.isConfirmed) {
                document.getElementById("modalDetalhes").style.display = "none";
                return;
            }

            const resp = await fetch("/marketplace/assinar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id_modulo: id_app })
            });

            const resultado = await resp.json();
            document.getElementById("modalDetalhes").style.display = "none";

            if (resultado.status === "sucesso") {
                await Swal.fire({
                    title: "✅ Assinatura Confirmada",
                    text: resultado.mensagem,
                    icon: "success"
                });
                location.reload();
            } else {
                Swal.fire("Erro", resultado.mensagem, "error");
            }
        }
    };
}

if (window.Marketplace && typeof window.Marketplace.carregar === "function") {
    window.Marketplace.carregar();
}