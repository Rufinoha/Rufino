// ✅ Susuario_modulo_apoio.js carregado
console.log("✅ Susuario_modulo_apoio.js carregado");

let grupoId = null;

GlobalUtils.receberDadosApoio(async function (id, nivel) {
  window.__nivelModal__ = nivel;
  grupoId = id;
  document.getElementById("id_usuario_grupo").value = grupoId;

  if (grupoId) {
    console.log("🔁 Carregando permissões para o grupo:", grupoId);
    await carregarPermissoes();
  }
});

window.addEventListener("DOMContentLoaded", () => {
  window.opener?.postMessage({ grupo: "apoioPronto" }, "*");

  document.getElementById("ob_btnSalvar").addEventListener("click", salvarPermissoes);
});

async function carregarPermissoes() {
  const listaDiv = document.getElementById("listaPermissoes");
  listaDiv.innerHTML = "<p>Carregando permissões...</p>";

  try {
    const resp = await fetch(`/usuario/grupo/apoio2/${grupoId}`);
    const { menus, permissoes } = await resp.json();

    listaDiv.innerHTML = "";

    menus.forEach(principal => {
      const moduloDiv = document.createElement("div");
      moduloDiv.classList.add("modulo-container");

      const checkedPrincipal = permissoes.includes(principal.id_menu);
      const idPrincipal = `principal-${principal.id_menu}`;

      const titulo = document.createElement("label");
      titulo.innerHTML = `
        <input type="checkbox" id="${idPrincipal}" class="chk-menu-principal" value="${principal.id_menu}" ${checkedPrincipal ? "checked" : ""}>
        <strong>${principal.nome_menu}</strong>
      `;
      moduloDiv.appendChild(titulo);

      principal.submenus.forEach(sub => {
        const checkedSub = permissoes.includes(sub.id_menu);
        const label = document.createElement("label");
        label.classList.add("submodulo-item");
        label.style.display = 'block';
        label.style.marginLeft = '20px';
        label.innerHTML = `
          <input type="checkbox" class="chk-submenu" data-principal="${idPrincipal}" value="${sub.id_menu}" ${checkedSub ? "checked" : ""}>
          ${sub.nome_menu}
        `;
        moduloDiv.appendChild(label);
      });

      listaDiv.appendChild(moduloDiv);
    });

    // ✅ Check principal controla submenus
    listaDiv.addEventListener("change", function (e) {
      if (e.target.classList.contains("chk-menu-principal")) {
        const principalId = e.target.id;
        const submenus = listaDiv.querySelectorAll(`.chk-submenu[data-principal="${principalId}"]`);
        submenus.forEach(sub => sub.checked = e.target.checked);
      }

      if (e.target.classList.contains("chk-submenu")) {
        const principalId = e.target.dataset.principal;
        const principal = document.getElementById(principalId);
        const submenus = listaDiv.querySelectorAll(`.chk-submenu[data-principal="${principalId}"]`);
        const anyChecked = Array.from(submenus).some(sub => sub.checked);
        principal.checked = anyChecked;
      }
    });

  } catch (e) {
    console.error("❌ Erro ao carregar permissões:", e);
    listaDiv.innerHTML = "<p>Erro ao carregar permissões.</p>";
  }
}




async function salvarPermissoes() {
  const listaDiv = document.getElementById("listaPermissoes");
  const checkboxes = listaDiv.querySelectorAll("input[type=checkbox]:checked");

  const selecionados = Array.from(checkboxes).map(cb => ({
    id_usuario_grupo: grupoId,
    id_menu: parseInt(cb.value)
  }));

  try {
    const resp = await fetch(`/usuario_modulo/salvar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(selecionados)
    });
    const json = await resp.json();

    if (resp.ok) {
      Swal.fire("Sucesso", json.mensagem, "success");
    } else {
      Swal.fire("Erro", json.erro || "Erro ao salvar permissões.", "error");
    }
  } catch (e) {
    Swal.fire("Erro", "Erro inesperado ao salvar.", "error");
  }
}