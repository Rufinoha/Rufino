console.log("🟢 Susuario_redefinir.js carregado");

const params = new URLSearchParams(window.location.search);
const token = params.get("token");

document.getElementById("btnAlterarSenha").addEventListener("click", async () => {
  const btn = document.getElementById("btnAlterarSenha");

  // Previne múltiplos cliques
  if (btn.disabled) return;
  btn.disabled = true;
  btn.textContent = "Enviando...";

  const nova = document.getElementById("novaSenha").value.trim();
  const repetir = document.getElementById("confirmarSenha").value.trim();

  if (nova.length < 8 || !/[A-Z]/.test(nova) || !/[a-z]/.test(nova) || !/[!@#$%^&*(),.?":{}|<>]/.test(nova)) {
    btn.disabled = false;
    btn.textContent = "Salvar Senha";
    return Swal.fire("Atenção", "A senha deve conter no mínimo 8 caracteres, incluindo uma letra maiúscula, uma minúscula e um caractere especial.", "warning");
  }

  if (nova !== repetir) {
    btn.disabled = false;
    btn.textContent = "Salvar Senha";
    return Swal.fire("Erro", "As senhas não coincidem.", "error");
  }

  try {
    const resp = await fetch("/usuario/redefinir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, senha: nova })
    });
    const resultado = await resp.json();

    if (resp.ok) {
      Swal.fire("Sucesso!", resultado.mensagem, "success").then(() => {
        window.location.href = "/auth/login";
      });
    } else {
      btn.disabled = false;
      btn.textContent = "Salvar Senha";
      Swal.fire("Erro", resultado.mensagem || "Erro ao redefinir senha.", "error");
    }
  } catch (erro) {
    btn.disabled = false;
    btn.textContent = "Salvar Senha";
    console.error("Erro:", erro);
    Swal.fire("Erro", "Erro ao comunicar com o servidor.", "error");
  }
});
