// Mostrar o aviso de cookies se ainda não aceitou
function mostrarAvisoCookies() {
  const aviso = document.getElementById("aviso-cookies");
  if (!aviso) return;

  const aceitou = localStorage.getItem("cookie_aceito");
  if (aceitou !== "sim") {
    aviso.style.display = "block";
  }
}

// Ao clicar em "Aceitar"
function aceitarCookies() {
  localStorage.setItem("cookie_aceito", "sim");
  const aviso = document.getElementById("aviso-cookies");
  if (aviso) aviso.style.display = "none";
}

// Roda ao carregar
document.addEventListener("DOMContentLoaded", mostrarAvisoCookies);
