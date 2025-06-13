if (document.getElementById("ob_btnVoltar")) {
    document.getElementById("ob_btnVoltar").addEventListener("click", () => {
        carregarPagina("configuracoes");
    });

    window.Util?.removerCSSAtual("frm_emconstrucao.html");
}
