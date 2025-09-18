/* =============================== 0) GUARD / INIT =============================== */
if (!window.__LoginHandlersBound) {
  window.__LoginHandlersBound = true;

  document.addEventListener("DOMContentLoaded", () => {

    /* ========================== 1) LOGIN (envio/retorno) ========================== */
    const btnLogin   = document.querySelector("#btnLogin");
    const inputEmail = document.querySelector("#email");
    const inputSenha = document.querySelector("#senha");

    async function postJSON(url, payload, opts = {}) {
      const resp = await fetch(url, {
        method: "POST",
        credentials: opts.credentials ?? "include",
        headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
        body: JSON.stringify(payload || {})
      });
      let data;
      try { data = await resp.json(); } catch { throw new Error(`Resposta inválida de ${url}`); }
      if (!resp.ok) throw new Error(data?.erro || data?.message || `HTTP ${resp.status}`);
      return data;
    }

    async function executarLogin() {
      const email = (inputEmail?.value || "").trim();
      const senha = (inputSenha?.value || "").trim();
      if (!email || !senha) {
        Swal.fire({ icon: "warning", title: "Atenção", text: "Informe e-mail e senha." }); 
        return;
      }

      if (btnLogin) { btnLogin.disabled = true; btnLogin.innerText = "Entrando..."; }

      try {
        const data = await postJSON("/login", { email, senha }); 

        if (data?.trocar_senha) { window.location.href = "/senha/trocar"; return; }

        if (data?.success) {
          // (5) Persistência LocalStorage (usuario & empresa)
          salvarLoginNoLocalStorage(data);
          window.location.href = "/main";
        } else {
          Swal.fire({ icon: "error", title: "Erro ao entrar", text: data?.message || "Login não autorizado." });
        }
      } catch (err) {
        console.error("Erro login:", err);
        Swal.fire({ icon: "error", title: "Erro de conexão", text: String(err.message || err) });
      } finally {
        if (btnLogin) { btnLogin.disabled = false; btnLogin.innerText = "Entrar"; }
      }
    }

    if (btnLogin) btnLogin.addEventListener("click", executarLogin);
    // Enter para submeter
    [inputEmail, inputSenha].forEach(inp => inp && inp.addEventListener("keydown", e => {
      if (e.key === "Enter") executarLogin();
    }));


    /* =================== 2) RECUPERAR SENHA (envio/retorno) =================== */
    const btnEnviarToken = document.querySelector("#btnEnviarToken");
    const inpRecEmail    = document.querySelector("#recEmail");

    async function enviarRecuperacao() {
      const email = (inpRecEmail?.value || "").trim();
      if (!email) {
        Swal.fire({ icon: "warning", title: "Atenção", text: "Informe seu e-mail para recuperar a senha." });
        return;
      }
      try {
        const data = await postJSON("/usuario/recuperar", { email }); // <- ROTA RECUPERAR
        if (data?.sucesso) {
          Swal.fire({ icon: "success", title: "Verifique seu e-mail", text: data?.mensagem || "Enviamos o link de redefinição." });
          setTimeout(() => {
            formRecuperarSenha?.classList.remove("ativa");
            formLogin?.classList.add("ativa");
          }, 3000);
        } else {
          Swal.fire({ icon: "error", title: "Erro", text: data?.erro || "Não foi possível enviar o link de recuperação." });
        }
      } catch (err) {
        console.error("Erro recuperar:", err);
        Swal.fire({ icon: "error", title: "Erro de conexão", text: String(err.message || err) });
      }
    }

    if (btnEnviarToken) btnEnviarToken.addEventListener("click", enviarRecuperacao);


    /* ================== 3) ALTERNAR TELAS (Login ↔ Recuperar) ================== */
    const formLogin           = document.getElementById("formLogin");
    const formRecuperarSenha  = document.getElementById("formRecuperarSenha");
    const linkEsqueciSenha    = document.querySelector("#linkEsqueciSenha");
    const btnVoltarLogin      = document.querySelector("#btnVoltarLogin");

    if (linkEsqueciSenha) linkEsqueciSenha.addEventListener("click", () => {
      formLogin?.classList.remove("ativa");
      formRecuperarSenha?.classList.add("ativa");
    });

    if (btnVoltarLogin) btnVoltarLogin.addEventListener("click", () => {
      formRecuperarSenha?.classList.remove("ativa");
      formLogin?.classList.add("ativa");
    });


    /* ======================= 4) POPUP DE CADASTRO (central) ======================= */
    // 4) Cadastro em modal (padrão FG)
    const linkCadastro = document.getElementById("linkCadastro");
    if (linkCadastro) {
      linkCadastro.addEventListener("click", (e) => {
        e.preventDefault();

        GlobalUtils.abrirJanelaApoioModal({
          rota: "/cadastro/abrir",
          titulo: "Cadastro de Usuário",
          largura: 850,
          altura: 770,
          nivel: 1
        });
      });
    }



    /* ============== 5) LOCALSTORAGE (persistir dados essenciais) ============== */
    function salvarLoginNoLocalStorage(data) {
      try {
        const u = data?.usuario || {};
        // se não vier "empresa", pega do "usuario"
        const e = data?.empresa || {
          id_empresa:    u.id_empresa ?? null,
          nome_amigavel: u.nome_amigavel ?? ""
        };

        const payloadUsuario = {
          id_usuario:              u.id_usuario ?? null,
          nome:                    u.nome ?? "",
          imagem:                  u.imagem ?? "",
          id_ultima_novidade_lida: u.id_ultima_novidade_lida ?? 0
        };

        const payloadEmpresa = {
          id_empresa:    e.id_empresa ?? null,
          nome_amigavel: e.nome_amigavel ?? ""
        };

        localStorage.setItem("usuarioLogado", JSON.stringify(payloadUsuario));
        localStorage.setItem("empresaAtiva",  JSON.stringify(payloadEmpresa));
        localStorage.setItem("horaLogin",     new Date().toISOString());
      } catch (err) {
        console.error("Falha ao salvar no localStorage:", err);
      }
    }


  }); 
} 
