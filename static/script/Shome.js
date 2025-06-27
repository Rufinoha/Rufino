// Funçãi de carrega email
function abrirEmail() {
  try {
    window.location.href = "mailto:dpo@rufino.tech";
  } catch (e) {
    alert("Não foi possível abrir seu aplicativo de e-mail. Copie: dpo@rufino.tech");
  }
  return false;
}




document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("form-contato");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const nome = form.nome.value.trim();
    const email = form.email.value.trim();
    const assunto = form.assunto.value.trim();
    const mensagem = form.mensagem.value.trim();

    if (!nome || !email || !assunto || !mensagem) {
      alert("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    const urlLogo = "https://rufino.tech/static/imge/logo-rufino.png";
    const urlPrivacidade = "https://rufino.tech/frm_privacidade.html";
    const dataEnvio = new Date().toLocaleString("pt-BR");

    const corpo_html = `
      <!DOCTYPE html>
      <html lang="pt-br">
      <body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f4f4;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td align="center">
        <table width="100%" style="max-width:600px;background:#ffffff;" cellpadding="20" cellspacing="0">
          <tr><td style="text-align:left;">
          <img src="${urlLogo}" alt="Rufino Logo" style="max-width:200px;height:auto;display:block;">
          </td></tr>
          <tr><td style="border-top:1px solid #ddd;"></td></tr>
          <tr><td>
          <p><strong>Nova mensagem de contato recebida pelo site</strong></p>
          <p><strong>Nome:</strong> ${nome}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Assunto:</strong> ${assunto}</p>
          <p><strong>Mensagem:</strong><br>${mensagem.replace(/\n/g, "<br>")}</p>
          </td></tr>
          <tr><td style="background:#f9f9f9;padding:15px;border-radius:4px;font-size:14px;color:#666;">
          <p><strong>Este e‑mail foi enviado automaticamente pelo site rufino.tech.</strong></p>
          <ul style="margin:10px 0 0 15px;padding:0;">
              <li>Verifique sempre se o remetente é notifica@rufino.tech.</li>
              <li>Nunca compartilhe dados sensíveis por e‑mail.</li>
              <li>Em caso de dúvida, entre em contato com nossa equipe de suporte.</li>
          </ul>
          </td></tr>
          <tr><td style="font-size:14px;color:#666;">
          <p>Para mais informações, acesse nossa <a href="${urlPrivacidade}" style="color:#85C300;text-decoration:none;">Política de Privacidade</a>.</p>
          </td></tr>
          <tr><td style="font-size:12px;color:#999;text-align:center;padding-top:20px;">
          Mensagem enviada em ${dataEnvio} · © 2025 Rufino. Todos os direitos reservados.
          </td></tr>
        </table>
        </td></tr>
      </table>
      </body></html>
    `.trim();

    try {
      const resposta = await fetch("/email/smtpbrevo/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinatarios: ["saulo@rufinoconsultoria.com.br"],
          assunto: "Mensagem de contato pelo site",
          corpo_html
        }),
      });

      const resultado = await resposta.json();

     if (resposta.ok) {
        Swal.fire({
          icon: "success",
          title: "Mensagem enviada!",
          text: "Sua mensagem foi enviada com sucesso. Nossa equipe retornará em breve.",
          confirmButtonColor: "#85C300"
        });
        form.reset();
      } else {
        Swal.fire({
          icon: "error",
          title: "Erro ao enviar",
          text: resultado.erro || "Tente novamente mais tarde.",
          confirmButtonColor: "#85C300"
        });
      }

    } catch (erro) {
      console.error("Erro de envio:", erro);
      Swal.fire({
        icon: "error",
        title: "Erro na conexão",
        text: "Erro ao enviar mensagem. Verifique sua conexão.",
        confirmButtonColor: "#85C300"
      });
    }
  });
});
