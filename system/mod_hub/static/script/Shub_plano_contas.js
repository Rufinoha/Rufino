console.log("Splano_contas.js carregado");

if (typeof window.planocontas === "undefined") {
    // Registra na mesma chave o mount/unmount criado pelo carregador Global de HTML que esta no global
    (function (s) {
    const pageKey = s.getAttribute('data-page-script'); 

    async function mount(root, ctx, scope) {
        // sua lógica (se quiser, pode continuar rodando código no topo do arquivo;
        // o Global já captura e vai limpar tudo ao sair)
    }

    function unmount() {
        // opcional — o Global já limpa eventos/timers/fetch/observers/Chart
    }

    GlobalUtils.registerPage(pageKey, { mount, unmount });
    })(document.currentScript);

  window.planocontas = {
    dados: [], 

    configurarEventos: function () {
        // Evento do botão de busca
        document.querySelector("#btnBuscar")?.addEventListener("click", () => {
            this.carregar();
        });

        // Verifica se existe plano cadastrado
        (async () => {
            try {
            const res = await fetch("/plano_contas/existe");
            const json = await res.json();

            const btnCriar = document.querySelector("#btnCriarPlanoPadrao");
            if (!json.existe) {
                btnCriar.style.display = "inline-block";

                btnCriar.addEventListener("click", async () => {
                btnCriar.disabled = true;
                btnCriar.textContent = "Criando...";

                try {
                    const resCriar = await fetch("/cadastro/planocontas", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" }
                    });

                    if (!resCriar.ok) throw new Error("Erro ao criar plano");

                    await Swal.fire(
                    "Plano de contas criado",
                    "Foi criado um plano de contas padrão a sua empresa com sucesso. Esse plano pode ser modificado conforme suas necessidades.",
                    "success"
                    );

                    btnCriar.style.display = "none";
                    planocontas.carregar();
                } catch (erro) {
                    console.error("Erro ao criar plano:", erro);
                    Swal.fire("Erro", "Não foi possível criar o plano de contas.", "error");
                    btnCriar.disabled = false;
                    btnCriar.textContent = "Criar Plano Padrão";
                }
                });
            }
            } catch (erro) {
            console.error("Erro ao verificar existência do plano:", erro);
            }
        })();

        // Carrega automaticamente ao iniciar
        lucide.createIcons();
        this.carregar();
    },

    carregar: async function () {
      const tipo = document.querySelector("#tipoConta")?.value;
      if (!tipo) return;

      try {
        const res = await fetch(`/plano_contas/dados?tipo=${encodeURIComponent(tipo)}`);
        const json = await res.json();
        this.dados = json.dados || [];
        this.renderizar();
      } catch (erro) {
        console.error("Erro ao carregar plano de contas:", erro);
        document.querySelector("#arvorePlanoContas").innerHTML = `<div>Erro ao carregar dados.</div>`;
      }
    },

    renderizar: function () {
        const container = document.querySelector("#arvorePlanoContas");
        container.innerHTML = "";

        // Agrupa por nível e monta estrutura
        const map = {};
        this.dados.forEach(item => {
            item.children = [];
            map[item.codigo] = item;
        });

        const raiz = [];

        this.dados.forEach(item => {
            const partes = item.codigo.split(".");
            if (partes.length === 1) {
            raiz.push(item);
            } else {
            const pai = map[partes.slice(0, -1).join(".")];
            if (pai) pai.children.push(item);
            }
        });

        function criarItem(item, nivel = 0) {
            const div = document.createElement("div");
            div.className = "item-conta nivel-" + nivel + (item.status ? "" : " inativo");
            div.dataset.codigo = item.codigo;

            const linha = document.createElement("div");
            linha.className = "linha-item";

            const spanToggle = document.createElement("span");

            if (item.children.length > 0) {
                spanToggle.className = "toggle";
                spanToggle.innerHTML = Util.gerarIconeTech('menos');
                spanToggle.style.cursor = "pointer";
            } else {
                spanToggle.innerHTML = " "; // espaço em branco
            }

            const spanTexto = document.createElement("span");
            spanTexto.textContent = ` ${item.codigo} ${item.descricao}`;
            spanTexto.className = "descricao";

            const acoes = document.createElement("div");
            acoes.className = "acoes";
            acoes.innerHTML = `
                <button class="btn_acao" onclick="planocontas.editar(this)">
                    ${Util.gerarIconeTech('editar')}
                </button>
                <button class="btn_acao" onclick="planocontas.incluir(this)">
                    ${Util.gerarIconeTech('adicionar')}
                </button>
                <button class="btn_acao" onclick="planocontas.ocultar(this)">
                    ${Util.gerarIconeTech('visualizar')}
                </button>
            `;

            linha.appendChild(spanToggle);
            linha.appendChild(spanTexto);
            linha.appendChild(acoes);
            div.appendChild(linha);

            if (item.children.length) {
                const subContainer = document.createElement("div");
                subContainer.className = "sub-itens";

                item.children.forEach((filho, index, array) => {
                    const filhoElemento = criarItem(filho, nivel + 1);
                    if (index === array.length - 1) filhoElemento.classList.add("ultimo-filho");
                    subContainer.appendChild(filhoElemento);
                });

                div.appendChild(subContainer);

                spanToggle.addEventListener("click", () => {
                    const fechado = subContainer.classList.toggle("fechado");
                    // renderiza de novo usando o MAPA TECH -> Lucide
                    spanToggle.innerHTML = Util.gerarIconeTech(fechado ? 'mais' : 'menos');
                    try { lucide.createIcons(); } catch {}
                });

            }

            return div;
        }


        raiz.forEach(top => {
            container.appendChild(criarItem(top));
        });

        lucide.createIcons();
    },


    editar: function (btn) {
        const linha = btn.closest(".linha-item");
        const container = linha.parentElement;
        const spanTexto = linha.querySelector(".descricao");
        const codigo = container.dataset.codigo;

        if (linha.querySelector("input")) return;

        const descricaoAtual = spanTexto.textContent.trim().replace(codigo, "").trim();
        const input = document.createElement("input");
        input.className = "input-inline";
        input.value = descricaoAtual;

        // Botões
        const btnSalvar = document.createElement("button");
        btnSalvar.innerHTML = Util.gerarIconeTech('salvar');
        btnSalvar.className = "btn_acao_editado";

        const btnCancelar = document.createElement("button");
        btnCancelar.innerHTML = Util.gerarIconeTech('cancelar');
        btnCancelar.className = "btn_acao_editado";


        // Oculta todos os botões da linha atual
        const acoes = linha.querySelector(".acoes");
        const botoesOriginais = Array.from(acoes.children);
        botoesOriginais.forEach(b => b.style.display = "none");

        // Remove edição de outros
        document.querySelectorAll(".item-conta.editando").forEach(el => el.classList.remove("editando"));
        container.classList.add("editando");
        document.body.classList.add("editando-ativa");


        // Substitui o texto pelo input
        spanTexto.replaceWith(input);
        acoes.appendChild(btnSalvar);
        acoes.appendChild(btnCancelar);
        input.focus();

        // Eventos
        btnSalvar.addEventListener("click", async () => {
            const novaDescricao = input.value.trim();
            if (!novaDescricao) {
            Swal.fire("Aviso", "Descrição não pode estar vazia.", "warning");
            return;
            }

            if (novaDescricao === descricaoAtual) {
            cancelar();
            return;
            }

            try {
            const res = await fetch("/plano_contas/editar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ codigo, descricao: novaDescricao })
            });

            if (!res.ok) throw new Error("Erro ao salvar");

            const novoSpan = document.createElement("span");
            novoSpan.textContent = `${codigo} ${novaDescricao}`;
            novoSpan.className = "descricao";
            input.replaceWith(novoSpan);
            finalizar(novoSpan);
            } catch (err) {
            console.error("Erro ao salvar:", err);
            Swal.fire("Erro", "Não foi possível salvar.", "error");
            }
        });

        btnCancelar.addEventListener("click", () => {
            cancelar();
        });

        function cancelar() {
            const spanRestaurado = document.createElement("span");
            spanRestaurado.textContent = `${codigo} ${descricaoAtual}`;
            spanRestaurado.className = "descricao";
            input.replaceWith(spanRestaurado);
            finalizar(spanRestaurado);
        }

        function finalizar(novoSpan) {
            btnSalvar.remove();
            btnCancelar.remove();
            botoesOriginais.forEach(b => b.style.display = "inline-block");
            container.classList.remove("editando");
            document.body.classList.remove("editando-ativa");

        }
        lucide.createIcons();
    },



    incluir: function (btn) {
        const container = btn.closest(".item-conta");
        const codigoPai = container.dataset.codigo;

        //Remove outras inclusões abertas, se houver
        document.querySelectorAll(".item-conta.editando").forEach(el => el.remove());

        //Calcula o próximo código sequencial
        const filhos = Array.from(container.querySelectorAll(".item-conta"));
        const codigosFilhos = filhos.map(f => f.dataset.codigo).filter(c => c?.startsWith(codigoPai + "."));
        let maior = 0;

        codigosFilhos.forEach(cod => {
            const partes = cod.split(".");
            const ultimo = parseInt(partes[partes.length - 1], 10);
            if (!isNaN(ultimo) && ultimo > maior) maior = ultimo;
        });

        const proximoCodigo = codigoPai + "." + String(maior + 1).padStart(2, "0");

        //Cria os elementos da nova linha
        const novaDiv = document.createElement("div");
        novaDiv.className = "item-conta editando";
        novaDiv.dataset.codigo = proximoCodigo;

        const novaLinha = document.createElement("div");
        novaLinha.className = "linha-item";

        const placeholderToggle = document.createElement("span");
        placeholderToggle.style.width = "18px"; // espaço do toggle

        const input = document.createElement("input");
        input.className = "input-inline novo";
        input.placeholder = "Nova conta...";

        const btnSalvar = document.createElement("button");
        btnSalvar.innerHTML = Util.gerarIconeTech('salvar');
        btnSalvar.className = "btn_acao_editado";

        const btnCancelar = document.createElement("button");
        btnCancelar.innerHTML = Util.gerarIconeTech('cancelar');
        btnCancelar.className = "btn_acao_editado";


        novaLinha.appendChild(placeholderToggle);
        novaLinha.appendChild(input);
        novaLinha.appendChild(btnSalvar);
        novaLinha.appendChild(btnCancelar);

        novaDiv.appendChild(novaLinha);

        //Verifica se existe o container de sub-itens, senão cria
        let subContainer = container.querySelector(".sub-itens");
        if (!subContainer) {
            subContainer = document.createElement("div");
            subContainer.className = "sub-itens";
            container.appendChild(subContainer);
        }

        subContainer.appendChild(novaDiv);
        input.focus();

        //Eventos
        btnSalvar.addEventListener("click", async () => {
            const descricao = input.value.trim();
            if (!descricao) {
                Swal.fire("Aviso", "Informe uma descrição.", "warning");
                return;
            }

            try {
                const planoSelect = document.querySelector("#tipoConta");
                const plano = planoSelect ? planoSelect.value : null;

                const res = await fetch("/plano_contas/incluir", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        codigo_pai: codigoPai,
                        descricao: descricao,
                        plano: plano
                    })
                });

                if (!res.ok) throw new Error("Erro ao salvar");

                // Recarrega tudo após inclusão
                planocontas.carregar();
            } catch (err) {
                console.error("Erro ao incluir:", err);
                Swal.fire("Erro", "Não foi possível incluir a conta.", "error");
            }
        });

        btnCancelar.addEventListener("click", () => {
            novaDiv.remove();
        });
        lucide.createIcons();
    },




    ocultar: function (btn) {
      const container = btn.closest(".item-conta");
      const codigo = container.dataset.codigo;

      fetch("/plano_contas/ocultar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo })
      }).then(() => {
        container.classList.toggle("inativo");
      });
      lucide.createIcons();
    }
  };

  // 🚀 Executar ao carregar
  window.planocontas.configurarEventos();
}

window.planocontas.configurarEventos?.();

