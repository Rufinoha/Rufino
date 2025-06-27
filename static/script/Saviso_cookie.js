function mostrarAvisoCookies() {
  const aviso = document.getElementById("aviso-cookies");
  if (!localStorage.getItem("cookie_aceito")) {
    aviso.style.display = "block";
  }
}

function aceitarCookies() {
  localStorage.setItem("cookie_aceito", "true");
  document.getElementById("aviso-cookies").style.display = "none";
}

document.addEventListener("DOMContentLoaded", mostrarAvisoCookies);
