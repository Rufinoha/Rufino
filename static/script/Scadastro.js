console.log("Scadastro.js carregado");

// Validação e envio do formulário
document.getElementById("btnCadastrar").addEventListener("click", async () => {
  const nome_completo = document.getElementById("nome_completo").value.trim();
  const nome = document.getElementById("nome").value.trim();
  const email         = document.getElementById("email").value.trim();
  const cnpj          = document.getElementById("cnpj").value.trim();
  const empresa       = document.getElementById("empresa").value.trim();
  const ie            = " ";
  const cep           = document.getElementById("cep").value.trim();
  const endereco      = document.getElementById("endereco").value.trim();
  const numero        = document.getElementById("numero").value.trim();
  const bairro        = document.getElementById("bairro").value.trim();
  const cidade        = document.getElementById("cidade").value.trim();
  const uf            = document.getElementById("uf").value.trim().toUpperCase();

 // Validação obrigatória
  if (
    !nome_completo || !email || !cnpj || !empresa || !cep ||
    !endereco || !numero || !bairro || !cidade || !uf
  ) {
    return Swal.fire({
      title: "Campos obrigatórios",
      text: "Preencha todos os campos obrigatórios.",
      icon: "warning",
      confirmButtonText: "OK",
      customClass: {
        confirmButton: 'swal-confirm'
      },
      buttonsStyling: false
    });
  }


  // Validação de e-mail
  const regexEmail = /^[\w\.-]+@[\w\.-]+\.\w{2,}$/;
  if (!regexEmail.test(email)) {
    return Swal.fire("E-mail inválido", "Informe um e-mail válido (ex: nome@empresa.com.br).", "warning")
      .then(() => {
        document.getElementById("email").focus();
      });
  }


  const dados = {
    nome_completo, nome, email, cnpj, empresa, ie, cep,
    endereco, numero, bairro, cidade, uf
  };

  try {
    const resp = await fetch("/cadastro/novo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados)
    });
    const resultado = await resp.json();

    if (resp.ok) {
      return Swal.fire({
        title: "Sucesso!",
        text: resultado.mensagem,
        icon: "success",
        confirmButtonText: "OK",
        customClass: {
          confirmButton: 'swal-confirm'
        },
        buttonsStyling: false
      }).then(() => window.close());
    }


    // Caso de erro
    return Swal.fire({
      title: "Erro",
      text: resultado.mensagem || "Erro no cadastro.",
      icon: "error",
      confirmButtonText: "OK",
      customClass: {
        confirmButton: 'swal-confirm'
      },
      buttonsStyling: false
    }).then(() => {
      if (resultado.mensagem && resultado.mensagem.includes("e‑mail já está cadastrado")) {
        window.close();
      }
    });


 } catch (erro) {
  console.error("❌ Erro ao cadastrar:", erro);
  return Swal.fire({
    title: "Erro",
    text: "Falha na comunicação com o servidor.",
    icon: "error",
    confirmButtonText: "OK",
    customClass: {
      confirmButton: 'swal-confirm'
    },
    buttonsStyling: false
  });
}

});
  
  
  //===================================================================
  // Evento botões buscar CNPJ
  //===================================================================
  let animacaoPontinhos;
const btnBuscar = document.getElementById("btnBuscarCNPJ");

if (btnBuscar) {
  btnBuscar.addEventListener("click", async () => {
    const cnpj = document.getElementById("cnpj").value.replace(/\D/g, "");

    if (cnpj.length !== 14) {
      Swal.fire({ title: "CNPJ inválido", text: "Informe um CNPJ com 14 dígitos.", icon: "warning" });
      return;
    }

    // 🔄 Animação "Localizando..."
    let pontos = "";
    btnBuscar.disabled = true;
    btnBuscar.textContent = "Localizando";
    animacaoPontinhos = setInterval(() => {
      pontos = pontos.length < 3 ? pontos + "." : "";
      btnBuscar.textContent = "Localizando" + pontos;
    }, 500);

    try {
      const response = await fetch("/api/buscacnpj", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cnpj })
      });

      const data = await response.json();

      if (data.erro) {
        throw new Error(data.erro);
      }

      document.getElementById("empresa").value = data.razao_social || "";
      document.getElementById("nome").value = data.fantasia || data.razao_social || "";
      document.getElementById("endereco").value = data.endereco || "";
      document.getElementById("numero").value = data.numero || "";
      document.getElementById("bairro").value = data.bairro || "";
      document.getElementById("cidade").value = data.cidade || "";
      document.getElementById("uf").value = data.uf || "";
      document.getElementById("cep").value = data.cep || "";

      Swal.fire({
        title: "Empresa localizada!",
        text: "Dados preenchidos automaticamente com sucesso.",
        icon: "success",
        confirmButtonText: "OK",
        customClass: {
          confirmButton: 'swal-confirm'
        },
        buttonsStyling: false
      });

    } catch (error) {
      console.error("Erro ao buscar CNPJ:", error);
      Swal.fire({ title: "Erro", text: error.message || "Erro ao consultar o CNPJ.", icon: "error" });
    } finally {
      clearInterval(animacaoPontinhos);
      btnBuscar.disabled = false;
      btnBuscar.textContent = "Buscar";
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
      Swal.fire({
        title: "CEP inválido",
        text: "Informe um CEP com 8 dígitos.",
        icon: "warning",
        confirmButtonText: "OK",
        customClass: {
          confirmButton: 'swal-confirm'
        },
        buttonsStyling: false
      });

      return;
    }

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();

      if (data.erro) {
        Swal.fire({
          title: "CEP não encontrado",
          text: "Preencha os dados manualmente.",
          icon: "info",
          confirmButtonText: "OK",
          customClass: {
            confirmButton: 'swal-confirm'
          },
          buttonsStyling: false
        });

        return;
      }

      document.getElementById("endereco").value = data.logradouro || "";
      document.getElementById("bairro").value = data.bairro || "";
      document.getElementById("cidade").value = data.localidade || "";
      document.getElementById("uf").value = data.uf || "";

      Swal.fire({
        title: "Endereço localizado!",
        text: "Campos preenchidos com sucesso.",
        icon: "success",
        confirmButtonText: "OK",
        customClass: {
          confirmButton: 'swal-confirm'
        },
        buttonsStyling: false
      });


    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
      Swal.fire({
        title: "Erro",
        text: "Erro ao consultar o CEP. Tente novamente.",
        icon: "error",
        confirmButtonText: "OK",
        customClass: {
          confirmButton: 'swal-confirm'
        },
        buttonsStyling: false
      });

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
    confirmButtonText: "OK",
    customClass: {
      confirmButton: 'swal-confirm'
    },
    buttonsStyling: false
  }).then(() => {
    document.getElementById("email").focus();
  });
}

});
 