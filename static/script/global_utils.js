console.log("Global Utils - Carregado!")

// ------------------------------
// CONFIGURAÇÕES
// ------------------------------
window.App = window.App || {};
window.Util = window.Util || {};
window.GlobalUtils = window.GlobalUtils || {};


// --------------------------------------------------------
//SweetAlert padrão para todo o sistema
// --------------------------------------------------------
Swal = Swal.mixin({
  confirmButtonColor: '#007bff',
  cancelButtonColor: '#ccc',
  confirmButtonText: 'Confirmar',
  cancelButtonText: 'Cancelar'
});


// --------------------------------------------------------
// PADRONIZAÇÃO DE ABERTURA E FECHAMENTO DE JANELAS
// --------------------------------------------------------
// ------------------------------------------------------------------
// GLOBAL UTILS — Navegação dinâmica com ciclo de vida e anti-race
// ------------------------------------------------------------------
// ------------------------------------------------------------------
// GLOBAL UTILS — Navegação dinâmica com ciclo de vida e anti-race
// (com interceptadores globais que amarram efeitos colaterais ao escopo)
// ------------------------------------------------------------------
window.GlobalUtils = window.GlobalUtils || {};

(() => {
  // ---------------------------
  // Registry de páginas
  // ---------------------------
  const _pageRegistry = new Map();
  GlobalUtils.registerPage = function registerPage(pageKey, api) {
    if (!pageKey || !api) return;
    _pageRegistry.set(String(pageKey), api);
  };
  function _getPageApi(pageKey) {
    return _pageRegistry.get(String(pageKey));
  }

  // ---------------------------
  // Contexto (multiempresa)
  // ---------------------------
  GlobalUtils._getCtx = function _getCtx() {
    return {
      id_empresa: window.__CTX_ID_EMPRESA,
      id_usuario: window.__CTX_ID_USUARIO,
      grupo: window.__CTX_GRUPO,
      tempo_sessao_minutos: window.__CTX_TEMPO_SESSAO_MINUTOS,
      modo_producao: window.__CTX_MODO_PRODUCAO,
      email_notificacao: "notifica@rufino.tech",
    };
  };

  // ---------------------------
  // Guardião de ciclo de vida
  // ---------------------------
  class PageScope {
    constructor(navId) {
      this.navId = navId;
      this.abortController = new AbortController();
      this.signal = this.abortController.signal;
      this.cleanups = [];
    }
    addCleanup(fn) { this.cleanups.push(fn); }
    dispose() {
      try { this.abortController.abort(); } catch {}
      for (const c of this.cleanups.splice(0)) {
        try { c(); } catch {}
      }
    }
  }
  GlobalUtils.PageScope = PageScope;

  // ---------------------------
  // Interceptadores globais
  // ---------------------------
  let _activeScope = null; // escopo da navegação atual

  // ⚠️ Salve as nativas já "bindadas" ao window para evitar Illegal invocation
  const _orig = {
    addEventListener: EventTarget.prototype.addEventListener,
    removeEventListener: EventTarget.prototype.removeEventListener,

    setTimeout:   window.setTimeout.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
    setInterval:  window.setInterval.bind(window),
    clearInterval:window.clearInterval.bind(window),

    fetch: window.fetch.bind(window),

    MutationObserver: window.MutationObserver,
    IntersectionObserver: window.IntersectionObserver,
    ResizeObserver: window.ResizeObserver,
    Chart: null, // será preenchido quando existir
  };

  // addEventListener/removeEventListener (continua igual)
  if (!EventTarget.prototype.__scoped_patched) {
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      const ret = _orig.addEventListener.call(this, type, listener, options);
      if (_activeScope) {
        const target = this, opts = options;
        _activeScope.addCleanup(() => {
          try { _orig.removeEventListener.call(target, type, listener, opts); } catch {}
        });
      }
      return ret;
    };
    EventTarget.prototype.removeEventListener = function(type, listener, options) {
      return _orig.removeEventListener.call(this, type, listener, options);
    };
    Object.defineProperty(EventTarget.prototype, "__scoped_patched", { value: true });
  }

  // Timers (agora usando versões bindadas)
  if (!window.__scoped_timers_patched) {
    window.setTimeout = function(fn, ms, ...args) {
      const id = _orig.setTimeout(fn, ms, ...args);
      if (_activeScope) _activeScope.addCleanup(() => _orig.clearTimeout(id));
      return id;
    };
    window.setInterval = function(fn, ms, ...args) {
      const id = _orig.setInterval(fn, ms, ...args);
      if (_activeScope) _activeScope.addCleanup(() => _orig.clearInterval(id));
      return id;
    };
    window.clearTimeout = function(id) { return _orig.clearTimeout(id); };
    window.clearInterval = function(id) { return _orig.clearInterval(id); };
    Object.defineProperty(window, "__scoped_timers_patched", { value: true });
  }

  // fetch (injeta signal do escopo quando possível) — usando versão bindada
  if (!window.__scoped_fetch_patched) {
    window.fetch = function(input, init = {}) {
      if (_activeScope) {
        if (input instanceof Request) {
          if (!init || !init.signal) init = { ...init, signal: _activeScope.signal };
        } else {
          if (!init || !init.signal) init = { ...init, signal: _activeScope.signal };
        }
      }
      return _orig.fetch(input, init); // _orig.fetch já está bindado ao window
    };
    Object.defineProperty(window, "__scoped_fetch_patched", { value: true });
  }

  // Observers (sem mudanças)
  function wrapObserver(CtorName) {
    const Original = _orig[CtorName];
    if (!Original || window[CtorName]?.__scoped_patched) return;
    function WrappedObserver(...args) {
      const inst = new Original(...args);
      if (_activeScope) {
        _activeScope.addCleanup(() => { try { inst.disconnect?.(); } catch {} });
      }
      return inst;
    }
    WrappedObserver.prototype = Original.prototype;
    Object.defineProperty(WrappedObserver, "__scoped_patched", { value: true });
    window[CtorName] = WrappedObserver;
  }
  wrapObserver("MutationObserver");
  wrapObserver("IntersectionObserver");
  wrapObserver("ResizeObserver");

  // Chart.js — envolver quando disponível
  function ensureChartWrapper() {
    if (!window.Chart) return;
    if (_orig.Chart === null) _orig.Chart = window.Chart;
    if (window.Chart && !window.Chart.__scoped_patched) {
      function WrappedChart(...args) {
        const chart = new _orig.Chart(...args);
        if (_activeScope) {
          _activeScope.addCleanup(() => { try { chart.destroy?.(); } catch {} });
        }
        return chart;
      }
      WrappedChart.prototype = _orig.Chart.prototype;
      Object.defineProperty(WrappedChart, "__scoped_patched", { value: true });
      window.Chart = WrappedChart;
    }
  }


  // ---------------------------
  // Estado da navegação
  // ---------------------------
  let _navSeq = 0;
  let _current = {
    id: null,
    controller: null,
    pageKey: null,
    scope: null,
    pageApi: null,
  };

  function _teardownAnterior(silent = false) {
    // desativa escopo atual antes da limpeza
    _activeScope = null;
    try { _current.pageApi?.unmount?.(); } catch (e) { if (!silent) console.warn(e); }
    try { _current.scope?.dispose?.(); } catch (e) { if (!silent) console.warn(e); }
    try { _current.controller?.abort?.(); } catch {}
    const conteudo = document.getElementById("content-area");
    if (conteudo) {
      conteudo.innerHTML = "";
      conteudo.removeAttribute("data-page");
    }
    document.querySelectorAll("script[data-page-script]").forEach(s => s.remove());
    _current = { id: null, controller: null, pageKey: null, scope: null, pageApi: null };
  }

  // ------------------------------------------------------------------
  // Navegação dinâmica (mantendo suas regras de rota/pastas/scripts)
  // ------------------------------------------------------------------
  window.GlobalUtils.carregarPagina = async function (pagina) {
    const conteudo = document.getElementById("content-area");
    if (!conteudo) return;

    // encerra página/navegação anterior
    _teardownAnterior(true);

    // prepara nova navegação
    const navId = ++_navSeq;
    const controller = new AbortController();
    _current.id = navId;
    _current.controller = controller;
    _current.pageKey = pagina;

    // suas regras de interpretação
    const partes   = pagina.split("/");
    const modulo   = partes[0];
    const isModulo = pagina.startsWith("mod_");
    if (isModulo && partes.length < 2) {
      console.error(`Página inválida: "${pagina}" — módulo sem página`);
      Swal.fire("Erro", "Página inválida (módulo sem destino)", "error");
      return;
    }

    const rota       = `/${pagina}`; // (mantido)
    const staticPath = isModulo
      ? `/static/${modulo.replace('mod_', '')}/script`
      : `/static/script`;
    const paginaNome = isModulo ? partes[1] : pagina;

    // 1) busca HTML (com cancelamento)
    let html;
    try {
      const res = await fetch(rota, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      html = await res.text();
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error(`Erro ao carregar ${pagina}`, err);
      Swal.fire("Erro", `Não foi possível abrir a página \"${pagina}\"`, "error");
      return;
    }
    if (navId !== _current.id) return; // anti-race

    // 2) injeta HTML e marca página
    conteudo.innerHTML = html;
    conteudo.setAttribute("data-page", pagina);

    // 3) Chart.js via CDN (mantido) e garantir wrapper
    try { await carregarScriptCDN("https://cdn.jsdelivr.net/npm/chart.js", "chartjs"); }
    catch {}
    ensureChartWrapper();
    if (navId !== _current.id) return; // anti-race

    // 4) cria escopo da página e o torna ativo (interceptadores passam a registrar)
    const scope = new PageScope(navId);
    _current.scope = scope;
    _activeScope = scope;

    // 5) injeta o script da página (mantendo seu cálculo)
    const script = document.createElement("script");
    script.src = `${staticPath}/S${paginaNome}.js?t=${Date.now()}`;
    script.defer = true;
    script.setAttribute("data-page-script", pagina);

    script.onload = () => {
      if (navId !== _current.id) return; // anti-race
      const api = _getPageApi(pagina);
      if (!api || typeof api.mount !== "function") {
        console.error(`Script da página "${pagina}" carregou mas não registrou mount().`);
        Swal.fire("Erro", "Falha ao inicializar a página (script sem mount).", "error");
        return;
      }
      _current.pageApi = api;
      const ctx = GlobalUtils._getCtx?.() || {};
      try {
        api.mount(conteudo, ctx, scope);
      } catch (err) {
        console.error(`[nav ${navId}] erro no mount()`, err);
        try { scope.dispose(); } catch {}
        Swal.fire("Erro", `Houve um erro ao inicializar a página \"${pagina}\"`, "error");
      }
    };

    script.onerror = () => {
      if (navId !== _current.id) return;
      Swal.fire("Erro", `Falha ao carregar scripts da página \"${pagina}\"`, "error");
    };

    document.body.appendChild(script);
  };
})();






/******************** MODAL - Usado para abrir janelas de Apoio via MODAL *************************** */
GlobalUtils.abrirJanelaApoioModal = function ({
  rota,
  id = null,
  titulo = "Apoio",
  largura = 1000,
  altura = 600,
  nivel = 1,
  extras = null
}) {

  // fecha modal anterior do MESMO nível (se houver)
  GlobalUtils.fecharJanelaApoio(nivel);


  const overlayId = `modalApoioOverlay_nivel${nivel}`;
  const janelaId = `modalApoioJanela_nivel${nivel}`;

  // Impede reabertura no mesmo nível
  if (document.getElementById(overlayId)) {
    console.warn(`🟡 Já existe um modal no nível ${nivel}.`);
    return;
  }

  // Cria o overlay de fundo
  const overlay = document.createElement("div");
  overlay.id = overlayId;
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0,0,0,0.4); z-index: ${9998 + nivel * 2};
    display: flex; align-items: center; justify-content: center;
  `;

  // Cria o modal
  const modal = document.createElement("div");
  modal.id = janelaId;
  modal.style.cssText = `
    background: white; border-radius: 10px; overflow: hidden;
    width: ${largura}px; height: ${altura}px; position: relative;
    display: flex; flex-direction: column;
    box-shadow: 0 0 20px rgba(0,0,0,0.4);
  `;
 
  // Cabeçalho
  const header = document.createElement("div");
  header.style.cssText = `
    background: #007bff; color: white; padding: 10px 15px;
    font-weight: bold; display: flex; justify-content: space-between;
    align-items: center; font-size: 18px;
  `;
  header.innerHTML = `
    <span>${titulo}</span>
    <button data-fechar-nivel="${nivel}" style="background:none;border:none;color:white;font-size:20px;cursor:pointer">✖</button>
  `;

  // Corpo do modal com iframe
  const iframe = document.createElement("iframe");
  iframe.src = rota;
  iframe.style.cssText = "border:none;flex:1;";
  iframe.setAttribute("data-apoio", "iframe");
   // 🔒 sandbox: isola totalmente o JS do apoio
  iframe.sandbox = "allow-scripts allow-forms allow-same-origin allow-popups";

  // Monta a estrutura
  modal.appendChild(header);
  modal.appendChild(iframe);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Botão fechar manual
  header.querySelector("button").onclick = () => {
    GlobalUtils.fecharJanelaApoio(nivel);
  };

  // Comunicação com o iframe
  iframe.onload = () => {
    setTimeout(() => {
      const payload = id !== null
        ? { grupo: "carregarApoio", id, nivel, extras }
        : { grupo: "apoioPronto", nivel, extras };

      iframe.contentWindow.postMessage(payload, "*");
    }, 100);
  };
};





/******************** MODAL - Usado no apoio para Receber informações da janela principal *************************** */
GlobalUtils.receberDadosApoio = function (callback) {

  window.addEventListener("message", (event) => {

    if (!event.data?.grupo) {
      console.warn("⚠️ Mensagem ignorada: sem 'grupo' definido.");
      return;
    }

    // Armazena nível (se vier)
    const nivel = event.data.nivel !== undefined ? event.data.nivel : 1;
    window.__nivelModal__ = nivel;

    if (event.data.grupo === "carregarApoio" && event.data.id !== undefined) {
      callback(event.data.id, nivel);
    }

    if (event.data.grupo === "apoioPronto") {
      callback(null, nivel);
    }
  });
};





/*************************** MODAL Função padrão para FECHAR o apoio  ***********************************/
GlobalUtils.fecharJanelaApoio = function (nivel) {
  const fecharEm = (doc, alvoNivel) => {
    if (!doc) return false;

    const overlays = Array.from(doc.querySelectorAll('[id^="modalApoioOverlay_nivel"]'));
    if (!overlays.length) return false;

    let alvos = [];
    if (alvoNivel == null) {
      // fecha o de maior nível (topo)
      alvos = overlays.sort((a, b) => {
        const na = Number(a.id.replace(/\D/g, "")) || 0;
        const nb = Number(b.id.replace(/\D/g, "")) || 0;
        return nb - na;
      }).slice(0, 1);
    } else {
      alvos = overlays.filter(el => el.id === `modalApoioOverlay_nivel${alvoNivel}`);
    }

    alvos.forEach((overlay) => {
      const iframe = overlay.querySelector('iframe[data-apoio="iframe"]');
      try {
        iframe?.contentWindow?.postMessage({ grupo: "__dispose__" }, "*"); // opcional
        if (iframe) iframe.src = "about:blank"; // mata execução no apoio
      } catch {}
      overlay.remove();
    });

    return !!alvos.length;
  };

  const fechouAqui   = fecharEm(document, nivel);
  const fechouParent = fecharEm(window.parent?.document, nivel);

  if (!fechouAqui && !fechouParent) {
    console.warn(`⚠️ Nenhum modal encontrado no nível ${nivel ?? "(topo)"}`);
  }
};









// --------------------------------------------------------
// DOCUMENTAÇÕES (CEP, CPF, CNPJ, telefone e placa)
// --------------------------------------------------------

// CPF
// --------------------------------------------------------
window.Util.limparMascaraCPF = function (cpf) {
    return cpf ? cpf.replace(/\D/g, '') : '';
};

window.Util.formatarCPF = function (cpf) {
    cpf = (cpf || "").replace(/\D/g, "");
    cpf = cpf.replace(/(\d{3})(\d)/, "$1.$2");
    cpf = cpf.replace(/(\d{3})(\d)/, "$1.$2");
    cpf = cpf.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    return cpf;
};

window.Util.validarCPF = function (cpf) {
    cpf = window.Util.limparMascaraCPF(cpf);
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
    let soma = 0;
    for (let i = 0; i < 9; i++) soma += parseInt(cpf.charAt(i), 10) * (10 - i);
    let digito1 = (soma * 10) % 11; if (digito1 >= 10) digito1 = 0;
    if (digito1 !== parseInt(cpf.charAt(9), 10)) return false;
    soma = 0;
    for (let i = 0; i < 10; i++) soma += parseInt(cpf.charAt(i), 10) * (11 - i);
    let digito2 = (soma * 10) % 11; if (digito2 >= 10) digito2 = 0;
    return digito2 === parseInt(cpf.charAt(10), 10);
};

// CNPJ
// --------------------------------------------------------
window.Util.validarCNPJ = function (cnpj) {
    cnpj = (cnpj || "").replace(/[^\d]+/g, '');
    if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
    const calc = (x) => {
        let n = 0, y = x.length - 7;
        for (let i = 0; i < x.length; i++) {
            n += x[i] * y--;
            if (y < 2) y = 9;
        }
        return n % 11 < 2 ? 0 : 11 - (n % 11);
    };
    const nums = cnpj.substring(0, 12).split('').map(Number);
    const d1 = calc(nums);
    const d2 = calc([...nums, d1]);
    return d1 === parseInt(cnpj[12], 10) && d2 === parseInt(cnpj[13], 10);
};

window.Util.aplicarMascaraCNPJ = function (input) {
    input.addEventListener("input", () => {
        let cnpj = input.value.replace(/\D/g, '');
        cnpj = cnpj.replace(/^(\d{2})(\d)/, '$1.$2');
        cnpj = cnpj.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
        cnpj = cnpj.replace(/\.(\d{3})(\d)/, '.$1/$2');
        cnpj = cnpj.replace(/(\d{4})(\d)/, '$1-$2');
        input.value = cnpj;
    });
};

window.Util.limparMascaraCNPJ = function (texto) {
    return texto ? texto.replace(/\D/g, '') : '';
};

window.Util.formatarCNPJ = function (texto) {
    let cnpj = (texto || "").replace(/\D/g, '');
    if (cnpj.length !== 14) return texto || '';
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
};

// CEP
// --------------------------------------------------------
window.Util.limparMascaraCEP = function (texto) {
    return texto ? texto.replace(/\D/g, '') : '';
};

window.Util.formatarCEP = function (texto) {
    let cep = (texto || "").replace(/\D/g, '');
    if (cep.length !== 8) return texto || '';
    return cep.replace(/(\d{5})(\d{3})/, "$1-$2");
};

window.Util.aplicarMascaraCEP = function (input) {
    input.addEventListener("input", () => {
        let cep = input.value.replace(/\D/g, '');
        if (cep.length > 5) cep = `${cep.substring(0, 5)}-${cep.substring(5, 8)}`;
        input.value = cep;
    });
};

// Telefone
// --------------------------------------------------------
window.Util.limparMascaraTelefone = function (texto) {
    return texto ? texto.replace(/\D/g, '') : '';
};

window.Util.formatarTelefone = function (texto) {
    let tel = (texto || "").replace(/\D/g, '');
    if (tel.length === 11) {
        return tel.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    } else if (tel.length === 10) {
        return tel.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    }
    return texto || '';
};

window.Util.aplicarMascaraTelefone = function (input) {
    input.addEventListener("input", () => {
        input.value = window.Util.formatarTelefone(input.value);
    });
};

// Placa (BR — Mercosul e antigo)
// --------------------------------------------------------
window.Util.limparMascaraPlaca = function (texto) {
    return (texto || "").toUpperCase().replace(/[^A-Z0-9]/g, '');
};

window.Util.formatarPlaca = function (texto) {
    const raw = window.Util.limparMascaraPlaca(texto);
    // Mantém somente letras/números e insere hífen após 3 caracteres (compatível com AAA-0000 e AAA-0A00)
    if (raw.length <= 3) return raw;
    return `${raw.substring(0, 3)}-${raw.substring(3, 7)}`;
};



// --------------------------------------------------------
// NÚMEROS (valores, casas decimais, R%)
// --------------------------------------------------------
window.Util.converterInteiro = function (valor) {
    const n = parseInt(valor, 10);
    return isNaN(n) ? 0 : n;
};

window.Util.formatarDecimal = function (valor, casas = 2) {
    const n = Number(valor);
    if (isNaN(n)) return "0".toFixed(casas);
    return n.toFixed(casas);
};

window.Util.formatarPercentual = function (valor, casas = 2) {
    const n = Number(valor);
    if (isNaN(n)) return `0,00%`;
    const pct = (n * 100).toFixed(casas);
    return pct.replace('.', ',') + '%';
};

window.Util.formatarMoeda = function (valor) {
    const n = Number(valor);
    if (isNaN(n)) return "R$ 0,00";
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
};


// --------------------------------------------------------
// DATAS E HORAS (data e hora)
// --------------------------------------------------------
window.Util._parseData = function (valor) {
    try {
        if (valor instanceof Date) return valor;
        const str = String(valor).trim();

        if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(str)) {
            const hoje = new Date();
            const [h, m, s] = str.split(":");
            hoje.setHours(parseInt(h, 10), parseInt(m, 10), parseInt(s || 0, 10), 0);
            return hoje;
        }
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str)) return new Date(str);
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
            const [ano, mes, dia] = str.split("-");
            return new Date(parseInt(ano, 10), parseInt(mes, 10) - 1, parseInt(dia, 10));
        }
        if (/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/.test(str)) {
            const [dataPart, horaPart] = str.split(" ");
            const [dia, mes, ano] = dataPart.split("/");
            const [hora, minuto] = horaPart.split(":");
            return new Date(parseInt(ano, 10), parseInt(mes, 10) - 1, parseInt(dia, 10), parseInt(hora, 10), parseInt(minuto, 10));
        }
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
            const [dia, mes, ano] = str.split("/");
            return new Date(parseInt(ano, 10), parseInt(mes, 10) - 1, parseInt(dia, 10));
        }
        const tentativa = new Date(str);
        if (!isNaN(tentativa)) return tentativa;
        return null;
    } catch {
        return null;
    }
};

window.Util.paraDataBR = function (valor) {    // Saída = DD/MM/AAAA
    const d = window.Util._parseData(valor);
    if (!d) return "";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
};

window.Util.paraDataISO = function (valor) {  // Saída = AAAA-MM-DD
    if (!valor) {
        return "";
    }

    // ✅ NOVO: se vier datetime (YYYY-MM-DDTHH:MM...), corta só a parte da data
    if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}T/.test(valor)) {
        return valor.slice(0, 10);
    }

    if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        return valor;
    }

    if (typeof valor === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(valor)) {
        const [dd, mm, aaaa] = valor.split("/");
        return `${aaaa}-${mm}-${dd}`;
    }

    const d = window.Util._parseData(valor);
    if (!d) {
        return "";
    }

    const y   = d.getFullYear();
    const m   = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dia}`;
};


window.Util.paraDataBR_completo = function (valor) {  // Saída = DD/MM/AAAA HH:MM
    const d = window.Util._parseData(valor);
    if (!d) return "";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
};

window.Util.paraHoraBR = function (valor) {  // Saída = HH:MM
    const d = window.Util._parseData(valor);
    if (!d) return "";
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mi}`;
};

window.Util.paraHoraISO = function (valor) {  // Saída = HH:MM:SS
    const d = window.Util._parseData(valor);
    if (!d) return "";
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${hh}:${mi}:${ss}`;
};

window.Util.converterExcelParaData = function (excelDate) {  // Converte número do Excel (dias desde 30/12/1899) para data BR
    if (!excelDate || isNaN(excelDate)) return "";
    const base = new Date(1899, 11, 30);
    base.setDate(base.getDate() + Math.floor(excelDate));
    return base.toLocaleDateString("pt-BR");
};

window.Util.converterExcelParaHora = function (excelDate) {  // Converte número do Excel (fração do dia) para hora HH:MM
    if (!excelDate || isNaN(excelDate)) return "";
    const totalSegundos = Math.round((excelDate % 1) * 24 * 60 * 60);
    const horas = Math.floor(totalSegundos / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`;
};

window.Util.hojeISO = function () {  // Retorna a data atual no formato AAAA-MM-DD
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dia}`;
};






// --------------------------------------------------------
// OUTRAS FUNÇÕES ÚTEIS
// --------------------------------------------------------

//Seleciona um arquivo e retorna o arquivo selecionado no PC
window.Util.selecionarArquivo = function (acceptType = "*", multiple = false, callback) {  // acceptType ex: ".pdf, .doc, .docx, image/*"
    const input = document.createElement("input");
    input.type = "file";
    input.accept = acceptType;
    input.multiple = multiple;

    input.addEventListener("change", function () {
        if (input.files.length > 0) {
            if (multiple) {
                callback(Array.from(input.files)); // Retorna um array de arquivos
            } else {
                callback(input.files[0]); // Retorna um único arquivo
            }
        }
    });

    input.click(); // Abre a janela do Windows para seleção de arquivo
}



// ------------------------------
// 🛠️ FUNÇÕES UTILITÁRIAS
// ------------------------------

// Função para Carregar combobox do tipo de categorias
window.Util.TIPOS_ORIGEM = [
  "Favorecido",
  "Funcionário",
  "Livro Diário",
  "Projetos",
  "Reembolso"
];


// TIPOS DE CONTA PADRÃO (aqui é pra carregar no combobox do livro diário)
window.Util.TIPOS_CONTA_PADRAO = [
  { valor: "Banco", label: "Conta Bancária" },
  { valor: "Cartão", label: "Cartão de Crédito" },
  { valor: "Digital", label: "Conta Digital" },
  { valor: "Investimento", label: "Conta de Investimento" },
  { valor: "Adiantamento", label: "Adiantamento a Funcionário" },
  { valor: "Pré-pago", label: "Cartão Pré-pago" }
];



// Função para carregar categorias no combobox
window.GlobalUtils.carregarCategorias = async function (
  cfgOrOndeUsa,
  idSelectFallback = "id_categoria",
  valorSelecionadoFallback = null
) {
  try {
    // --------- entrada flexível: objeto OU parâmetros soltos ---------
    let ondeUsa, idSelect, valorSelecionado, id_empresa;

    if (typeof cfgOrOndeUsa === "object" && cfgOrOndeUsa !== null) {
      ondeUsa           = cfgOrOndeUsa.origem || cfgOrOndeUsa.ondeUsa || cfgOrOndeUsa.modulo || "Favorecido";
      idSelect          = cfgOrOndeUsa.destino || cfgOrOndeUsa.idSelect || idSelectFallback;
      valorSelecionado  = cfgOrOndeUsa.valor || cfgOrOndeUsa.valorSelecionado || valorSelecionadoFallback;
      id_empresa        = cfgOrOndeUsa.id_empresa;
    } else {
      ondeUsa           = cfgOrOndeUsa || "Favorecido";
      idSelect          = idSelectFallback;
      valorSelecionado  = valorSelecionadoFallback;
    }

    // --------- recuperar id_empresa (sem travar fluxo) ---------
    if (!id_empresa) {
      id_empresa =
          window.Util?.localstorage?.("id_empresa", null) ??
          sessionStorage.getItem("id_empresa") ??
          window.App?.Varidcliente ??
          null;
    }

    const select = document.getElementById(idSelect);
    if (!select) return;

    // reset básico
    select.innerHTML = '<option value="">Selecione</option>';

    // monta query (se tiver id_empresa, envia; senão, deixa a rota decidir)
    const params = new URLSearchParams({ onde_usa: ondeUsa });
    if (id_empresa) params.append("id_empresa", id_empresa);

    const resp = await fetch(`/combobox/categorias?${params.toString()}`);
    const categorias = await resp.json();

    // ordena A→Z e preenche
    categorias
      .sort((a, b) => (a.nome_categoria || "").localeCompare(b.nome_categoria || "", "pt-BR"))
      .forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat.id;
        opt.textContent = cat.nome_categoria;
        select.appendChild(opt);
      });

    if (valorSelecionadoFallback || valorSelecionado) {
      select.value = String(valorSelecionado || valorSelecionadoFallback);
    }

    // dispara change para manter qualquer UI espelhada sincronizada
    select.dispatchEvent(new Event("change"));
  } catch (e) {
    console.error("Erro ao carregar categorias:", e);
  }
};





// Função para carregar plano de contas no combobox
window.GlobalUtils.carregarPlanoContas = async function ({
  idInputId = "id_planocontas",
  comboInputId = "combo_display",
  areaId = "combo_area",
  inputBuscaId = "conta_contabil_input",
  listaId = "sugestoes_contas",
  valorSelecionado = null,
  descricaoPreenchida = ""
} = {}) {
  const combo = document.getElementById(comboInputId);
  const area = document.getElementById(areaId);
  const inputBusca = document.getElementById(inputBuscaId);
  const lista = document.getElementById(listaId);
  const inputId = document.getElementById(idInputId);

  if (!combo || !area || !inputBusca || !lista || !inputId) return;

  combo.addEventListener("click", () => {
    area.style.display = "block";
    inputBusca.focus();
  });

  inputBusca.addEventListener("input", async () => {
    const termo = inputBusca.value.trim();
    if (termo.length < 3) {
      lista.innerHTML = "<li class='autocomplete-item'>Digite 3 ou mais caracteres</li>";
      return;
    }

    try {
      const resp = await fetch(`/combobox/plano_contas?termo=${encodeURIComponent(termo)}`);
      const sugestoes = await resp.json();
      lista.innerHTML = "";

      if (!sugestoes.length) {
        lista.innerHTML = "<li class='autocomplete-item'>Nenhum resultado encontrado</li>";
        return;
      }

      sugestoes.forEach(item => {
        const li = document.createElement("li");
        li.className = "autocomplete-item";
        li.textContent = `${item.descricao} | ${item.plano}`;
        li.addEventListener("click", () => {
          inputId.value = item.id;
          combo.value = `${item.descricao} | ${item.plano}`;
          combo.innerText = `${item.descricao} | ${item.plano}`;
          inputBusca.value = "";
          lista.innerHTML = "";
          area.style.display = "none";
        });
        lista.appendChild(li);
      });

    } catch (e) {
      console.error("Erro ao buscar plano de contas:", e);
      lista.innerHTML = "<li class='autocomplete-item'>Erro ao buscar dados</li>";
    }
  });

  document.addEventListener("click", (e) => {
    if (!combo.contains(e.target) && !area.contains(e.target)) {
      area.style.display = "none";
    }
  });

  if (valorSelecionado && descricaoPreenchida) {
    inputId.value = valorSelecionado;
    combo.value = descricaoPreenchida;
    combo.innerText = descricaoPreenchida;
  }
};


// Função para carregar formas de pagamento no combobox
window.GlobalUtils.carregarFormasPagamento = async function (idSelect, id_empresa) {
  if (!id_empresa) return;

  try {
    const resp = await fetch(`/combobox/formas_pagamento?id_empresa=${id_empresa}`);
    const lista = await resp.json();

    const select = document.getElementById(idSelect);
    if (!select) return;

    select.innerHTML = `<option value="">Selecione</option>`;
    lista.forEach(fp => {
      const opt = document.createElement("option");
      opt.value = fp.id;
      opt.textContent = fp.nome_exibicao;
      select.appendChild(opt);
    });
  } catch (e) {
    console.warn("Erro ao carregar formas de pagamento:", e);
  }
};


// Função para limpar o LocalStorage do usuário, mantendo apenas a aceitação de cookies
window.GlobalUtils.limparStorageUsuario = function () {
  Object.keys(localStorage).forEach(chave => {
    if (chave !== "cookie_aceito") {
      localStorage.removeItem(chave);
    }
  });
};


// -----------------------------------------------------------------------------------------
// FUNÇÔES ASYNC/AWAIT
// -----------------------------------------------------------------------------------------

// CARREGAR CONFIGURAÇÕES
async function carregarConfiguracoes() {
  try {
    if (!App.Varidcliente) return console.warn("⚠️ App.Varidcliente não definido ainda.");

    const response = await fetch(`/configuracoes/${App.Varidcliente}`);
    const data = await response.json();

    if (data.success) {
      window.Config = data.config;
    } else {
      console.error("Erro ao buscar configurações:", data.message);
    }
  } catch (error) {
    console.error("Erro ao buscar configurações:", error);
  }
}


// FUNÇÃO PARA CARREGAR SCRIPTS EXTERNOS UMA ÚNICA VEZ
async function carregarScriptCDN(src, id = null) {
  return new Promise((resolve, reject) => {
    if (id && document.getElementById(id)) return resolve(); // já carregado
    const script = document.createElement("script");
    script.src = src;
    if (id) script.id = id;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}




// --------------------------------------------------------------------------
// UMA ÚNICA FUNÇÃO: Util.localstorage(campo, padrao)
// Lê valores do localStorage de acordo com o "campo" lógico pedido.
// Mantém as chaves: "usuarioLogado", "empresaAtiva", "horaLogin"
// --------------------------------------------------------------------------
window.Util.localstorage = function (campo, padrao = null) {
  // mapa fixo: campo lógico -> { chave: <localStorageKey>, path: <prop> | null, toInt?: true }
  const MAPA = {
    // --- USUÁRIO (usuarioLogado) ---
    "id_usuario":              { chave: "usuarioLogado", path: "id_usuario", toInt: true },
    "nome":                    { chave: "usuarioLogado", path: "nome" },
    "imagem":                  { chave: "usuarioLogado", path: "imagem" },
    "id_ultima_novidade_lida": { chave: "usuarioLogado", path: "id_ultima_novidade_lida", toInt: true },

    // --- EMPRESA (empresaAtiva) ---
    "id_empresa":              { chave: "empresaAtiva",  path: "id_empresa", toInt: true },
    "nome_amigavel":           { chave: "empresaAtiva",  path: "nome_amigavel" },

    // --- META (solto) ---
    "horaLogin":               { chave: "horaLogin",     path: null }
  };

  const definicao = MAPA[campo];
  if (!definicao) return padrao;

  // valor "solto" (não-JSON)
  if (definicao.path === null) {
    const bruto = localStorage.getItem(definicao.chave);
    return bruto !== null ? bruto : padrao;
  }

  // valor dentro de JSON
  let objeto;
  try {
    objeto = JSON.parse(localStorage.getItem(definicao.chave) || "{}");
  } catch {
    objeto = {};
  }

  let valor = objeto[definicao.path];

  if (definicao.toInt) {
    const n = Number(valor);
    return Number.isInteger(n) ? n : padrao;
  }

  return (valor !== undefined && valor !== null) ? valor : padrao;
};






// ============================ COMBOBOX PADRÃO TECH ============================
// Toggle global de debug (pode silenciar logs caso queira)
window.__DEBUG_COMBOBUSCA = window.__DEBUG_COMBOBUSCA ?? false;
const _cbLog = (...args) => { if (window.__DEBUG_COMBOBUSCA) console.log("ComboBusca:", ...args); };

// Namespace
if (!window.GlobalUtils) window.GlobalUtils = {};

// === [ComboBusca] MÓDULO GLOBAL (início) ===
(function () {
  const KEY = { UP: 38, DOWN: 40, ENTER: 13, ESC: 27, TAB: 9 };

  const DEFAULTS = {
    minChars: 3,
    limite: 20,
    debounceMs: 280,
    cache: true,
    linhas: [],                 // até 5: [{ campo, rotulo?, formatter? }, ...]
    valorInicial: null,         // { id, label } opcional
    onSelect: null,             // function(item)
    mapeador: null,             // function(serverItem) -> item pronto
    queryBuilder: null,         // function(termo) -> payload/params
    fetchFn: null,              // async (termo) => {retorno, itens, msg}
    rota: null,                 // se não usar fetchFn, usa rota (POST JSON)
    campoOcultoId: null         // id de <input type="hidden"> para gravar item.id
  };

  function debounce(fn, ms) {
    let t; return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
  }

  function makeCacheKey(rota, termo) {
    const emp = (window.Util && typeof window.Util.localstorage === "function")
      ? (window.Util.localstorage("id_empresa") ?? "")
      : "";
    return `${rota || "customFn"}::${emp}::${termo}`;
  }

  function highlight(texto, termo) {
    if (!termo) return texto;
    try {
      const rx = new RegExp(`(${termo.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')})`, "ig");
      return String(texto).replace(rx, "<mark>$1</mark>");
    } catch { return String(texto); }
  }

  function renderItemHTML(item, termo, linhas) {
    const partes = [];
    for (let i = 0; i < Math.min(linhas.length, 5); i++) {
      const def = linhas[i];
      if (!def || !def.campo) continue;

      let valor = item?.[def.campo];
      if (valor === undefined || valor === null || valor === "") continue;

      if (typeof def.formatter === "function") {
        try { valor = def.formatter(valor, item); } catch {}
      }

      const rotuloHTML = def.rotulo ? `<span class="Cl_Item__rotulo">${String(def.rotulo)}</span>` : "";
      const clsLinha = `Cl_Item__linha Cl_Item__linha--${i + 1}`;
      const linhaHTML = (i === 0)
        ? `<div class="${clsLinha}">${highlight(String(valor), termo)}</div>`
        : `<div class="${clsLinha}">${rotuloHTML}<span class="Cl_Match">${highlight(String(valor), termo)}</span></div>`;
      partes.push(linhaHTML);
    }

    if (partes.length === 0) {
      const label = item?.label ?? item?.nome ?? "(sem dados)";
      partes.push(`<div class="Cl_Item__linha Cl_Item__linha--1">${highlight(String(label), termo)}</div>`);
    }

    return `<div class="Cl_Item" role="option" data-id="${item?.id ?? ""}">${partes.join("")}</div>`;
  }

  // Descobre ancestrais roláveis para reposicionar o painel ao rolar
  function getScrollParents(el){
    const parents = [];
    let p = el && el.parentNode;

    while (p && p !== document.body){
      const s = p instanceof Element ? window.getComputedStyle(p) : null;
      if (s){
        const ov = `${s.overflow} ${s.overflowX} ${s.overflowY}`;
        if (/(auto|scroll|overlay)/.test(ov)) parents.push(p);
      }
      p = p.parentNode;
    }
    parents.push(window); // sempre a janela
    return parents;
  }


  function attach(userCfg) {
    const cfg = { ...DEFAULTS, ...userCfg };
    if (!cfg.wrapSel || !cfg.displaySel || !cfg.panelSel || !cfg.searchSel || !cfg.listSel) {
      console.error("📦 ComboBusca: config inválida (seletor ausente).", cfg);
      return;
    }

    const $wrap    = document.querySelector(cfg.wrapSel);
    const $display = document.querySelector(cfg.displaySel);
    const $panel   = document.querySelector(cfg.panelSel);
    const $search  = document.querySelector(cfg.searchSel);
    const $list    = document.querySelector(cfg.listSel);
    const $status  = cfg.statusSel ? document.querySelector(cfg.statusSel) : null;
    const $hidden  = cfg.campoOcultoId ? document.getElementById(cfg.campoOcultoId) : null;



    // mata o autocompletar nativo do browser
    $search.setAttribute("autocomplete", "new-password"); // mais eficaz que "off"
    $search.setAttribute("autocapitalize", "off");
    $search.setAttribute("autocorrect", "off");
    $search.setAttribute("spellcheck", "false");

    // truque: dar um name único pra não bater com histórico salvo
    $search.setAttribute("name", `cb_search_${Date.now()}`);




    if (!$wrap || !$display || !$panel || !$search || !$list) {
      console.error("📦 ComboBusca: elementos não encontrados.", cfg);
      return;
    }

    let itens = [];
    let selIndex = -1;
    let aberto = false;
    let aborter = null;
    const cache = new Map();
    let floating = false;   
    let scrollParents = [];  

    function positionPanel(){
      const rect = $display.getBoundingClientRect();
      const vh   = window.innerHeight;
      const gap  = 6;

      if (!floating){
        document.body.appendChild($panel);
        $panel.classList.add("is-floating");
        floating = true;
      }

      // sempre para BAIXO (sem flip)
      const maxDown   = Math.max(80, vh - rect.bottom - gap - 8);   // espaço útil abaixo
      const desiredH  = Math.min($panel.scrollHeight, 280, maxDown); // cabe na viewport

      // largura e alinhamento = exatamente a do input
      const width = Math.round(rect.width);
      const left  = Math.round(rect.left);
      const top   = Math.round(rect.bottom + gap);

      $panel.style.left      = `${left}px`;
      $panel.style.top       = `${top}px`;
      $panel.style.width     = `${width}px`;
      $panel.style.maxHeight = `${desiredH}px`;
    }





    function attachScrollListeners(){
      scrollParents = getScrollParents($wrap);
      scrollParents.forEach(p => p.addEventListener('scroll', positionPanel, {passive:true}));
      window.addEventListener('resize', positionPanel, {passive:true});
    }

    function detachScrollListeners(){
      scrollParents.forEach(p => p.removeEventListener('scroll', positionPanel));
      window.removeEventListener('resize', positionPanel);
      scrollParents = [];
    }


    function abrir(){
      if (aberto) return;
      $wrap.classList.add("open");
      $panel.setAttribute("aria-hidden","false");
      aberto = true;
      attachScrollListeners();
      positionPanel();              
      // evita o popup de histórico *no primeiro foco*
      $search.setAttribute("readonly", "readonly");
      setTimeout(() => {
        $search.removeAttribute("readonly");
        $search.focus();                 // garante foco após remover readonly
      }, 30);

      if (typeof cfg.onOpen === "function") cfg.onOpen();
      setTimeout(()=> $search.focus(), 0);
    }


    function fechar(){
      if (!aberto) return;
      $wrap.classList.remove("open");
      $panel.setAttribute("aria-hidden","true");
      aberto = false;
      selIndex = -1;
      detachScrollListeners();
      unfloat();
      if (typeof cfg.onClose === "function") cfg.onClose();
    }

    function unfloat(){
      if (!floating) return;
      $wrap.appendChild($panel);
      $panel.classList.remove("is-floating");
      $panel.style.left = $panel.style.top = $panel.style.width = "";
      floating = false;
    }


    function selecionarAtual() {
      if (selIndex < 0 || selIndex >= itens.length) return;
      aplicarSelecao(itens[selIndex]);
    }

    function aplicarSelecao(item) {
      const labelDisplay =
        item?.label ??
        item?.nome ??
        (cfg.linhas?.[0]?.campo ? (item?.[cfg.linhas[0].campo] ?? "") : "");

      $display.value = String(labelDisplay || "").trim();
      if ($hidden) $hidden.value = item?.id ?? "";
      if (typeof cfg.onSelect === "function") cfg.onSelect(item);
      fechar();
    }

    function desenharLista(termo) {
      $list.innerHTML = itens.map((it) => renderItemHTML(it, termo, cfg.linhas || [])).join("");
      selIndex = (itens.length > 0) ? 0 : -1;
      syncSelVisual();
      positionPanel();
    }

    function syncSelVisual() {
      const nodes = $list.querySelectorAll(".Cl_Item");
      nodes.forEach((n, i) => n.classList.toggle("Cl_sel", i === selIndex));
    }

    function mover(direcao) {
      if (!itens.length) return;
      selIndex = (selIndex + direcao + itens.length) % itens.length;
      syncSelVisual();
      const alvo = $list.querySelectorAll(".Cl_Item")[selIndex];
      if (alvo) {
        const top = alvo.offsetTop;
        const bot = top + alvo.offsetHeight;
        if (top < $list.scrollTop) $list.scrollTop = top;
        else if (bot > $list.scrollTop + $list.clientHeight) $list.scrollTop = bot - $list.clientHeight;
      }
    }

    async function buscar(termo) {
      if (!termo || termo.length < cfg.minChars) {
        itens = []; $list.innerHTML = ""; if ($status) $status.textContent = ""; return;
      }
      const useKey = cfg.cache ? makeCacheKey(cfg.rota, termo) : null;
      if (cfg.cache && cache.has(useKey)) {
        itens = cache.get(useKey) || [];
        desenharLista(termo);
        if ($status) $status.textContent = `${itens.length} resultado(s)`; return;
      }

      if (aborter) aborter.abort();
      aborter = new AbortController();

      try {
        if ($status) $status.textContent = "Carregando...";
        let resposta = null;

        if (typeof cfg.fetchFn === "function") {
          resposta = await cfg.fetchFn(termo, { signal: aborter.signal });
        } else if (cfg.rota) {
          const payload = (typeof cfg.queryBuilder === "function")
            ? cfg.queryBuilder(termo)
            : { q: termo, limite: cfg.limite };

          const resp = await fetch(cfg.rota, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: aborter.signal
          });
          if (!resp.ok) throw new Error("HTTP " + resp.status);
          resposta = await resp.json();
        } else {
          throw new Error("Sem rota ou fetchFn");
        }

        const itensBrutos = Array.isArray(resposta?.itens) ? resposta.itens : (Array.isArray(resposta) ? resposta : []);
        itens = cfg.mapeador ? itensBrutos.map(cfg.mapeador) : itensBrutos;

        if (cfg.cache && useKey) cache.set(useKey, itens);

        desenharLista(termo);
        if ($status) $status.textContent = itens.length ? `${itens.length} resultado(s)` : "Sem resultados";
      } catch (e) {
        _cbLog("erro busca:", e);
        if ($status) $status.textContent = "Erro ao carregar";
        itens = []; $list.innerHTML = "";
      }
    }

    const buscarDebounced = debounce((v) => buscar(v), cfg.debounceMs);

    $display.addEventListener("click", () => { if (!$display.disabled) abrir(); });

    $search.addEventListener("input", (e) => {
      const termo = e.target.value?.trim() ?? "";
      buscarDebounced(termo);
    });

    $search.addEventListener("keydown", (e) => {
      switch (e.keyCode) {
        case KEY.DOWN: e.preventDefault(); mover(+1); break;
        case KEY.UP:   e.preventDefault(); mover(-1); break;
        case KEY.ENTER: e.preventDefault(); selecionarAtual(); break;
        case KEY.ESC:   e.preventDefault(); fechar(); break;
        default: break;
      }
    });

    $list.addEventListener("mousemove", (e) => {
      const el = e.target.closest(".Cl_Item"); if (!el) return;
      const idx = Array.from($list.querySelectorAll(".Cl_Item")).indexOf(el);
      if (idx >= 0) { selIndex = idx; syncSelVisual(); }
    });

    $list.addEventListener("click", (e) => {
      const el = e.target.closest(".Cl_Item"); if (!el) return;
      const idx = Array.from($list.querySelectorAll(".Cl_Item")).indexOf(el);
      if (idx >= 0) { selIndex = idx; selecionarAtual(); }
    });

    document.addEventListener("mousedown", (e) => {
      const clicouDentro = $wrap.contains(e.target) || $panel.contains(e.target);
      if (!clicouDentro) fechar();
    });


    if (cfg.valorInicial && (cfg.valorInicial.label || cfg.valorInicial.id)) {
      $display.value = cfg.valorInicial.label ?? "";
      if ($hidden) $hidden.value = cfg.valorInicial.id ?? "";
    }

    _cbLog("iniciado", cfg);
    return { abrir, fechar, buscar };
  }

  // Expondo no namespace global
  window.GlobalUtils.ComboboxBusca = { attach };
})();
// === [ComboBusca] MÓDULO GLOBAL (fim) ===





// -----------------------------------------------------------------------------------------
// FUNÇÔES DE ÍCONES
// -----------------------------------------------------------------------------------------
window.Util.gerarIconeTech = function(nome) {
  const iconesLucide = {
    adicionar: 'plus',
    ajuda: 'help-circle',
    anexo: 'paperclip',
    assinatura: 'pen-tool',
    cancelar: 'x-circle',
    categorias: 'list',
    chamado: 'life-buoy',
    compras: 'shopping-cart',
    configuracoes: 'settings',
    departamentos: 'building',
    documentacao: 'book-open',
    editar: 'pencil',
    email: 'mail',
    email_aberto: 'mail-open',
    email_enviado: 'send',
    email_erro: 'alert-circle',
    excluir: 'trash-2',
    favorecidos: 'users',
    financeiro: 'wallet',
    info: 'info',
    livro_diario: 'banknote',
    mais: 'plus',
    menos: 'minus',
    nf_hub: 'receipt-text', 
    nivel_acesso: 'badge-check',
    novidades: 'sparkles',
    ocultar: 'eye-off',
    perfil: 'user',
    Principal: 'layout-dashboard',
    plano_contas: 'folder-tree',
    projetos: 'layout-dashboard',
    sair: 'log-out',
    salvar: 'check-circle',
    suporte: 'life-buoy',
    visualizar: 'eye',
    estoque: 'boxes',              // Controle de estoque
    reembolso: 'receipt',          // Reembolso de despesas
    adiantamento_viagem: 'plane'   // Adiantamento de viagem


  };

  const iconeLucide = iconesLucide[nome];
  if (!iconeLucide) {
    console.warn(`Ícone TECH não encontrado para: ${nome}`);
    return '';
  }

  const el = document.createElement('i');
  el.setAttribute('data-lucide', iconeLucide);
  el.className = 'icon-tech';
  return el.outerHTML;
};