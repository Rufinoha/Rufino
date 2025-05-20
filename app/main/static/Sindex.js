// ---------------------------------------------------------------
// -----------------------CONFIGURAÇÔES INICIAIS------------------
// ---------------------------------------------------------------

// ✅ 1. Proteção de Acesso: Verifica se está logado
(function verificarLogin() {
    const usuario = JSON.parse(localStorage.getItem("usuarioLogado") || "{}");

    if (!usuario || !usuario.id_usuario) {
        console.warn("⚠️ Usuário não logado. Redirecionando para o login...");
        window.location.href = "/login.html"; // Ajuste o caminho se necessário
    }
})();

// ✅ 2. Controle de Sessão Dinâmico
(function verificarSessao() {
    if (!App.VarlastLogin) return;
    if (!window.Config || !Config.tempoSessaoMinutos) {
        console.warn("⚠️ Configurações não carregadas. Controle de sessão não aplicado.");
        return;
    }

    const horaLogin = new Date(App.VarlastLogin);
    const agora = new Date();
    const diferencaMinutos = (agora - horaLogin) / (1000 * 60);

    const tempoMaximoSessao = parseInt(Config.tempoSessaoMinutos) || 60; // Busca do Config
    console.log(`⏳ Tempo máximo de sessão configurado: ${tempoMaximoSessao} minutos`);

    if (diferencaMinutos > tempoMaximoSessao) {
        Swal.fire({
            title: 'Sessão expirada!',
            text: 'Por favor, faça login novamente.',
            icon: 'warning',
            confirmButtonText: 'OK'
        }).then(() => {
            localStorage.removeItem("usuarioLogado");
            window.location.href = "/login.html";
        });
    }
})();

// ✅ 3. Função de Logout
document.addEventListener("DOMContentLoaded", function () {
    const btnLogout = document.querySelector("#btnLogout");

    if (btnLogout) {
        btnLogout.addEventListener("click", function () {
            Swal.fire({
                title: "Deseja sair?",
                text: "Sua sessão será finalizada.",
                icon: "question",
                showCancelButton: true,
                confirmButtonText: "Sim, sair",
                cancelButtonText: "Cancelar"
            }).then((result) => {
                if (result.isConfirmed) {
                    localStorage.removeItem("usuarioLogado");
                    window.location.href = "/login.html"; // Volta para a tela de login
                }
            });
        });
    }
});


// ---------------------------------------------------------------
// -----------------------MENU HORIZONTAL-------------------------
// ---------------------------------------------------------------

// ✅ CONTROLE DO MENU HORIZONTAL
document.addEventListener('DOMContentLoaded', () => {
  const btnPerfil = document.getElementById('btnPerfil');
  const menuDropdown = document.getElementById('menuDropdown');
  const iconeSeta = document.getElementById('iconeSeta');

  btnPerfil.addEventListener('click', () => {
    menuDropdown.style.display = (menuDropdown.style.display === 'block') ? 'none' : 'block';
    iconeSeta.style.transform = (menuDropdown.style.display === 'block') ? 'rotate(180deg)' : 'rotate(0deg)';
  });

  document.addEventListener('click', (e) => {
    if (!btnPerfil.contains(e.target) && !menuDropdown.contains(e.target)) {
      menuDropdown.style.display = 'none';
      iconeSeta.style.transform = 'rotate(0deg)';
    }
  });
});
  
// Função exemplo para Logout
function logout() {
  localStorage.removeItem("usuarioLogado");
  localStorage.removeItem("menuFixado"); // ✅ Remove também o estado do menu
  window.location.href = "/login.html";
}

  


// ---------------------------------------------------------------
// -----------------------MENU VERTICAL---------------------------
// ---------------------------------------------------------------

// ✅ CONTROLE DO MENU LATERAL
document.addEventListener('DOMContentLoaded', () => {
  const menuLateral = document.getElementById('menu-lateral');
  const conteudoPrincipal = document.getElementById('conteudo-principal');
  const btnFixarMenu = document.getElementById('btnFixarMenu');
  const iconeFixar = document.getElementById('iconeFixar');
  const menuItems = document.querySelectorAll('.menu-item');

  let menuFixado = localStorage.getItem('menuFixado') === 'true';

  function atualizarIconeFixar() {
    if (menuFixado) {
      iconeFixar.src = window.Paths.pinFincado;
    } else {
      iconeFixar.src = window.Paths.pinSolto;
    }
  }

  // Controle do PIN
  btnFixarMenu.addEventListener('click', () => {
    menuFixado = !menuFixado;

    if (menuFixado) {
      menuLateral.classList.add('expandido');
      conteudoPrincipal.classList.add('expandido');
    } else {
      menuLateral.classList.remove('expandido');
      conteudoPrincipal.classList.remove('expandido');
    }

    localStorage.setItem('menuFixado', menuFixado);
    atualizarIconeFixar();
  });

  // Estado inicial do menu
  if (menuFixado) {
    menuLateral.classList.add('expandido');
    conteudoPrincipal.classList.add('expandido');
  } else {
    menuLateral.classList.remove('expandido');
    conteudoPrincipal.classList.remove('expandido');
  }
  atualizarIconeFixar();

  // Controle dos menus
  menuItems.forEach(item => {
    const titulo = item.querySelector('.menu-titulo');
    const icone = titulo.querySelector('.icone');
    const texto = titulo.querySelector('span');

    titulo.addEventListener('click', (e) => {
      // Se clicou no ícone
      if (e.target === icone) {
        if (!menuFixado) {
          menuLateral.classList.toggle('expandido'); // ✅ Toggle do menu lateral
        }
      }
      // Se clicou no texto
      if (e.target === texto) {
        // Não muda o menu lateral
        // Apenas abre/fecha o submenu
        
        // Fecha outros submenus
        menuItems.forEach(i => {
          if (i !== item) i.classList.remove('ativo');
        });

        // Abre/fecha o submenu clicado
        item.classList.toggle('ativo');
      }
    });
  });

  // Clique nos links dos submenus
  document.querySelectorAll('.submenu li a').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const pagina = e.target.getAttribute('data-pagina');
      if (pagina) {
        conteudoPrincipal.innerHTML = `<iframe src="${pagina}" frameborder="0"></iframe>`;
      }
  
      // Remove 'ativo' de todos os links de submenu
      document.querySelectorAll('.submenu li a').forEach(l => l.classList.remove('ativo'));
      // Marca o submenu clicado como ativo
      e.target.classList.add('ativo');
  
      if (!menuFixado) {
        menuLateral.classList.remove('expandido');
        atualizarIconeFixar();
      }
    });
  });
});



