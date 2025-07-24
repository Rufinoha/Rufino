// ---------------------------------------------------------------
// -----------------------ETAPA 1: AUTENTICAÇÃO E SESSÃO----------
// ---------------------------------------------------------------

(function verificarLogin() {
  const usuario = JSON.parse(localStorage.getItem("usuarioLogado") || "{}");

  if (!usuario || !usuario.id_usuario) {
    Swal.fire("Sessão encerrada", "Faça login novamente.", "warning").then(() => {
      window.location.href = "/login.html";
    });
  } else {
    window.App = {
      Varid: usuario.id_usuario,
      Varnome: usuario.nome,
      Varemail: usuario.email,
      Varimagem: usuario.imagem,
      Varid_empresa: usuario.id_empresa,
    };
  }
})();
 
(function iniciarControleSessao() {
  setInterval(() => {
    window.GlobalUtils.verificarSessaoExpirada();
  }, 30000);
})();



// ---------------------------------------------------------------
// -----------------------ETAPA 2: MENU HORIZONTAL----------------
// ---------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  carregarUsuarioLogado();
  configurarMenuUsuario();
  configurarPin();
  carregarMenu("lateral");
  carregarMenu("horizontal");
  configurarNovidades();
  verificarNovidadesBadge();

});

// 🧑‍💼 Dados do usuário logado
function carregarUsuarioLogado() {
  const usuario = JSON.parse(localStorage.getItem("usuarioLogado") || "{}");

  const nome = usuario?.nome?.split(" ")[0] || "Usuário";


  // Aqui pega o nome fantasia da empresa (campo nome da tbl_hub_favorecido)
  const empresaFantasia = usuario?.nome_empresa?.trim();
  const empresaRazao = usuario?.razao_social_empresa?.trim();
  const empresa = empresaFantasia !== "" ? empresaFantasia : (empresaRazao || "Empresa");

  const imagem = usuario?.imagem || "userpadrao.png";

  document.getElementById("usuarioNome").textContent = nome;
  document.getElementById("usuarioEmpresa").textContent = empresa;
  document.getElementById("iconeUsuario").src = `/static/imge/imguser/${imagem}`;
}




// 🔽 Submenu do usuário
function configurarMenuUsuario() {
  const btn = document.getElementById("btnUsuarioToggle");
  const menuBox = document.querySelector(".menu-usuario");
  const menuSub = document.getElementById("submenuUsuario");

  btn.addEventListener("click", () => {
    menuBox.classList.toggle("active");

    if (menuBox.classList.contains("active")) {
      carregarMenuHorizontalUsuario();
    }
  });

  menuSub.querySelectorAll("a[data-page]").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const pagina = e.target.getAttribute("data-page");
      GlobalUtils.carregarPagina(pagina);
    });
  });

  document.getElementById("btnsair").addEventListener("click", (e) => {
    e.preventDefault();
    Swal.fire({
      icon: "question",
      title: "Deseja sair?",
      text: "Sua sessão será encerrada.",
      showCancelButton: true,
      confirmButtonText: "Sim, sair",
      cancelButtonText: "Cancelar"
    }).then((result) => {
      if (result.isConfirmed) {
        fetch("/logout", { method: "POST" })
          .then(() => {
            localStorage.removeItem("usuarioLogado");
            window.location.href = "/login";
          });
      }
    });
  });
}



function fecharTodosSubmenus() {
  // Fecha submenus com animação (opcional)
  document.querySelectorAll(".submenu.aberto").forEach(sub => {
    sub.classList.remove("aberto");
    sub.style.display = "none";
  });

  // Fecha também o menu do usuário (horizontal)
  document.querySelector(".menu-usuario")?.classList.remove("active");
}


// ---------------------------------------------------------------
// -----------------------ETAPA 3: MENU LATERAL--------------------
// ---------------------------------------------------------------

function configurarPin() {
  const btnPin = document.getElementById("btnPinMenu");
  const menuLateral = document.getElementById("menuLateral");
  const icone = document.getElementById("iconePin");

   //Sempre iniciar expandido, a menos que o usuário tenha retraído manualmente
  const estadoSalvo = localStorage.getItem("menuLateralEstado") || "expandido";

  if (estadoSalvo === "expandido") {
    menuLateral.classList.add("expandido");
    menuLateral.classList.remove("retraido");
    icone.src = window.Paths.pinFincado;
    btnPin.classList.add("pin-fincado");
  } else {
    menuLateral.classList.add("retraido");
    menuLateral.classList.remove("expandido");
    icone.src = window.Paths.pinSolto;
    btnPin.classList.remove("pin-fincado");
  }


  btnPin.addEventListener("click", () => {
    const estaExpandido = menuLateral.classList.contains("expandido");

    if (estaExpandido) {
      menuLateral.classList.remove("expandido");
      menuLateral.classList.add("retraido");
      icone.src = window.Paths.pinSolto;
      btnPin.classList.remove("pin-fincado");

      // 🔒 Fechar todos os submenus ao retrair
      document.querySelectorAll("#listaMenus .submenu").forEach(ul => {
        ul.style.display = "none";
      });

    } else {
      menuLateral.classList.remove("retraido");
      menuLateral.classList.add("expandido");
      icone.src = window.Paths.pinFincado;
      btnPin.classList.add("pin-fincado");
    }

    localStorage.setItem("menuLateralEstado", menuLateral.classList.contains("expandido") ? "expandido" : "retraido");
  });
}





// 🔁 Função que carrega o menu pela posição
function carregarMenu(posicao) {
    fetch(`/menu/${posicao}`, {
        method: "GET",
        credentials: "include"  // ⬅️ ESSENCIAL para manter a sessão
    })
    .then(res => res.json())
        .then(dados => {
            if (dados.erro) {
                console.warn(`Erro ao carregar menu ${posicao}:`, dados.erro);
                return;
            }
            renderizarMenu(dados, posicao);
        })
        .catch(err => console.error(`Erro ao buscar menu ${posicao}:`, err));
}

// 🧱 Renderiza o menu no local correto
function renderizarMenu(itens, posicao) {
    const container = document.getElementById(`menu-${posicao}`);
    if (!container) return;

    let html = "";
    const menusPrincipais = itens.filter(m => !m.parent_id);
    menusPrincipais.forEach(menu => {
        const submenus = itens.filter(s => s.parent_id === menu.id);
        const icone = menu.icone ? `${menu.icone} ` : ""; // emoji já vem pronto!

        if (submenus.length > 0) {
            html += `
                <div class="menu-item com-submenu">
                    <div class="menu-principal" data-toggle>
                        ${icone}<span>${menu.nome_menu}</span>
                    </div>
                    <div class="submenu">
                        ${submenus.map(sm => `
                            <div class="submenu-item"
                              data-link="${sm.rota}"
                              data-page="${sm.data_page}"
                              data-tipo="${sm.tipo_abrir}">
                                ${sm.icone || ""} <span>${sm.nome_menu}</span>
                            </div>
                        `).join("")}
                    </div>
                </div>`;
        } else {
          html += `
            <div class="menu-item" 
              data-link="${menu.rota}" 
              data-page="${menu.data_page}"
              data-tipo="${menu.tipo_abrir}">
                ${icone}<span>${menu.nome_menu}</span>
            </div>`;
        }

    });

    container.innerHTML = html;
}



// 🎯 Disparar ação ao clicar nos menus
document.addEventListener("click", function (e) {
  const link = e.target.closest("[data-link]");
  if (link) {
    e.preventDefault();

    const rota = link.getAttribute("data-link");
    const tipo = link.getAttribute("data-tipo");
    const pagina = link.getAttribute("data-page");

    if (tipo === "index") {
      if (!pagina) {
        console.warn("⚠️ Menu com 'index' mas sem data-page definido.");
        return;
      }

      // 🔁 Remove destaque de todos os submenus
      document.querySelectorAll(".submenu-item.ativo").forEach(el => el.classList.remove("ativo"));

      // ✅ Adiciona destaque ao submenu atual
      link.classList.add("ativo");

      // 🔁 Fecha todos os submenus, exceto o pai do submenu clicado
      document.querySelectorAll(".submenu").forEach(sub => {
        if (!sub.contains(link)) {
          sub.classList.remove("aberto");
          sub.style.display = "none";
        }
      });

      // ✅ Garante que o submenu atual esteja aberto
      const submenu = link.closest(".submenu");
      if (submenu) {
        submenu.classList.add("aberto");
        submenu.style.display = "block";
      }

      GlobalUtils.carregarPagina(pagina);
    } else if (tipo === "nova_aba") {
      window.open(rota, "_blank");
    } else if (tipo === "popup") {
      alert("🚧 Modal ainda não implementado.");
    }
  }


  // 🔄 Alternar submenu
  const toggle = e.target.closest("[data-toggle]");
  if (toggle) {
    const todos = document.querySelectorAll(".submenu.aberto");
    todos.forEach(el => {
      if (el !== toggle.nextElementSibling) {
        el.classList.remove("aberto");
        el.style.display = "none";
      }
    });

    const submenu = toggle.nextElementSibling;
    submenu.classList.toggle("aberto");
    submenu.style.display = submenu.classList.contains("aberto") ? "block" : "none";
  }
});





function carregarMenuHorizontalUsuario() {
  fetch("/menu/horizontal", {
    method: "GET",
    credentials: "include"
  })
    .then(res => res.json()) // <- Faltava isso aqui!
    .then(menus => {
      const container = document.getElementById("menu-horizontal-usuario");
      container.innerHTML = "";

      if (!Array.isArray(menus)) return;

      menus.forEach(menu => {
        const div = document.createElement("div");
        div.classList.add("submenu-horizontal-item");
        div.setAttribute("data-link", menu.rota);
        div.setAttribute("data-tipo", menu.tipo_abrir);
        div.setAttribute("data-page", menu.data_page);
        div.innerHTML = `${menu.icone || ""} ${menu.nome_menu}`;
        container.appendChild(div);
      });

      container.querySelectorAll(".submenu-horizontal-item").forEach(item => {
        item.addEventListener("click", (e) => {
          const tipo = item.getAttribute("data-tipo");
          const page = item.getAttribute("data-page");
          const rota = item.getAttribute("data-link");

          document.querySelector(".menu-usuario")?.classList.remove("active");

          if (tipo === "index") {
            GlobalUtils.carregarPagina(page);
          } else if (tipo === "nova_aba") {
            window.open(rota, "_blank");
          } else if (tipo === "popup") {
            alert("🚧 Modal ainda não implementado.");
          }
        });
      });
    })
    .catch(err => console.warn("Erro ao carregar menu horizontal:", err));
}



// ---------------------------------------------------------------
// -----------------------ETAPA 4: PAINEL DE NOVIDADES------------
// ---------------------------------------------------------------
// JS - Controle de Novidades com atraso de leitura e scroll inteligente

let observerFimNovidades;
let tempoPainelAberto = null;

function trocarAbaNovidades(aba) {
  document.getElementById("aba-novas").classList.remove("ativa");
  document.getElementById("aba-lidas").classList.remove("ativa");
  document.getElementById("listaNovidadesNovas").style.display = "none";
  document.getElementById("listaNovidadesLidas").style.display = "none";

  if (aba === "novas") {
    document.getElementById("aba-novas").classList.add("ativa");
    document.getElementById("listaNovidadesNovas").style.display = "block";
  } else {
    document.getElementById("aba-lidas").classList.add("ativa");
    document.getElementById("listaNovidadesLidas").style.display = "block";
  }
}

function fecharPainelNovidades() {
  document.getElementById("painelNovidades").classList.remove("ativo");
  tempoPainelAberto = null;
}

function togglePainelNovidades() {
  const painel = document.getElementById("painelNovidades");
  if (painel.classList.contains("ativo")) {
    fecharPainelNovidades();
  } else {
    abrirPainelNovidades();
  }
}

async function abrirPainelNovidades() {
  try {
    const resp = await fetch("/menu/novidades");
    const novidades = await resp.json();

    const divLista = document.getElementById("listaTodasNovidades");
    divLista.innerHTML = "";

    const visualizado = parseInt(localStorage.getItem("ultima_novidade_visualizada")) || 0;
    let maiorID = visualizado;
    let existeNaoLida = false;

    novidades.forEach(n => {
      const ehNaoLida = n.id > visualizado;
      const div = document.createElement("div");
      div.className = "card-novidade tipo-" + (n.tipo || "padrao") + (ehNaoLida ? " nao-lida" : "");
      div.innerHTML = `
        <div class="cabecalho">📅 ${window.Util.formatarDataPtBr(n.emissao)} | ${n.modulo}</div>
        <div class="descricao">${n.descricao}</div>
        ${n.link ? `<a href="${n.link}" class="link" target="_blank">Saber mais</a>` : ""}
      `;
      divLista.appendChild(div);

      if (ehNaoLida) {
        existeNaoLida = true;
        if (n.id > maiorID) maiorID = n.id;
      }
    });

    // Exibir botão "Marcar como lida" se houver não lidas
    document.getElementById("btnMarcarComoLido").style.display = existeNaoLida ? "block" : "none";

    document.getElementById("painelNovidades").classList.add("ativo");
    tempoPainelAberto = Date.now();

  } catch (err) {
    Swal.fire("Erro", "Falha ao carregar novidades", "error");
  }
}

async function marcarTodasComoLidas() {
  try {
    const resp = await fetch("/menu/novidades");
    const novidades = await resp.json();
    const ultimoID = Math.max(...novidades.map(n => n.id));

    await fetch("/menu/novidades/atualizar", { method: "POST" });
    localStorage.setItem("ultima_novidade_visualizada", ultimoID);

    abrirPainelNovidades(); // Recarrega sem o destaque
    const badge = document.getElementById("badgeNovidades");
    if (badge) badge.remove();
  } catch (e) {
    Swal.fire("Erro", "Falha ao marcar como lidas", "error");
  }
}


function configurarNovidades() {
  document.getElementById("btnnovidades").addEventListener("click", togglePainelNovidades);

  document.addEventListener("click", function(event) {
    const painel = document.getElementById("painelNovidades");
    const botao = document.getElementById("btnnovidades");
    if (painel.classList.contains("ativo") && !painel.contains(event.target) && !botao.contains(event.target)) {
      fecharPainelNovidades();
    }
  });
}

async function verificarNovidadesBadge() {
  try {
    const resp = await fetch("/menu/novidades");
    const novidades = await resp.json();
    const visualizado = parseInt(localStorage.getItem("ultima_novidade_visualizada")) || 0;
    const ultimo = Math.max(...novidades.map(n => n.id));

    if (ultimo > visualizado) {
      const badge = document.createElement("span");
      badge.id = "badgeNovidades";
      badge.className = "badge-notificacao";
      badge.textContent = ultimo - visualizado;
      document.querySelector("#btnnovidades").appendChild(badge);
    }
  } catch (e) {
    console.warn("Erro ao verificar badge de novidades");
  }
}




// ---------------------------------------------------------------
// ------------------ABERTURA DA PAGINA ESTA NO GLOBAL------------
// ---------------------------------------------------------------



(function iniciarControleSessao() {
  let tempoSessaoMinutos = 30;

  fetch("/config/tempo_sessao")
    .then(r => r.json())
    .then(data => {
      tempoSessaoMinutos = parseInt(data.valor || 30);
      monitorarSessao();
    });

  function monitorarSessao() {
    const LIMITE = tempoSessaoMinutos * 60 * 1000;
    localStorage.setItem("lastActive", Date.now());

    const resetar = () => localStorage.setItem("lastActive", Date.now());

    ["mousemove", "keydown", "click", "scroll"].forEach(evt => {
      window.addEventListener(evt, resetar);
    });

    setInterval(() => {
      const inativo = Date.now() - parseInt(localStorage.getItem("lastActive") || 0);
      if (inativo >= LIMITE) {
        console.warn("⏳ Sessão encerrada por inatividade");
        GlobalUtils.limparStorageUsuario();;
        window.location.href = "/login";
      }
    }, 30000); // Verifica a cada 30s
  }
})();


// ✅ Fecha o submenu do usuário se clicar fora
document.addEventListener("click", (event) => {
  const menuBox = document.querySelector(".menu-usuario");
  const submenu = document.getElementById("submenuUsuario");

  const clicouFora = !menuBox.contains(event.target);

  if (menuBox.classList.contains("active") && clicouFora) {
    menuBox.classList.remove("active");
  }
});