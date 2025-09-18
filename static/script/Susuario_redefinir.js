console.log("Susuario_redefinir.js carregado");

document.getElementById("btnAlterarSenha").addEventListener("click", async () => {
  const hidden = document.getElementById("token");
  let token = hidden ? (hidden.value || "").trim() : "";

  // fallback: se não veio hidden, tenta ler da URL ?token=...
  if (!token) {
    const params = new URLSearchParams(window.location.search);
    token = (params.get("token") || "").trim();
  }

  const s1 = document.getElementById("novaSenha").value;
  const s2 = document.getElementById("confirmarSenha").value;

  if (!token) {
    Swal.fire("Link inválido", "Token ausente. Solicite novo em suporte@rufino.tech.", "error");
    return;
  }
  if (!s1 || !s2) {
    Swal.fire("Campos obrigatórios", "Preencha e confirme a nova senha.", "warning");
    return;
  }
  if (s1 !== s2) {
    Swal.fire("Atenção", "As senhas não conferem.", "warning");
    return;
  }

  try {
    const resp = await fetch("/usuario/redefinir", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ token, senha: s1 })
    });
    const j = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      Swal.fire("Erro", j.mensagem || "Não foi possível redefinir a senha.", "error");
      return;
    }

    await Swal.fire("Sucesso", j.mensagem || "Senha redefinida com sucesso.", "success");
    window.location.href = "/login"; // ajuste se o endpoint de login tiver outro path
  } catch (e) {
    console.error("Falha no reset:", e);
    Swal.fire("Erro", "Falha de comunicação com o servidor.", "error");
  }
});
