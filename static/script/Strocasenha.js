document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("formTrocarSenha");
  const nova = document.getElementById("novaSenha");
  const confirmar = document.getElementById("confirmarSenha");
  const erro = document.getElementById("mensagemErro");

  form.addEventListener("submit", async () => {
    erro.textContent = "";

    const senha = nova.value.trim();
    const confirmacao = confirmar.value.trim();

    const criterios = [
      { regex: /[A-Z]/, msg: "1 letra maiúscula" },
      { regex: /[a-z]/, msg: "1 letra minúscula" },
      { regex: /[\W_]/, msg: "1 caractere especial" },
      { regex: /.{8,}/, msg: "mínimo 8 caracteres" }
    ];

    const falhas = criterios.filter(c => !c.regex.test(senha)).map(c => c.msg);

    if (senha !== confirmacao) {
      erro.textContent = "As senhas não coincidem.";
      return;
    }

    if (falhas.length > 0) {
      erro.textContent = "A senha deve conter: " + falhas.join(", ");
      return;
    }

    try {
      const resposta = await fetch("/trocar-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nova: senha, confirmar: confirmacao })
      });

      const resultado = await resposta.json();

      if (resultado.sucesso) {
        window.location.href = "/";
      } else {
        erro.textContent = resultado.erro || "Erro ao trocar a senha.";
      }
    } catch (e) {
      console.error("Erro:", e);
      erro.textContent = "Erro de conexão com o servidor.";
    }
  });
});
