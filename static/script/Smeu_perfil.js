console.log("🔧 Meu_Perfil.js carregado...");
// -------------------------------------------------------------
// 🔄 TROCA DE ABAS
// -------------------------------------------------------------
document.querySelectorAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    });
});


// -------------------------------------------------------------
// ALTERAR / EXCLUIR IMAGEM DE PERFIL
// -------------------------------------------------------------
(function () {
  const inputFoto = document.getElementById('inputFoto');
  const fotoUsuario = document.getElementById('fotoUsuario');
  const btnExcluirFoto = document.getElementById('btnExcluirFoto');

  // Visualização instantânea da imagem selecionada
  inputFoto.addEventListener('change', () => {
    const file = inputFoto.files[0];
    if (!file) return;

    const extensao = file.name.split('.').pop().toLowerCase();
    if (!['jpg', 'png'].includes(extensao)) {
      alert('Apenas arquivos JPG ou PNG são permitidos.');
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      fotoUsuario.src = e.target.result;
    };
    reader.readAsDataURL(file);

    // Enviar imagem para o backend
    const formData = new FormData();
    formData.append('imagem', file);

    fetch('/perfil/upload_imagem', {
      method: 'POST',
      body: formData,
    })
    .then(resp => resp.json())
    .then(data => {
      if (data.imagem) {
        console.log('✅ Imagem salva com sucesso:', data.imagem);
        Swal.fire("Sucesso", "Imagem de perfil atualizada com sucesso!", "success");
      } else {
        Swal.fire("Erro", data.erro || "Não foi possível salvar a imagem.", "error");
      }
    })
    .catch(err => {
      console.error("❌ Erro no envio da imagem:", err);
      Swal.fire("Erro", "Falha ao enviar a imagem", "error");
    });
  });

  // 🔁 Botão excluir imagem
  btnExcluirFoto.addEventListener('click', () => {
    fetch('/perfil/excluir_imagem', {
      method: 'POST',
    })
    .then(resp => resp.json())
    .then(data => {
      if (data.imagem) {
        fotoUsuario.src = `/static/imge/imguser/${data.imagem}`;
        Swal.fire("Sucesso", "Imagem de perfil removida.", "success");
      } else {
        Swal.fire("Erro", data.erro || "Falha ao excluir a imagem.", "error");
      }
    })
    .catch(err => {
      console.error("❌ Erro ao excluir imagem:", err);
      Swal.fire("Erro", "Erro ao excluir imagem.", "error");
    });
  });
})();



// -------------------------------------------------------------
// 🔐 TROCAR SENHA – Abrir card + Validação
// -------------------------------------------------------------
function toggleCardSenha() {
    const cardBody = document.querySelector('#cardSenha .card-body');
    cardBody.style.display = cardBody.style.display === 'none' ? 'block' : 'none';
}

document.getElementById('btnAlterarSenha').addEventListener('click', async () => {
  const nova = document.getElementById('novaSenha').value.trim();
  const repetir = document.getElementById('confirmarSenha').value.trim();

  if (nova.length < 8 || !/[A-Z]/.test(nova) || !/[a-z]/.test(nova) || !/[!@#$%^&*(),.?":{}|<>]/.test(nova)) {
    alert("A senha deve conter ao menos 8 caracteres, uma letra maiúscula, uma minúscula e um caractere especial.");
    return;
  }

  if (nova !== repetir) {
    alert("As senhas não coincidem.");
    return;
  }

  try {
    const resp = await fetch("/perfil/trocar_senha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nova, repetir })
    });

    const retorno = await resp.json();
    if (retorno.mensagem) {
      Swal.fire("Sucesso", retorno.mensagem, "success");
      document.getElementById("novaSenha").value = '';
      document.getElementById("confirmarSenha").value = '';
      toggleCardSenha();
    } else {
      Swal.fire("Erro", retorno.erro || "Erro ao trocar senha.", "error");
    }
  } catch (e) {
    console.error("❌ Erro ao enviar nova senha:", e);
    Swal.fire("Erro", "Falha ao alterar senha", "error");
  }
});


// -------------------------------------------------------------
// 🧪 MOCK: Carregar dados do usuário e empresa (exemplo estático)
// -------------------------------------------------------------
(function () {
  async function carregarPerfil() {
    try {
      const resp = await fetch("/perfil/dados");
      const dados = await resp.json();

      if (dados.erro) {
        Swal.fire("Erro", dados.erro, "error");
        return;
      }

      // 🔹 Preenche Empresa
      const empresaInfo = dados.empresa;
        document.getElementById("nome_empresa").value = empresaInfo.empresa;
        document.getElementById("cnpj").value = empresaInfo.cnpj;
        document.getElementById("endereco").value = empresaInfo.endereco;
        document.getElementById("numero").value = empresaInfo.numero;
        document.getElementById("bairro").value = empresaInfo.bairro;
        document.getElementById("cidade").value = empresaInfo.cidade;
        document.getElementById("uf").value = empresaInfo.uf;
        document.getElementById("cep").value = empresaInfo.cep;
        document.getElementById("ie").value = empresaInfo.ie;
        document.getElementById("contato_financeiro").value = empresaInfo.contato_financeiro || "";
        document.getElementById("email_financeiro").value = empresaInfo.email_financeiro || "";
        document.getElementById("whatsapp_financeiro").value = empresaInfo.whatsapp_financeiro || "";
        document.getElementById("forma_pagamento_padrao").value = empresaInfo.forma_pagamento_padrao || "pix";
        document.getElementById("obs_faturamento").value = empresaInfo.obs_faturamento || "";

      // 🔹 Preenche Meu Perfil
      document.getElementById("nome").value = dados.usuario.nome_completo;
      document.getElementById("email").value = dados.usuario.email;
      document.getElementById("departamento").value = dados.usuario.departamento;
      document.getElementById("whatsapp").value = dados.usuario.whatsapp;
      document.getElementById("fotoUsuario").src = `/static/imge/imguser/${dados.usuario.imagem}`;
    } catch (e) {
      console.error("❌ Erro ao carregar perfil:", e);
      Swal.fire("Erro", "Falha ao carregar os dados do perfil.", "error");
    }
  }

  // 🔹 Alterna entre abas
  function configurarAbas() {
    const botoes = document.querySelectorAll(".tab-button");
    const abas = document.querySelectorAll(".tab-content");

    botoes.forEach(botao => {
      botao.addEventListener("click", () => {
        botoes.forEach(b => b.classList.remove("active"));
        abas.forEach(a => a.classList.remove("active"));

        botao.classList.add("active");
        document.getElementById(botao.dataset.tab).classList.add("active");
      });
    });
  }

  // 🔐 Expande ou recolhe card de senha
  window.toggleCardSenha = function () {
    const corpo = document.querySelector("#cardSenha .card-body");
    corpo.style.display = corpo.style.display === "none" ? "block" : "none";
  };

  // Iniciar tudo
  carregarPerfil();
  configurarAbas();
})();



// -------------------------------------------------------------
// 📸 MASCARA DE WHATSAPP e criação de link
// -------------------------------------------------------------
function aplicarMascaraWhatsapp(campoId) {
  const campo = document.getElementById(campoId);
  if (!campo) return;

  campo.addEventListener("input", function () {
    let valor = this.value.replace(/\D/g, "");
    if (valor.length > 11) valor = valor.slice(0, 11);

    if (valor.length <= 10) {
      this.value = valor.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
    } else {
      this.value = valor.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
    }
  });
}

// Aplicar nos dois campos
aplicarMascaraWhatsapp("whatsapp");
aplicarMascaraWhatsapp("whatsapp_financeiro");




document.getElementById("btnZap").addEventListener("click", function () {
  const campo = document.getElementById("whatsapp").value;
  const numero = campo.replace(/\D/g, "");
  if (numero.length < 11) {
    alert("Número de WhatsApp inválido!");
    return;
  }
  const link = `https://wa.me/55${numero}`;
  window.open(link, "_blank");
});



// -------------------------------------------------------------
// 📸 SALVAR DADOS DO MEU PERFIL E EMPRESA
// -------------------------------------------------------------
document.getElementById("btnsalvar").addEventListener("click", async () => {
  const empresa = {
    endereco: document.getElementById('endereco').value,
    numero: document.getElementById('numero').value,
    bairro: document.getElementById('bairro').value,
    cidade: document.getElementById('cidade').value,
    uf: document.getElementById('uf').value,
    cep: document.getElementById('cep').value,
    ie: document.getElementById('ie').value,
    contato_financeiro: document.getElementById('contato_financeiro').value,
    email_financeiro: document.getElementById('email_financeiro').value,
    whatsapp_financeiro: document.getElementById('whatsapp_financeiro').value,
    forma_pagamento_padrao: document.getElementById('forma_pagamento_padrao').value,
    obs_faturamento: document.getElementById('obs_faturamento').value
  };

  const usuario = {
    departamento: document.getElementById('departamento').value,
    whatsapp: document.getElementById('whatsapp').value
  };

  try {
    const resposta = await fetch("/perfil/salvar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empresa, usuario })
    });

    const retorno = await resposta.json();

    if (retorno.sucesso) {
      Swal.fire("✅ Sucesso", "Dados atualizados com sucesso!", "success");
    } else {
      Swal.fire("❌ Erro", retorno.erro || "Erro ao salvar dados.", "error");
    }
  } catch (e) {
    console.error("❌ Erro ao salvar:", e);
    Swal.fire("Erro", "Falha ao enviar os dados ao servidor.", "error");
  }
});
