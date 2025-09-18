
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

(function () {
  const cards = document.querySelectorAll('.integration-card');

  function showComingSoon(name){
    Swal.fire({
      title: 'Em desenvolvimento',
      html: `
        <div style="text-align:left">
          <p><strong>${name}</strong> está na nossa rota de integrações.</p>
          <p>Se precisar priorizar para sua empresa, fale com nosso time 😉</p>
        </div>
      `,
      icon: 'info',
      confirmButtonText: 'Ok',
      confirmButtonColor: '#85C300',       // verde TECH
      background: '#FFFCFB',               // branco TECH
      color: '#333333',                    // cinza escuro TECH
      customClass: {
        popup: 'swal2-tech'
      }
    });
  }

  cards.forEach(card => {
    card.addEventListener('click', () => {
      const name = card.getAttribute('data-name') || 'Integração';
      showComingSoon(name);
    });

    // acessibilidade: Enter/Espaço ativa o card
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const name = card.getAttribute('data-name') || 'Integração';
        showComingSoon(name);
      }
    });
  });
})();
