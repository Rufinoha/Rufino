/* =======================================================================
   ETAPA 1 — AUTENTICAÇÃO & SESSÃO (uso mínimo de LocalStorage)
   - Guarda APENAS os campos vindos do login.js
   - Redireciona para /login se não houver sessão
   ======================================================================= */

(function verificarSessaoMinima() {
  const u = JSON.parse(localStorage.getItem("usuarioLogado") || "{}");

  if (!u || !u.id_usuario) {
    Swal.fire("Sessão encerrada", "Faça login novamente.", "warning").then(() => {
      window.location.href = "/login";
    });
    return;
  }
})();


// Debounce simples (espera o usuário terminar de digitar)
function debounce(fn, delay = 300){
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(null, args), delay);
  };
}




/* =======================================================================
   ETAPA 2 — BOOT DA PÁGINA
   - Carrega topo do usuário
   - Configura “Meu Perfil” (menu horizontal FIXO)
   - Configura pin e menu lateral (dinâmico via API)
   - Ativa painel de novidades
   ======================================================================= */

document.addEventListener("DOMContentLoaded", () => {
  carregarTopoUsuario();
  configurarMenuHorizontalFixo();     // <- FIXO (Meu Perfil / Financeiro / Chamados / Sair)
  configurarPinMenuLateral();
  carregarMenu();            // <- DINÂMICO pela tbl_menu (mantém como hoje)
  configurarNovidades();
  verificarNovidadesBadge();
});

/* =======================================================================
   TOPO — DADOS DO USUÁRIO (nome/empresa/foto)
   ======================================================================= */

function carregarTopoUsuario() {
  const nomeCompleto = window.Util.localstorage("nome", "Usuário");
  const primeiroNome = String(nomeCompleto || "").trim().split(/\s+/)[0] || "Usuário";

  const empresa = window.Util.localstorage("nome_amigavel", "Empresa");
  const imagem  = window.Util.localstorage("imagem", "userpadrao.png");

  document.getElementById("usuarioNome").textContent    = primeiroNome;
  document.getElementById("usuarioEmpresa").textContent = empresa;
  document.getElementById("iconeUsuario").src           = `/static/imge/imguser/${imagem}`;
}


/* =======================================================================
   MENU HORIZONTAL (MEU PERFIL) — FIXO
   - NÃO busca mais na tbl_menu
   - Itens: Meu Perfil, Financeiro, Chamados, Sair
   ======================================================================= */

function configurarMenuHorizontalFixo() {
  const btnToggle = document.getElementById("btnUsuarioToggle");
  const menuBox   = document.querySelector(".menu-usuario");
  const container = document.getElementById("menu-horizontal-usuario");

  // remover item legado (evita "2x Sair")
  const legacySair = document.getElementById("btnsair");
  if (legacySair) legacySair.remove();

  // limpar e montar
  container.innerHTML = "";

  const ITENS = [
    { titulo: "Meu Perfil",      tipo: "index", page: "meu_perfil",  iconeNome: "perfil" },
    { titulo: "Financeiro",      tipo: "index", page: "financeiro",  iconeNome: "financeiro" },
    { titulo: "Chamados",        tipo: "index", page: "chamado",     iconeNome: "chamado" },
    { titulo: "Ajuda",           tipo: "index", page: "ajuda",       iconeNome: "ajuda" }, 
    { titulo: "Email-Log",       tipo: "index", page: "email_log",   iconeNome: "email" }, 
    { titulo: "Configurações",   tipo: "index", page: "configuracoes",iconeNome: "configuracoes" }, 
    { divider: true },
    { titulo: "Sair",            tipo: "sair",  page: null,           iconeNome: "sair" }
  ];

  ITENS.forEach(it => {
    if (it.divider) {
      const hr = document.createElement("div");
      hr.className = "submenu-divider";
      container.appendChild(hr);
      return;
    }
    const div = document.createElement("div");
    div.className = "submenu-horizontal-item";
    div.dataset.tipo = it.tipo;
    if (it.page) div.dataset.page = it.page;

    const iconHTML = (window?.Util?.gerarIconeTech?.(it.iconeNome)) || "";
    div.innerHTML = `${iconHTML}<span class="mi-txt">${it.titulo}</span>`;
    container.appendChild(div);
  });

  // inicializa/atualiza lucide (transforma <i data-lucide> em SVG)
  try { if (window.lucide?.createIcons) window.lucide.createIcons(); } catch {}

  // ações dos itens
  container.querySelectorAll(".submenu-horizontal-item").forEach(item => {
    item.addEventListener("click", () => {
      const tipo = item.dataset.tipo;
      const page = item.dataset.page;
      document.querySelector(".menu-usuario")?.classList.remove("active");

      if (tipo === "index") {
        GlobalUtils.carregarPagina(page);
      } else if (tipo === "sair") {
        Swal.fire({
          icon: "question",
          title: "Deseja sair?",
          text: "Sua sessão será encerrada.",
          showCancelButton: true,
          confirmButtonText: "Sim, sair",
          cancelButtonText: "Cancelar"
        }).then((r) => {
          if (r.isConfirmed) {
            fetch("/logout", { method: "POST", credentials: "include" })
              .then(() => {
                localStorage.removeItem("usuarioLogado");
                window.location.href = "/login";
              });
          }
        });
      }
    });
  });

  // toggle abrir/fechar
  btnToggle.addEventListener("click", () => {
    menuBox.classList.toggle("active");
  });

  // fechar se clicar fora
  document.addEventListener("click", (ev) => {
    const clicouFora = !menuBox.contains(ev.target) && ev.target !== btnToggle;
    if (menuBox.classList.contains("active") && clicouFora) {
      menuBox.classList.remove("active");
    }
  });
}


/* =======================================================================
   MENU LATERAL — DINÂMICO (tbl_menu)
   - Mantido como estava, mas sempre com credentials: "include"
   ======================================================================= */

function configurarPinMenuLateral(){
  const menuLateral = document.getElementById("menuLateral");
  const btnToggle   = document.getElementById("btnToggleSidebar");
  const btnPin      = document.getElementById("btnPinSidebar");

  // Estados salvos
  const estadoSalvo = localStorage.getItem("menuLateralEstado") || "expandido";
  const fixadoSalvo = localStorage.getItem("menuLateralFixado") === "true";

  // Aplica estado inicial (expandido/retraído)
  aplicarEstado(estadoSalvo === "expandido");

  // Aplica visual do pin
  if (fixadoSalvo) btnPin.classList.add("is-pinned");

  // Toggle recolher/expandir (chevron)
  btnToggle?.addEventListener("click", () => {
    const expandido = menuLateral.classList.contains("expandido");
    aplicarEstado(!expandido);
    // Sempre persistimos a última escolha
    localStorage.setItem("menuLateralEstado", menuLateral.classList.contains("expandido") ? "expandido" : "retraido");
  });

  // Pin: alterna “fixado” (apenas um flag visual e de preferência)
  btnPin?.addEventListener("click", () => {
    const fixado = btnPin.classList.toggle("is-pinned");
    localStorage.setItem("menuLateralFixado", fixado ? "true" : "false");
    // Dica: se quiser forçar sempre expandido quando fixado:
    if (fixado) {
      aplicarEstado(true);
      localStorage.setItem("menuLateralEstado", "expandido");
    }
  });

  function aplicarEstado(expandir){
    if (expandir){
      menuLateral.classList.add("expandido");
      menuLateral.classList.remove("retraido");
    } else {
      menuLateral.classList.add("retraido");
      menuLateral.classList.remove("expandido");
      // Ao retrair, fecha submenus abertos
      document.querySelectorAll("#listaMenus .submenu").forEach(ul => { 
        ul.classList.remove("aberto");
        ul.style.display = "none"; 
      });
    }
  }
}


function carregarMenu() {
  fetch("/menu/lateral", { method: "GET", credentials: "include" })
    .then(res => res.json())
    .then(dados => {
      if (dados?.erro) { console.warn("Erro ao carregar menu lateral:", dados.erro); return; }
      renderizarMenu(dados);
    })
    .catch(err => console.error("Erro ao buscar menu lateral:", err));
}


function renderizarMenu(itens) {
  const container = document.getElementById("menu-lateral");
  if (!container) return;

  let html = "";
  const menusPrincipais = itens.filter(m => !m.parent_id);

  menusPrincipais.forEach(menu => {
    const iconHTML = (window?.Util?.gerarIconeTech?.(menu.icone)) || "";
    const submenus = itens.filter(s => s.parent_id === menu.id);

    if (submenus.length > 0) {
      html += `
        <div class="menu-item com-submenu" data-tooltip="${menu.nome_menu}">
          <div class="menu-principal"
              data-toggle
              tabindex="0"
              role="button"
              aria-expanded="false"
              aria-label="Abrir ${menu.nome_menu}">
            ${iconHTML}
            <span>${menu.nome_menu}</span>
            <i data-lucide="chevron-down" class="Cl_Chevron" aria-hidden="true"></i>
          </div>
          <div class="submenu" role="group" aria-label="Submenu de ${menu.nome_menu}">
            ${submenus.map(sm => {
              const smIcon = (window?.Util?.gerarIconeTech?.(sm.icone)) || "";
              const page   = sm.tipo_abrir === "index" ? (sm.rota || "") : "";
              return `
                <div class="submenu-item"
                    data-link="${sm.rota || ""}"
                    data-page="${page}"
                    data-tipo="${sm.tipo_abrir}"
                    data-tooltip="${sm.nome_menu}"
                    tabindex="0"
                    role="link"
                    aria-label="${sm.nome_menu}">
                    ${smIcon}<span>${sm.nome_menu}</span>
                </div>`;
            }).join("")}
          </div>
        </div>`;
    }else {
      html += `
        <div class="menu-item" data-tooltip="${menu.nome_menu}">
          <div class="menu-principal"
               data-link="${menu.rota || ""}"
               data-page="${menu.tipo_abrir === "index" ? (menu.rota || "") : ""}"
               data-tipo="${menu.tipo_abrir}"
               tabindex="0"
               role="${menu.tipo_abrir === "index" ? "link" : "button"}"
               aria-label="${menu.nome_menu}">
               ${iconHTML}<span>${menu.nome_menu}</span>
          </div>
        </div>`;
    }
  });

  container.innerHTML = html;

  try { if (window.lucide?.createIcons) window.lucide.createIcons(); } catch {}

  /* 🔒 Travar definitivamente os ícones do menu lateral (inline > qualquer CSS externo) */
  function travarCoresIconesMenu() {
    const raiz = document.querySelector("aside#menuLateral");
    if (!raiz) return;

    // Todos os contêineres de ícones lucide dentro do menu
    raiz.querySelectorAll("[data-lucide], svg[data-lucide], .menu-lateral svg").forEach(svgEl => {
      // 1) cor/contorno diretamente no elemento (inline + !important)
      const atual = svgEl.getAttribute("style") || "";
      svgEl.setAttribute("style", `${atual}; color:#333333 !important; stroke:#333333 !important; fill:none !important;`);

      // 2) força atributos SVG (para ignorar herança de currentColor)
      if (svgEl.tagName.toLowerCase() === "svg") {
        svgEl.setAttribute("stroke", "#333333");
        svgEl.setAttribute("fill", "none");
      }

      // 3) aplica em todos os nós internos (path/circle/line/etc.)
      svgEl.querySelectorAll("path, circle, rect, line, polyline, polygon, ellipse").forEach(n => {
        n.setAttribute("stroke", "#333333");
        n.setAttribute("fill", "none");
        const st = n.getAttribute("style") || "";
        n.setAttribute("style", `${st}; stroke:#333333 !important; fill:none !important;`);
      });
    });
  }

  // 🔔 Chame aqui, logo após criar os ícones
  travarCoresIconesMenu();

  configurarBuscaMenuLateral(); // mantém a busca
}




function configurarBuscaMenuLateral(){
  const input  = document.getElementById("menuSearchInput");
  const clear  = document.getElementById("menuSearchClear");
  const lateral = document.getElementById("menuLateral");

  if (!input) return;

  const filtrar = debounce(() => {
    const termo = (input.value || "").trim().toLowerCase();

    // Seleciona todos os blocos de menu principal
    document.querySelectorAll("#menu-lateral .menu-item").forEach(item => {
      const isComSub = item.classList.contains("com-submenu");
      const principalTxt = (item.querySelector(".menu-principal span")?.textContent || "").toLowerCase();

      // Se tem submenu, verifica cada um
      if (isComSub) {
        const filhos = Array.from(item.querySelectorAll(".submenu-item"));
        let algumFilhoVisivel = false;

        filhos.forEach(f => {
          const t = (f.querySelector("span")?.textContent || "").toLowerCase();
          const match = termo === "" || t.includes(termo) || principalTxt.includes(termo);
          f.style.display = match ? "flex" : "none";
          if (match) algumFilhoVisivel = true;
        });

        // Mostra o principal se ele mesmo combinar OU algum filho combinar
        const combinaPrincipal = termo === "" || principalTxt.includes(termo);
        item.style.display = (combinaPrincipal || algumFilhoVisivel) ? "block" : "none";

        // Se estamos filtrando e há matches, abre o acordeão para mostrar os filhos
        const submenu = item.querySelector(".submenu");
        if (submenu){
          const deveAbrir = termo !== "" && (algumFilhoVisivel || principalTxt.includes(termo));
          submenu.classList.toggle("aberto", deveAbrir);
          submenu.style.display = submenu.classList.contains("aberto") ? "block" : "none";
        }

      } else {
        // Sem submenu
        const match = termo === "" || principalTxt.includes(termo);
        item.style.display = match ? "block" : "none";
      }
    });

  }, 300);

  input.addEventListener("input", filtrar);

  clear.addEventListener("click", () => {
    input.value = "";
    input.focus();
    // Restaura tudo visível
    document.querySelectorAll("#menu-lateral .menu-item").forEach(item => item.style.display = "block");
    document.querySelectorAll("#menu-lateral .submenu-item").forEach(f => f.style.display = "flex");
    document.querySelectorAll("#menu-lateral .submenu").forEach(s => {
      s.classList.remove("aberto");
      s.style.display = "none";
    });
  });

  // Atalho: Ctrl+/ foca a busca
  // ======= Acessibilidade por teclado: Enter/Espaço/Setas =======
  document.addEventListener("keydown", (ev) => {
    const tgt = ev.target;

    // Enter/Espaço em itens clicáveis
    if ((ev.key === "Enter" || ev.key === " ") && (tgt.matches("[data-link]") || tgt.matches("[data-toggle]"))) {
      ev.preventDefault();
      tgt.click();
    }

    // Setas em grupos (colapsar/expandir)
    if (tgt.matches("[data-toggle]")) {
      const submenu = tgt.nextElementSibling;
      if (!submenu) return;

      // → abre | ← fecha
      if (ev.key === "ArrowRight") {
        if (!submenu.classList.contains("aberto")) {
          tgt.click();
        }
      } else if (ev.key === "ArrowLeft") {
        if (submenu.classList.contains("aberto")) {
          tgt.click();
        }
      }
    }
  });

}


// Clique em itens do menu (abrir index / nova aba / popup)
document.addEventListener("click", function (e) {
  const link = e.target.closest("[data-link]");
  if (link) {
    e.preventDefault();

    const tipo   = link.getAttribute("data-tipo");
    const pagina = link.getAttribute("data-page");  // usado em "index"
    const rota   = link.getAttribute("data-link");  // usado em "nova_aba" / "popup" / fallback

    // 🔹 visual ativo + aria-current
    document.querySelectorAll(".submenu-item.ativo").forEach(el => el.classList.remove("ativo"));
    document.querySelectorAll("[aria-current='page']").forEach(el => el.removeAttribute("aria-current"));
    link.classList.add("ativo");
    // Leva o item ativo para a área visível do menu
    try {
      link.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: "smooth"
      });
    } catch {}

    link.setAttribute("aria-current", "page");

    const pai = link.closest(".menu-item");
    document.querySelectorAll(".menu-item[data-ativo='true']").forEach(el => el.removeAttribute("data-ativo"));
    pai?.setAttribute("data-ativo", "true");

    if (tipo === "index") {
      if (!pagina) { console.warn("⚠️ 'index' sem data-page/rota."); return; }

      document.querySelectorAll(".submenu").forEach(sub => {
        if (!sub.contains(link)) { 
          sub.classList.remove("aberto"); 
          sub.style.display = "none"; 
          const header = sub.previousElementSibling;
          header?.setAttribute("aria-expanded", "false");  // 🔸 fecha ARIA
        }
      });

      const submenu = link.closest(".submenu");
      if (submenu) { 
        submenu.classList.add("aberto"); 
        submenu.style.display = "block"; 
        const header = submenu.previousElementSibling;
        header?.setAttribute("aria-expanded", "true");     // 🔸 abre ARIA
      }

      GlobalUtils.carregarPagina(pagina);
      return;
    }

    if (tipo === "nova_aba") {
      if (!rota) { console.warn("⚠️ 'nova_aba' sem rota."); return; }
      window.open(rota, "_blank");
      return;
    }

    if (tipo === "popup") {
      alert("🚧 Modal ainda não implementado.");
      return;
    }

    if (rota) {
      GlobalUtils.carregarPagina(rota);
    }
  }

  // Toggle de módulos (pais)
  const toggle = e.target.closest("[data-toggle]");
  if (toggle) {
    const todos = document.querySelectorAll(".submenu.aberto");
    todos.forEach(el => {
      if (el !== toggle.nextElementSibling) { 
        el.classList.remove("aberto"); 
        el.style.display = "none"; 
        el.previousElementSibling?.setAttribute("aria-expanded","false");  // 🔸 fecha ARIA
      }
    });
    const submenu = toggle.nextElementSibling;
    const expanded = !submenu.classList.contains("aberto");
    submenu.classList.toggle("aberto", expanded);
    submenu.style.display = expanded ? "block" : "none";
    toggle.setAttribute("aria-expanded", expanded ? "true" : "false");      // 🔸 atualiza ARIA
  }
});




/* =======================================================================
   PAINEL DE NOVIDADES — Mantido, mas usando id_ultima_novidade_lida
   ======================================================================= */

async function abrirPainelNovidades() {
  try {
    const resp = await fetch("/menu/novidades", { credentials: "include" });

    // Diagnóstico básico
    const ct = resp.headers.get("content-type") || "";
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      console.error("[novidades] HTTP", resp.status, "->", txt.slice(0, 600));
      Swal.fire("Erro", `Falha ao carregar novidades (HTTP ${resp.status})`, "error");
      return;
    }
    if (!ct.includes("application/json")) {
      const txt = await resp.text().catch(() => "");
      console.error("[novidades] Resposta não JSON:", txt.slice(0, 600));
      Swal.fire("Erro", "Falha ao carregar novidades", "error");
      return;
    }

    const payload = await resp.json();
    const lista = Array.isArray(payload) ? payload : (payload.dados || []);

    const divLista = document.getElementById("listaTodasNovidades");
    if (!divLista) return;
    divLista.innerHTML = "";

    const visualizado = parseInt(localStorage.getItem("id_ultima_novidade_lida")) || 0;
    let maiorID = visualizado;
    let existeNaoLida = false;

    if (!Array.isArray(lista) || lista.length === 0) {
      divLista.innerHTML = `<div class="card-novidade vazio">Nenhuma novidade por aqui ✨</div>`;
    } else {
      lista.forEach(n => {
        const idN = Number(n.id) || 0;
        const ehNaoLida = idN > visualizado;

        // data PT-BR com fallback (sem helpers)
        let dataPt = "";
        try {
          if (window?.Util?.formatarDataPtBr) dataPt = Util.formatarDataPtBr(n.emissao);
          else {
            const d = n.emissao ? new Date(n.emissao) : null;
            dataPt = (d && !isNaN(d)) ? d.toLocaleDateString("pt-BR") : "";
          }
        } catch {}

        const div = document.createElement("div");
        div.className = "card-novidade tipo-" + (n.tipo || "padrao") + (ehNaoLida ? " nao-lida" : "");
        div.innerHTML = `
          <div class="cabecalho">📅 ${dataPt}${n.modulo ? ` | ${n.modulo}` : ""}</div>
          <div class="descricao">${n.descricao || ""}</div>
          ${n.link ? `<a href="${n.link}" class="link" target="_blank" rel="noopener">Saber mais</a>` : ""}`;
        divLista.appendChild(div);

        if (ehNaoLida) { existeNaoLida = true; if (idN > maiorID) maiorID = idN; }
      });
    }

    const btn = document.getElementById("btnMarcarComoLido");
    if (btn) btn.style.display = existeNaoLida ? "block" : "none";

    document.getElementById("painelNovidades")?.classList.add("ativo");
    window.__tempoPainelNovidadesAberto = Date.now();

  } catch (err) {
    console.error("[novidades] exceção ao carregar:", err);
    Swal.fire("Erro", "Falha ao carregar novidades", "error");
  }
}

async function marcarTodasComoLidas() {
  try {
    // Buscar para descobrir o maior ID
    const r = await fetch("/menu/novidades", { credentials: "include" });
    const ct = r.headers.get("content-type") || "";
    if (!r.ok || !ct.includes("application/json")) {
      const txt = await r.text().catch(() => "");
      console.error("[novidades] badge/atualizar - resposta inválida:", r.status, txt.slice(0, 600));
      Swal.fire("Erro", "Falha ao marcar como lidas", "error");
      return;
    }
    const payload = await r.json();
    const lista = Array.isArray(payload) ? payload : (payload.dados || []);
    const ultimoID = lista.reduce((max, n) => Math.max(max, Number(n.id) || 0), 0);

    // Atualizar no servidor
    const upd = await fetch("/menu/novidades/atualizar", { method: "POST", credentials: "include" });
    if (!upd.ok) {
      const txt = await upd.text().catch(() => "");
      console.error("[novidades] atualizar (POST) falhou:", upd.status, txt.slice(0, 600));
      Swal.fire("Erro", "Falha ao marcar como lidas", "error");
      return;
    }

    localStorage.setItem("id_ultima_novidade_lida", String(ultimoID));
    await abrirPainelNovidades();
    document.getElementById("badgeNovidades")?.remove();

  } catch (e) {
    console.error("[novidades] exceção ao marcar como lidas:", e);
    Swal.fire("Erro", "Falha ao marcar como lidas", "error");
  }
}


function configurarNovidades() {
  document.getElementById("btnnovidades").addEventListener("click", togglePainelNovidades);
  document.addEventListener("click", function(event) {
    const painel = document.getElementById("painelNovidades");
    const botao  = document.getElementById("btnnovidades");
    if (painel.classList.contains("ativo") && !painel.contains(event.target) && !botao.contains(event.target)) {
      fecharPainelNovidades();
    }
  });
}

function togglePainelNovidades() {
  const painel = document.getElementById("painelNovidades");
  if (painel.classList.contains("ativo")) fecharPainelNovidades(); else abrirPainelNovidades();
}

function fecharPainelNovidades() {
  document.getElementById("painelNovidades").classList.remove("ativo");
  window.__tempoPainelNovidadesAberto = null;
}

async function verificarNovidadesBadge() {
  try {
    const r = await fetch("/menu/novidades", { credentials: "include" });
    const ct = r.headers.get("content-type") || "";
    if (!r.ok || !ct.includes("application/json")) {
      const txt = await r.text().catch(() => "");
      console.warn("[novidades] badge - resposta inválida:", r.status, txt.slice(0, 400));
      return;
    }
    const payload = await r.json();
    const lista = Array.isArray(payload) ? payload : (payload.dados || []);
    const visualizado = parseInt(localStorage.getItem("id_ultima_novidade_lida")) || 0;
    const ultimo = lista.reduce((max, n) => Math.max(max, Number(n.id) || 0), 0);

    const btn = document.getElementById("btnnovidades");
    if (!btn) return;

    const diff = Math.max(0, ultimo - visualizado);
    let badge = document.getElementById("badgeNovidades");
    if (diff > 0) {
      if (!badge) {
        badge = document.createElement("span");
        badge.id = "badgeNovidades";
        badge.className = "badge-notificacao";
        btn.appendChild(badge);
      }
      badge.textContent = String(diff);
    } else {
      badge?.remove();
    }
  } catch (e) {
    console.warn("[novidades] badge - exceção:", e);
  }
}

/* =======================================================================
   CONTROLE DE INATIVIDADE — Mantido, mas checagem a cada 600s (10 min)
   ======================================================================= */

(function monitorInatividade() {
  let tempoSessaoMinutos = 30; // default; backend pode sobrescrever

  fetch("/config/tempo_sessao", { credentials: "include" })
    .then(r => r.json())
    .then(data => {
      tempoSessaoMinutos = parseInt(data.valor || 30);
      iniciar();
    })
    .catch(() => iniciar());

  function iniciar() {
    const LIMITE = tempoSessaoMinutos * 60 * 1000;
    localStorage.setItem("lastActive", Date.now());
    const resetar = () => localStorage.setItem("lastActive", Date.now());
    ["mousemove", "keydown", "click", "scroll"].forEach(evt => window.addEventListener(evt, resetar));

    // Checagem alterada para 600s (10 minutos)
    setInterval(() => {
      const inativo = Date.now() - parseInt(localStorage.getItem("lastActive") || 0);
      if (inativo >= LIMITE) {
        console.warn("⏳ Sessão encerrada por inatividade");
        GlobalUtils.limparStorageUsuario();
        window.location.href = "/login";
      }
    }, 600000);
  }
})();


// Slash "/" foca a busca quando o menu estiver expandido
document.addEventListener("keydown", (ev) => {
  if (ev.key === "/" && !ev.ctrlKey && !ev.metaKey) {
    const lateral = document.getElementById("menuLateral");
    const input   = document.getElementById("menuSearchInput");
    // Evita disparar se o foco já está em input/textarea/select
    const tag = (document.activeElement?.tagName || "").toLowerCase();
    const editando = ["input","textarea","select"].includes(tag) || document.activeElement?.isContentEditable;

    if (!editando && lateral?.classList.contains("expandido")) {
      ev.preventDefault();
      input?.focus();
    }
  }
});


// Abrir/Recolher em massa
document.getElementById("btnAbrirTudo")?.addEventListener("click", () => {
  document.querySelectorAll("#menu-lateral .submenu").forEach((sub) => {
    const header = sub.previousElementSibling;
    sub.classList.add("aberto");
    sub.style.display = "block";
    header?.setAttribute("aria-expanded","true");
  });
});
document.getElementById("btnFecharTudo")?.addEventListener("click", () => {
  document.querySelectorAll("#menu-lateral .submenu").forEach((sub) => {
    const header = sub.previousElementSibling;
    sub.classList.remove("aberto");
    sub.style.display = "none";
    header?.setAttribute("aria-expanded","false");
  });
});
