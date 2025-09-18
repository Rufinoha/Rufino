window.GlobalUtils.carregarPagina = async function (pagina) {
  const conteudo = document.getElementById("content-area");
  if (!conteudo) return;

  Object.keys(window).forEach(key => {
    if (key.endsWith("Hub")) {
      delete window[key];
    }
  });

  conteudo.innerHTML = "";
  document.querySelectorAll("script[data-page-script]").forEach(s => s.remove());

  let partes = pagina.split("/");
  let modulo = partes[0];
  let isModulo = pagina.startsWith("mod_");

  if (isModulo && partes.length < 2) {
    console.error(`Página inválida: "${pagina}" — módulo sem página`);
    Swal.fire("Erro", "Página inválida (módulo sem destino)", "error");
    return;
  }

  let rota = `/${pagina}`;

  let staticPath = isModulo
      ? `/static/${modulo.replace('mod_', '')}/script`
      : `/static/script`;

  let paginaNome = isModulo ? partes[1] : pagina;

  try {
    const res = await fetch(rota);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    conteudo.innerHTML = html;
    conteudo.setAttribute("data-page", pagina);


    //await carregarScriptCDN("/static/script/global_utils.js", "globalutils");
    await carregarScriptCDN("https://cdn.jsdelivr.net/npm/chart.js", "chartjs");
    // await carregarScriptCDN("https://unpkg.com/lucide@0.257.0", "lucide");
    

    const script = document.createElement("script");
    script.src = `${staticPath}/S${paginaNome}.js?t=${Date.now()}`;
    script.defer = true;
    script.setAttribute("data-page-script", pagina);
    document.body.appendChild(script);

  } catch (err) {
    console.error(`Erro ao carregar ${pagina}`, err);
    Swal.fire("Erro", `Não foi possível abrir a página \"${pagina}\"`, "error");
  }
};