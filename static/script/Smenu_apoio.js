console.log("📘 Smenu_apoio.js carregado");

window.addEventListener("DOMContentLoaded", () => {
  console.log("📘 DOM pronto, enviando apoioPronto...");
  window.opener?.postMessage({ grupo: "apoioPronto" }, "*");

  // Botão Salvar
  document.getElementById("ob_btnSalvar").addEventListener("click", async () => {
    const dados = {
      id: document.getElementById("id").value || null,
      nome_menu: document.getElementById("nome_menu").value.trim(),
      descricao: document.getElementById("descricao").value.trim(),
      rota: document.getElementById("rota").value.trim(),
      data_page: document.getElementById("data_page").value.trim(),
      icone: document.getElementById("icone").value.trim(),
      link_detalhe: document.getElementById("link_detalhe").value.trim(),
      tipo_abrir: document.getElementById("tipo_abrir").value.trim(),
      ordem: parseInt(document.getElementById("ordem").value) || 0,
      parent_id: parseInt(document.getElementById("parent_id").value) || null,
      ativo: document.getElementById("ativo").value === "true",
      local_menu: document.getElementById("local_menu").value.trim(),
      valor: parseFloat(document.getElementById("valor").value) || 0,
      obs: document.getElementById("obs").value.trim(),
      assinatura_app: document.getElementById("assinatura_app").value === "true"
    };

    if (!dados.nome_menu) {
      Swal.fire("Atenção", "Preencha o campo Nome do Menu.", "warning");
      return;
    }

    try {
      const resposta = await fetch("/menu/salvar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados)
      });

      const resultado = await resposta.json();
      if (resposta.ok && resultado.status === "sucesso") {
        Swal.fire("Sucesso", resultado.mensagem, "success").then(() => {
          window.opener?.Menu?.carregarMenus?.();
          window.close();
        });
      } else {
        Swal.fire("Erro", resultado.erro || "Erro ao salvar menu.", "error");
      }
    } catch (erro) {
      console.error("❌ Erro ao salvar:", erro);
      Swal.fire("Erro", "Erro inesperado ao salvar.", "error");
    }
  });

  // Botão Excluir
  document.getElementById("ob_btnexcluir").addEventListener("click", async () => {
    const id = document.getElementById("id").value;
    if (!id) {
      Swal.fire("Erro", "Menu ainda não foi salvo.", "warning");
      return;
    }

    const confirma = await Swal.fire({
      title: `Excluir menu ${id}?`,
      text: "Esta ação não poderá ser desfeita.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sim, excluir",
      cancelButtonText: "Cancelar"
    });

    if (!confirma.isConfirmed) return;

    try {
      const resp = await fetch("/menu/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id })
      });

      const dados = await resp.json();
      if (resp.ok && dados.status === "sucesso") {
        Swal.fire("Sucesso", dados.mensagem, "success").then(() => {
          window.opener?.Menu?.carregarMenus?.();
          window.close();
        });
      } else {
        Swal.fire("Erro", dados.erro || "Erro ao excluir menu.", "error");
      }
    } catch (erro) {
      console.error("❌ Erro ao excluir:", erro);
      Swal.fire("Erro inesperado", "Falha ao excluir menu.", "error");
    }
  });
});

// Carregar dados ao editar
window.addEventListener("message", async (event) => {
  if (event.data && event.data.grupo === "carregarMenu") {
    const id = event.data.id;
    try {
      const resposta = await fetch(`/menu/apoio/${id}`);
      const menu = await resposta.json();

      if (!resposta.ok || menu.erro) {
        throw new Error(menu.erro || "Erro ao buscar dados.");
      }

      document.getElementById("id").value = menu.id || "";
      document.getElementById("nome_menu").value = menu.nome_menu || "";
      document.getElementById("descricao").value = menu.descricao || "";
      document.getElementById("rota").value = menu.rota || "";
      document.getElementById("data_page").value = menu.data_page || "";
      document.getElementById("icone").value = menu.icone || "";
      document.getElementById("link_detalhe").value = menu.link_detalhe || "";
      document.getElementById("tipo_abrir").value = menu.tipo_abrir || "";
      document.getElementById("ordem").value = menu.ordem || 0;
      document.getElementById("parent_id").value = menu.parent_id || "";
      document.getElementById("ativo").value = String(menu.ativo);
      document.getElementById("local_menu").value = menu.local_menu || "";
      document.getElementById("valor").value = menu.valor || 0;
      document.getElementById("obs").value = menu.obs || "";
      document.getElementById("assinatura_app").value = String(menu.assinatura_app);

    } catch (erro) {
      console.error("❌ Erro ao carregar menu:", erro);
      Swal.fire("Erro", "Falha ao carregar dados do menu.", "error");
    }
  }
});
