window.addEventListener("DOMContentLoaded", () => {
    if (window.opener) {
      window.opener.postMessage({ grupo: "apoioPronto" }, "*");
    }
  
    window.addEventListener("message", (event) => {
      if (event.data?.grupo === "dadosNovidade") {
        preencherCampos(event.data.payload);
      }
    });
  
    iniciarNovaNovidade();
  });
  
  // SALVAR
  ob_btnSalvar.addEventListener("click", async () => {
    const confirmacao = await Swal.fire({
      title: "Deseja salvar?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Salvar",
      cancelButtonText: "Cancelar"
    });
  
    if (!confirmacao.isConfirmed) return;
  
    const payload = {
      id: ob_id.value || null,
      emissao: ob_emissao.value,
      modulo: ob_modulo.value.trim(),
      descricao: ob_descricao.value.trim(),
      link: ob_link.value.trim()
    };
  
    try {
      const resp = await fetch("/novidades/salvar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
  
      const resultado = await resp.json();
  
      if (resp.ok) {
        if (!payload.id && resultado.id) ob_id.value = resultado.id;
        window.opener.Novidades.carregarNovidades();
        Swal.fire("Salvo!", "Novidade salva com sucesso.", "success");
      } else {
        Swal.fire("Erro", resultado.mensagem || "Erro ao salvar.", "error");
      }
    } catch (erro) {
      console.error("Erro ao salvar:", erro);
      Swal.fire("Erro", "Falha ao salvar novidade.", "error");
    }
  });
  
  // NOVO
  ob_btnNovo.addEventListener("click", iniciarNovaNovidade);
  
  // EXCLUIR
  ob_btnExcluir.addEventListener("click", async () => {
    if (!ob_id.value) return;
  
    const confirmacao = await Swal.fire({
      title: "Excluir?",
      text: "Essa ação não poderá ser desfeita.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sim, excluir",
      cancelButtonText: "Cancelar"
    });
  
    if (!confirmacao.isConfirmed) return;
  
    try {
      const resp = await fetch("/novidades/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ob_id.value })
      });
  
      const resultado = await resp.json();
  
      if (resp.ok) {
        Swal.fire("Excluído!", resultado.mensagem, "success");
        window.opener.Novidades.carregarNovidades();
        window.close();
      } else {
        Swal.fire("Erro", resultado.mensagem || "Erro ao excluir.", "error");
      }
    } catch (erro) {
      console.error("Erro ao excluir:", erro);
      Swal.fire("Erro", "Erro inesperado ao excluir.", "error");
    }
  });
  
  function preencherCampos(dados) {
    ob_id.value = dados.id;
    ob_emissao.value = dados.emissao;
    ob_modulo.value = dados.modulo;
    ob_descricao.value = dados.descricao;
    ob_link.value = dados.link || "";
  }
  
  function iniciarNovaNovidade() {
    ob_id.value = "";
    ob_emissao.value = new Date().toISOString().split("T")[0];
    ob_modulo.value = "";
    ob_descricao.value = "";
    ob_link.value = "";
  }