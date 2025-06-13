console.log("Scadastro.js carregado");

// Validação e envio do formulário
document.getElementById("btnCadastrar").addEventListener("click", async () => {
  const nome_completo = document.getElementById("nome_completo").value.trim();
  const email         = document.getElementById("email").value.trim();
  const cnpj          = document.getElementById("cnpj").value.trim();
  const empresa       = document.getElementById("empresa").value.trim();
  const ie            = document.getElementById("ie").value.trim();
  const cep           = document.getElementById("cep").value.trim();
  const endereco      = document.getElementById("endereco").value.trim();
  const numero        = document.getElementById("numero").value.trim();
  const bairro        = document.getElementById("bairro").value.trim();
  const cidade        = document.getElementById("cidade").value.trim();
  const uf            = document.getElementById("uf").value.trim().toUpperCase();

 // Validação obrigatória
  if (!nome_completo || !email || !cnpj || !empresa || !cep || !endereco || !numero || !bairro || !cidade || !uf) {
    return Swal.fire("Campos obrigatórios", "Preencha todos os campos obrigatórios.", "warning");
  }

  // ✉️ Validação de e-mail
  const regexEmail = /^[\w\.-]+@[\w\.-]+\.\w{2,}$/;
  if (!regexEmail.test(email)) {
    return Swal.fire("E-mail inválido", "Informe um e-mail válido (ex: nome@empresa.com.br).", "warning")
      .then(() => {
        document.getElementById("email").focus();
      });
  }


  const dados = { nome_completo, email, cnpj, empresa, ie, cep, endereco, numero, bairro, cidade, uf };

  try {
    const resp = await fetch("/cadastro/novo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados)
    });
    const resultado = await resp.json();

    if (resp.ok) {
      return Swal.fire("Sucesso!", resultado.mensagem, "success")
        .then(() => window.close()); 
    } 

    // Caso de erro
    return Swal.fire("Erro", resultado.mensagem || "Erro no cadastro.", "error")
      .then(() => {
        if (resultado.mensagem && resultado.mensagem.includes("e‑mail já está cadastrado")) {
          window.close();
        }
      });

  } catch (erro) {
    console.error("❌ Erro ao cadastrar:", erro);
    return Swal.fire("Erro", "Falha na comunicação com o servidor.", "error");
  }
});



  
  
  
  
  
  
  
  
  
  
  
  
  //===================================================================
  // Evento botões buscar CNPJ
  //===================================================================
  const btnBuscar = document.getElementById("btnBuscarCNPJ");

  // 🔍 Buscar dados da Receita Federal
  if (btnBuscar) {
    btnBuscar.addEventListener("click", async () => {
    const cnpj = document.getElementById("cnpj").value.replace(/\D/g, "");

    if (cnpj.length !== 14) {
      Swal.fire("CNPJ inválido", "Informe um CNPJ com 14 dígitos.", "warning");
      return;
    }

    try {
      const response = await fetch("/api/buscacnpj", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cnpj })
      });

      const data = await response.json();

      if (data.erro) {
        Swal.fire("Empresa não encontrada", "Não conseguimos localizar este CNPJ. Por favor, preencha os dados manualmente.", "info");
        return;
      }

      document.getElementById("empresa").value = data.empresa || "";
      document.getElementById("endereco").value = data.endereco || "";
      document.getElementById("numero").value = data.numero || "";
      document.getElementById("bairro").value = data.bairro || "";
      document.getElementById("cidade").value = data.cidade || "";
      document.getElementById("uf").value = data.uf || "";
      document.getElementById("cep").value = data.cep || "";
      document.getElementById("ie").value = data.ie || "";

      Swal.fire("Empresa localizada!", "Dados preenchidos automaticamente com sucesso.", "success");

    } catch (error) {
      console.error("Erro ao buscar CNPJ:", error);
      Swal.fire("Erro", "Erro inesperado ao consultar o CNPJ. Tente novamente.", "error");
    }
  });

  }

  //===================================================================
  // Evento botões buscar CEP
  //===================================================================
  const btnBuscarCEP = document.getElementById("btnBuscarCEP");

if (btnBuscarCEP) {
  btnBuscarCEP.addEventListener("click", async () => {
    const cep = document.getElementById("cep").value.replace(/\D/g, "");

    if (cep.length !== 8) {
      Swal.fire("CEP inválido", "Informe um CEP com 8 dígitos.", "warning");
      return;
    }

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();

      if (data.erro) {
        Swal.fire("CEP não encontrado", "Preencha os dados manualmente.", "info");
        return;
      }

      document.getElementById("endereco").value = data.logradouro || "";
      document.getElementById("bairro").value = data.bairro || "";
      document.getElementById("cidade").value = data.localidade || "";
      document.getElementById("uf").value = data.uf || "";

      Swal.fire("Endereço localizado!", "Campos preenchidos com sucesso.", "success");

    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
      Swal.fire("Erro", "Erro ao consultar o CEP. Tente novamente.", "error");
    }
  });
}


// ===============================================================
// Validação de e-mail ao sair do campo (evento blur)
// ===============================================================
document.getElementById("email").addEventListener("blur", () => {
  const email = document.getElementById("email").value.trim();

  const regexEmail = /^[\w\.-]+@[\w\.-]+\.\w{2,}$/;

  if (email && !regexEmail.test(email)) {
    Swal.fire({
      icon: "warning",
      title: "E-mail inválido",
      text: "Informe um e-mail válido (ex: nome@empresa.com.br).",
    }).then(() => {
      document.getElementById("email").focus();
    });
  }
});
 