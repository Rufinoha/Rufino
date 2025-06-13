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

async function verificarSessaoTempo() {
  try {
    const resp = await fetch("/config/tempo_sessao", {
      method: "GET",
      credentials: "same-origin"  // ✅ Garante que o cookie de sessão seja enviado
    });

    const data = await resp.json();
    const tempoMax = parseInt(data.valor || "30");

    const horaLogin = new Date(localStorage.getItem("horaLogin"));
    const agora = new Date();
    const minutos = (agora - horaLogin) / 1000 / 60;

    if (minutos >= tempoMax) {
      Swal.fire("⏱ Sessão expirada", "Você será redirecionado.", "info").then(() => {
        localStorage.removeItem("usuarioLogado");
        window.location.href = "/login.html";
      });
    }
  } catch (err) {
    console.warn("⚠️ Não foi possível verificar tempo de sessão:", err);
  }
}


// ---------------------------------------------------------------
// -----------------------ETAPA 2: MENU HORIZONTAL----------------
// ---------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  carregarUsuarioLogado();
  configurarMenuUsuario();
  configurarNovidades();
  configurarPin();
  carregarMenu("lateral");
  carregarMenu("horizontal");

});

// 🧑‍💼 Dados do usuário logado
function carregarUsuarioLogado() {
  const usuario = JSON.parse(localStorage.getItem("usuarioLogado") || "{}");

  const nome = usuario?.nome?.split(" ")[0] || "Usuário";
  const empresa = usuario?.nome_empresa || "Empresa";
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
      carregarPagina(pagina);
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
    fetch(`/menu/${posicao}`)
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
                  data-page="${sm.data_page}"
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

      carregarPagina(pagina);
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
  fetch("/menu/horizontal")
    .then(res => res.json())
    .then(menus => {
      const container = document.getElementById("menu-horizontal-usuario");
      container.innerHTML = "";

      if (!Array.isArray(menus)) return;

      menus.forEach(menu => {
        const div = document.createElement("div");
        div.classList.add("submenu-horizontal-item");
        div.setAttribute("data-link", menu.rota);
        div.setAttribute("data-tipo", menu.tipo_abrir);
        div.setAttribute("data-page", menu.data_page); // ✅ importante
        div.innerHTML = `${menu.icone || ""} ${menu.nome_menu}`;
        container.appendChild(div);
      });
      // 🔥 Adiciona evento de clique
      container.querySelectorAll(".submenu-horizontal-item").forEach(item => {
       item.addEventListener("click", (e) => {
        const tipo = item.getAttribute("data-tipo");
        const page = item.getAttribute("data-page");
        const rota = item.getAttribute("data-link");

        // ✅ Fecha o menu horizontal do usuário
        document.querySelector(".menu-usuario")?.classList.remove("active");

        if (tipo === "index") {
          carregarPagina(page);
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

function configurarNovidades() {
  document.getElementById("btnnovidades").addEventListener("click", async () => {
    try {
      const resp = await fetch("/menu/novidades");
      const novidades = await resp.json();

      const container = document.getElementById("listaNovidades");
      container.innerHTML = "";

      novidades.forEach(n => {
        const div = document.createElement("div");
        div.className = "card-novidade";
        div.innerHTML = `
          <div class="cabecalho">📅 ${n.emissao} | ${n.modulo}</div>
          <div class="descricao">${n.descricao}</div>
          ${n.link ? `<a href="${n.link}" class="link" target="_blank">Saber mais</a>` : ""}
        `;
        container.appendChild(div);
      });

      document.getElementById("painelNovidades").classList.add("ativo");
    } catch (err) {
      Swal.fire("Erro", "Falha ao carregar novidades", "error");
    }
  });
}

function fecharPainelNovidades() {
  document.getElementById("painelNovidades").classList.remove("ativo");
}

// ---------------------------------------------------------------
// -----------------------ETAPA 5: ABERTURA DE PÁGINAS------------
// ---------------------------------------------------------------

function carregarPagina(pagina) {
  const conteudo = document.getElementById("content-area");
  if (!conteudo) return;

  // 1. Limpa conteúdo e scripts antigos
  conteudo.innerHTML = "";
  document.querySelectorAll("script[data-page-script]").forEach(s => s.remove());

  // 2. Remove módulo antigo
  const modulo = pagina.charAt(0).toUpperCase() + pagina.slice(1);
  delete window[modulo];

  // 3. Carrega o HTML da tela
  fetch(`/${pagina}`)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    })
    .then(html => {
      conteudo.innerHTML = html;
      conteudo.setAttribute("data-page", pagina);

      // 4. Injeta o script novo
      const script = document.createElement("script");
      script.src = `/static/script/S${modulo}.js?t=${Date.now()}`;
      script.defer = true;
      script.setAttribute("data-page-script", pagina);
      document.body.appendChild(script);

      
    })
    .catch(err => {
      console.error(`Erro ao carregar ${pagina}`, err);
      Swal.fire("Erro", `Não foi possível abrir ${pagina}`, "error");
    });
}


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
        localStorage.clear();
        window.location.href = "/login";
      }
    }, 30000); // Verifica a cada 30s
  }
})();
