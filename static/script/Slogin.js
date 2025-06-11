// login.js

document.addEventListener("DOMContentLoaded", function () {
    const btnLogin = document.querySelector("#btnLogin");
    const inputEmail = document.querySelector("#email");
    const inputSenha = document.querySelector("#senha");

    btnLogin.addEventListener("click", async function () {
        const email = inputEmail.value.trim();
        const senha = inputSenha.value.trim();

        if (!email || !senha) {
            Swal.fire({
                icon: "warning",
                title: "Atenção",
                text: "Por favor, preencha o e-mail e a senha para continuar."
            });
            return;
        }

        btnLogin.disabled = true; // Desabilita para evitar múltiplos cliques
        btnLogin.innerText = "Entrando...";

        try {
            const response = await fetch("/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, senha })
            });


            const data = await response.json();
            if (data.trocar_senha) {
                window.location.href = "/senha/trocar";
                return;
            }

            if (data.success) {
                // Salva o usuário no localStorage
                localStorage.setItem("usuarioLogado", JSON.stringify(data.usuario));

                // Redireciona para a página principal
                window.location.href = "/main";
            } else {
                Swal.fire({
                    icon: "error",
                    title: "Erro ao entrar",
                    text: data.message || "Não foi possível realizar o login."
                });
            }

        } catch (error) {
            console.error("Erro na requisição de login:", error);
            Swal.fire({
                icon: "error",
                title: "Erro de conexão",
                text: "Não foi possível se conectar ao servidor."
            });
        } finally {
            btnLogin.disabled = false;
            btnLogin.innerText = "Entrar";
        }
    });
});


document.querySelector("#linkEsqueciSenha").addEventListener("click", () => {
  document.getElementById("formLogin").classList.remove("ativa");
  document.getElementById("formRecuperarSenha").classList.add("ativa");
});

document.querySelector("#btnVoltarLogin").addEventListener("click", () => {
  document.getElementById("formRecuperarSenha").classList.remove("ativa");
  document.getElementById("formLogin").classList.add("ativa");
});


document.querySelector("#btnEnviarToken").addEventListener("click", async () => {
  const email = document.querySelector("#recEmail").value.trim();

  if (!email) {
    Swal.fire({
      icon: "warning",
      title: "Atenção",
      text: "Por favor, informe seu e-mail para recuperar sua senha."
    });
    return;
  }

  try {
    const response = await fetch("/usuario/recuperar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email })
    });

    const data = await response.json();

    if (data.sucesso) {
      Swal.fire({
        icon: "success",
        title: "Verifique seu e-mail",
        text: data.mensagem || "Enviamos um link para você redefinir sua senha."
      });

      // Voltar para tela de login automaticamente após alguns segundos
      setTimeout(() => {
        document.getElementById("formRecuperarSenha").classList.remove("ativa");
        document.getElementById("formLogin").classList.add("ativa");
      }, 3000);
    } else {
      Swal.fire({
        icon: "error",
        title: "Erro",
        text: data.erro || "Não foi possível enviar o link de recuperação."
      });
    }

  } catch (erro) {
    console.error("Erro ao enviar solicitação:", erro);
    Swal.fire({
      icon: "error",
      title: "Erro de conexão",
      text: "Não foi possível conectar com o servidor."
    });
  }
});


document.getElementById("linkCadastro").addEventListener("click", function (e) {
  e.preventDefault();

  const largura = 850;
  const altura = 750;

  // Calcula a posição central baseada na tela do usuário
  const esquerda = window.screenX + (window.outerWidth - largura) / 2;
  const topo = window.screenY + (window.outerHeight - altura) / 2;

  // Abre nova janela popup com a URL do formulário de cadastro
  window.open(
    "/cadastro/abrir", // ou "/cadastro" se tiver rota associada
    "CadastroUsuario",
    `width=${largura},height=${altura},left=${esquerda},top=${topo},resizable=yes`
  );
});

