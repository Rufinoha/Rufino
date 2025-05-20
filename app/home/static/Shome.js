// 🧠 Frases da IA
const frasesIA = {
    inicial: "Olá! Eu sou a IA da Rufino. Posso te ajudar a montar sua experiência.\nArraste os cards abaixo para a Mesa de Projeto.",
    vazio: "Não tenha pressa. Estarei aqui o tempo que precisar pra pensar bem no seu projeto.",
    logistica: "Opa! Tenho inúmeras ideias sobre logística. Sabia que meu mentor tem mais de 25 anos na área?",
    financeiro: "Controle e estratégia são minhas especialidades. Quer dicas para organizar seu financeiro?",
    combinacao: "Vejo que você está construindo algo robusto... posso ajudar a interligar essas áreas!",
  };
  
  let intervaloDigitacao = null;
  
  function digitarTexto(texto, destinoId = "mensagemIA", velocidade = 25) {
    const el = document.getElementById(destinoId);
    clearInterval(intervaloDigitacao);
    el.innerHTML = "";
  
    let i = 0;
    intervaloDigitacao = setInterval(() => {
      if (i < texto.length) {
        el.innerHTML += texto.charAt(i);
        i++;
      } else {
        clearInterval(intervaloDigitacao);
      }
    }, velocidade);
  }
  
  function atualizarMensagemIA() {
    const mesa = document.getElementById("mesaProjeto");
  
    // Aguarda um pequeno tempo para garantir que o DOM foi atualizado
    setTimeout(() => {
      const conteudo = mesa.innerText.toLowerCase().trim();
  
      const temLogistica = conteudo.includes("logistica");
      const temFinanceiro = conteudo.includes("financeiro");
  
      if (!conteudo) {
        digitarTexto(frasesIA.vazio);
      } else if (temLogistica && temFinanceiro) {
        digitarTexto(frasesIA.combinacao);
      } else if (temLogistica) {
        digitarTexto(frasesIA.logistica);
      } else if (temFinanceiro) {
        digitarTexto(frasesIA.financeiro);
      } else {
        digitarTexto(frasesIA.vazio);
      }
    }, 100); // atraso leve pra garantir leitura certa da DOM
  }
  
  function refazerExperiencia() {
    localStorage.removeItem("mesaProjeto");
    location.reload();
  }
  
  window.addEventListener("DOMContentLoaded", () => {
    const mesa = document.getElementById("mesaProjeto");
    const salvo = localStorage.getItem("mesaProjeto");
    if (salvo) {
      mesa.innerHTML = salvo;
    }
  
    digitarTexto(frasesIA.inicial);
  
    new Sortable(document.getElementById("cardsDisponiveis"), {
      group: "mesa",
      animation: 150
    });
  
    new Sortable(mesa, {
      group: "mesa",
      animation: 150,
      onEnd: () => {
        localStorage.setItem("mesaProjeto", mesa.innerHTML);
        atualizarMensagemIA();
      }
    });
  });
  

  document.querySelectorAll(".card-sistema").forEach(card => {
    card.addEventListener("click", () => {
      const destino = card.getAttribute("data-link");
      if (destino) window.location.href = destino;
    });
  });


  window.addEventListener("scroll", () => {
    const header = document.querySelector(".header-fixo");

    if (window.scrollY > 10) {
      header.style.backgroundColor = "#FFFFFF";
      header.style.borderbottom = "1px solid #ccc";
    } else {
      header.style.backgroundColor = "transparent";
      header.style.borderbottom = "nome";
    }
  });
  