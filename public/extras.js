// Módulos da tek4ll: Minha IA, Profissionais e Planos. Carrega depois do app.js e usa o mesmo cliente Supabase.
(function () {
  const $e = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const CORES = ["#c6ff00", "#ff00c8", "#9b1bff", "#ffffff"];

  async function token() {
    const { data: { session } } = await sb.auth.getSession();
    return session ? session.access_token : null;
  }
  async function api(path, opcoes = {}) {
    const t = await token();
    const r = await fetch(path, {
      ...opcoes,
      headers: { "Content-Type": "application/json", ...(t ? { Authorization: "Bearer " + t } : {}), ...(opcoes.headers || {}) },
      body: opcoes.body ? JSON.stringify(opcoes.body) : undefined
    });
    const dados = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, dados };
  }

  /* ---------- Minha IA ---------- */
  async function minhaIA(v) {
    v.append($e("h1", "", "Minha IA"), $e("p", "sub", "Escolha o nome e a aparência da sua assistente. Ela ajuda você a planejar projetos."));

    const form = $e("form"); form.style.maxWidth = "560px";
    const campo = (rotulo, el) => { const w = $e("div"); w.append($e("label", "", rotulo), el); w.style.margin = "12px 0"; return w; };
    const nome = $e("input"); nome.maxLength = 30; nome.placeholder = "ex.: Luna";
    const sel = (opts) => { const s = $e("select"); opts.forEach(([val, txt]) => { const o = $e("option", "", txt); o.value = val; s.append(o); }); return s; };
    const genero = sel([["neutro", "Neutro"], ["menina", "Menina"], ["menino", "Menino"]]);
    const cabelo = sel([["curto", "Curto"], ["medio", "Médio"], ["longo", "Longo"], ["cacheado", "Cacheado"], ["liso", "Liso"]]);
    const roupa = sel([["camiseta", "Camiseta"], ["moletom", "Moletom"], ["jaqueta", "Jaqueta"], ["jaleco", "Jaleco"]]);
    let cor = CORES[0];
    const corBox = $e("div", "chips");
    CORES.forEach(c => { const b = $e("button", "chip", ""); b.type = "button"; b.style.background = c; b.style.width = "44px"; b.style.height = "44px"; b.style.borderRadius = "50%"; b.onclick = () => { cor = c; prev(); }; corBox.append(b); });
    const previa = $e("div"); previa.style.cssText = "width:120px;height:120px;border-radius:50%;margin:10px 0;display:grid;place-items:center;color:#000;font-weight:700;font-size:20px";
    const prev = () => { previa.style.background = cor; previa.textContent = (nome.value || "IA").slice(0, 6); };
    nome.oninput = prev; prev();
    const msg = $e("div", "nota"); msg.style.marginTop = "10px";
    const salvar = $e("button", "btn", "Salvar minha IA"); salvar.type = "submit";
    form.append(campo("Nome da sua IA", nome), campo("Estilo", genero), campo("Cabelo", cabelo), campo("Roupa", roupa), campo("Cor", corBox), previa, salvar, msg);
    form.onsubmit = async e => {
      e.preventDefault();
      const r = await api("/api/avatar", { method: "POST", body: { nome_ia: nome.value, genero: genero.value, cabelo: cabelo.value, roupa: roupa.value, cor } });
      msg.textContent = r.ok ? "Sua IA foi salva." : (r.dados.erro || "Não foi possível salvar.");
    };
    v.append(form);

    // carrega o que já está salvo
    const atual = await api("/api/avatar");
    if (atual.ok && atual.dados) { nome.value = atual.dados.nome_ia; genero.value = atual.dados.genero; cabelo.value = atual.dados.cabelo; roupa.value = atual.dados.roupa; cor = atual.dados.cor; prev(); }

    // assistente: em breve
    v.append($e("h2", "", "Sua assistente de IA"));
    const card = $e("div", "card");
    card.style.maxWidth = "720px";
    card.append(
      $e("div", "tag", "Em breve"),
      $e("h3", "", "Uma assistente feita com cuidado"),
      $e("p", "", "Estamos construindo a assistente com as proteções que crianças e adolescentes merecem: ela só conversa depois que o responsável aprova o acesso, sempre se apresenta como inteligência artificial e encaminha temas de saúde, segurança e direitos para as pessoas certas."),
      $e("p", "", "Quando estiver disponível, você conversa com ela para transformar ideias em projetos: objetivo, etapas, dados necessários e próximos passos."),
      $e("p", "nota", "Enquanto isso, você já pode personalizar sua assistente acima.")
    );
    v.append(card);
  }

  /* ---------- Profissionais ---------- */
  function profissionais(v) {
    v.append($e("h1", "", "Profissionais"), $e("p", "sub", "Quer ensinar, publicar cursos ou lecionar na tek4ll? Envie sua ficha. Nossa equipe entra em contato."));
    const form = $e("form"); form.style.maxWidth = "560px";
    const campo = (rotulo, el) => { const w = $e("div"); w.style.margin = "12px 0"; w.append($e("label", "", rotulo), el); return w; };
    const inp = (ph, max) => { const i = $e("input"); i.placeholder = ph; i.maxLength = max || 200; return i; };
    const nome = inp("Nome completo", 120), email = inp("E-mail", 254), area = inp("Sua área (ex.: física, pedagogia)", 120),
      formacao = inp("Formação e experiência", 300), portfolio = inp("Link do portfólio ou currículo (opcional)", 300);
    const interesse = $e("select"); [["professor", "Quero lecionar"], ["publicar_curso", "Quero publicar cursos"], ["ambos", "Os dois"]].forEach(([v2, t]) => { const o = $e("option", "", t); o.value = v2; interesse.append(o); });
    const mensagem = $e("textarea"); mensagem.rows = 4; mensagem.maxLength = 1000; mensagem.placeholder = "Conte o que você gostaria de ensinar ou criar";
    const msg = $e("div", "nota"); msg.style.marginTop = "10px";
    const enviar = $e("button", "btn", "Enviar ficha"); enviar.type = "submit";
    form.append(campo("Nome", nome), campo("E-mail", email), campo("Área", area), campo("Formação", formacao), campo("Portfólio", portfolio), campo("Tipo de participação", interesse), campo("Mensagem", mensagem), enviar, msg);
    form.onsubmit = async e => {
      e.preventDefault();
      const r = await api("/api/profissional", { method: "POST", body: { nome: nome.value, email: email.value, area: area.value, formacao: formacao.value, interesse: interesse.value, portfolio: portfolio.value, mensagem: mensagem.value } });
      msg.textContent = r.ok ? "Ficha enviada. Nossa equipe entra em contato pelo e-mail informado." : (r.dados.erro || "Não foi possível enviar.");
    };
    v.append(form);
  }

  /* ---------- Planos (Pix) ---------- */
  function planos(v) {
    v.append($e("h1", "", "Planos"), $e("p", "sub", "Pagamento por Pix, com 15% de desconto."));
    const PLANOS = [
      { id: "comunidade", nome: "Comunidade", base: 119.9, itens: ["Aulas gravadas", "Desafios e acompanhamento", "Projetos de ciência cidadã"] },
      { id: "ao-vivo", nome: "Ao vivo", base: 189.0, itens: ["Tudo do plano Comunidade", "Aulas e palestras ao vivo", "Perguntas e participação ativa", "Ingressos promocionais em encontros presenciais"] }
    ];
    const fmt = x => "R$ " + x.toFixed(2).replace(".", ",");
    const grade = $e("div", "grid"); v.append(grade);
    PLANOS.forEach(p => {
      const c = $e("div", "card"); const preco = $e("div", "", fmt(p.base * 0.85) + " /mês"); preco.style.cssText = "font-size:40px;font-weight:700;margin:10px 0";
      const nota = $e("p", "nota", "De " + fmt(p.base) + " com 15% de desconto no Pix.");
      const btn = $e("button", "btn", "Assinar " + p.nome); btn.type = "button";
      const saida = $e("div", "nota"); saida.style.marginTop = "12px";
      c.append($e("h3", "", p.nome), preco, nota, ...p.itens.map(i => $e("p", "", "✓ " + i)), btn, saida);
      btn.onclick = async () => {
        btn.disabled = true; saida.textContent = "Gerando seu pedido...";
        const r = await api("/api/checkout", { method: "POST", body: { plano: p.id } });
        btn.disabled = false;
        if (r.ok) {
          saida.textContent = "";
          saida.append($e("p", "", "Chave Pix: " + r.dados.chave), $e("p", "", "Valor: " + fmt(r.dados.valor)), $e("p", "", "Referência: " + r.dados.referencia), $e("p", "", r.dados.instrucoes));
        } else saida.textContent = r.dados.erro || "Não foi possível gerar o pedido.";
      };
      grade.append(c);
    });
    const dir = $e("div", "legal");
    dir.style.cssText = "margin-top:40px;font-size:15px;color:#b5b5b5;border-top:1px solid #2a2a2a;padding-top:18px";
    const bt = $e("button", "ghostbtn", "Desistir da contratação (até 7 dias)"); bt.type = "button";
    const r2 = $e("p", "nota", "");
    bt.onclick = async () => {
      const chave = prompt("Informe sua chave Pix para receber o reembolso integral:");
      if (!chave) return;
      const r = await api("/api/arrependimento", { method: "POST", body: { chave_pix: chave } });
      r2.textContent = r.dados.mensagem || r.dados.erro;
    };
    dir.append($e("p", "", "Você pode desistir da contratação em até 7 dias após o pagamento, com reembolso integral (Código de Defesa do Consumidor, art. 49)."), bt, r2);
    v.append(dir);
  }

  /* ---------- Blog: autores, revisão e equipe ---------- */
  const ESTADO = { papel: null };
  const STATUS_ROTULO = { rascunho: "Rascunho", revisao: "Em revisão", publicado: "Publicado" };

  function campoTexto(rotulo, el) { const w = $e("div"); w.style.margin = "12px 0"; w.append($e("label", "", rotulo), el); return w; }

  async function escrever(v) {
    v.append($e("h1", "", "Escrever"), $e("p", "sub", "Escreva, envie para revisão e acompanhe suas publicações no blog."));
    const titulo = $e("input"); titulo.maxLength = 140; titulo.placeholder = "Título da publicação";
    const tema = $e("input"); tema.maxLength = 40; tema.placeholder = "Tema (ex.: saúde, tecnologia)";
    const resumo = $e("textarea"); resumo.rows = 2; resumo.maxLength = 300; resumo.placeholder = "Resumo curto (aparece na lista do blog)";
    const corpo = $e("textarea"); corpo.rows = 12; corpo.maxLength = 20000; corpo.placeholder = "Texto completo. Separe os parágrafos com uma linha em branco.";
    const imagemArq = $e("input"); imagemArq.type = "file"; imagemArq.accept = "image/jpeg,image/png,image/webp";
    const imagemUrl = $e("input"); imagemUrl.placeholder = "Ou cole o endereço (https://...) de uma imagem";
    const msg = $e("div", "nota"); msg.style.marginTop = "10px";
    let idEditando = null;

    const form = $e("form"); form.style.maxWidth = "720px";
    const salvar = $e("button", "btn", "Salvar rascunho"); salvar.type = "submit";
    const limpar = $e("button", "ghostbtn", "Novo texto"); limpar.type = "button";
    form.append(campoTexto("Título", titulo), campoTexto("Tema", tema), campoTexto("Resumo", resumo), campoTexto("Texto", corpo), campoTexto("Imagem (JPG, PNG ou WebP, até 2 MB)", imagemArq), campoTexto("Endereço da imagem", imagemUrl), salvar, limpar, msg);

    async function enviarImagem() {
      const f = imagemArq.files[0];
      if (!f) return null;
      if (f.size > 2 * 1024 * 1024) throw new Error("A imagem deve ter até 2 MB.");
      const base64 = await new Promise((ok, falha) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = falha; r.readAsDataURL(f); });
      const r = await api("/api/blog", { method: "POST", body: { acao: "imagem", tipo: f.type, dados: base64 } });
      if (!r.ok) throw new Error(r.dados.erro || "falha ao enviar a imagem");
      return r.dados.url;
    }
    form.onsubmit = async e => {
      e.preventDefault();
      msg.textContent = "Salvando...";
      try {
        const url = (await enviarImagem()) || imagemUrl.value.trim() || null;
        const r = await api("/api/blog", { method: "POST", body: { acao: "salvar", id: idEditando, titulo: titulo.value, tema: tema.value, resumo: resumo.value, corpo: corpo.value, imagem_url: url } });
        if (r.ok) { idEditando = r.dados.id; msg.textContent = "Rascunho salvo. Quando estiver pronto, envie para revisão na lista abaixo."; carregarMeus(); }
        else msg.textContent = r.dados.erro || "Não foi possível salvar.";
      } catch (err) { msg.textContent = err.message; }
    };
    limpar.onclick = () => { idEditando = null; [titulo, tema, resumo, corpo, imagemUrl].forEach(x => x.value = ""); imagemArq.value = ""; msg.textContent = ""; };
    v.append(form);

    v.append($e("h2", "", "Meus textos"));
    const lista = $e("div"); v.append(lista);
    async function carregarMeus() {
      const r = await api("/api/blog");
      lista.innerHTML = "";
      if (!r.ok) { lista.append($e("p", "nota", r.dados.erro || "Não foi possível carregar.")); return; }
      if (!r.dados.length) lista.append($e("p", "nota", "Você ainda não tem textos."));
      r.dados.forEach(p => {
        const c = $e("div", "card"); c.style.margin = "10px 0"; c.append($e("div", "tag", STATUS_ROTULO[p.status] || p.status), $e("h3", "", p.titulo));
        if (p.status === "publicado") { const a = $e("a", "", "Ver no blog"); a.href = "/blog/" + (p.slug || ""); a.target = "_blank"; c.append(a); }
        if (p.status === "rascunho") {
          const ed = $e("button", "chip", "Editar"); ed.type = "button"; ed.onclick = () => { idEditando = p.id; titulo.value = p.titulo; tema.value = p.tema || ""; resumo.value = p.resumo || ""; corpo.value = p.corpo || ""; imagemUrl.value = p.imagem_url || ""; msg.textContent = "Editando este texto."; window.scrollTo(0, 0); };
          const env = $e("button", "chip", "Enviar para revisão"); env.type = "button"; env.onclick = async () => { const r2 = await api("/api/blog", { method: "POST", body: { acao: "enviar", id: p.id } }); msg.textContent = r2.ok ? "Enviado para revisão." : r2.dados.erro; carregarMeus(); };
          const exc = $e("button", "chip", "Excluir"); exc.type = "button"; exc.onclick = async () => { if (!confirm("Excluir este rascunho?")) return; await api("/api/blog", { method: "POST", body: { acao: "excluir", id: p.id } }); carregarMeus(); };
          c.append(ed, env, exc);
        }
        lista.append(c);
      });
    }
    carregarMeus();
  }

  async function revisao(v) {
    v.append($e("h1", "", "Revisão"), $e("p", "sub", "Textos enviados pelos colunistas, à espera de aprovação."));
    const lista = $e("div"); v.append(lista);
    const r = await api("/api/blog?fila=1");
    if (!r.ok) { lista.append($e("p", "nota", r.dados.erro || "Somente editores acessam esta página.")); return; }
    if (!r.dados.length) lista.append($e("p", "nota", "Nenhum texto aguardando revisão."));
    r.dados.forEach(p => {
      const c = $e("div", "card"); c.style.margin = "12px 0";
      c.append($e("div", "tag", (p.tema || "Geral") + " · " + (p.autor_nome || "")), $e("h3", "", p.titulo), $e("p", "", p.resumo || ""));
      const corpo = $e("details"); corpo.append($e("summary", "", "Ler o texto completo"), $e("div", "", p.corpo));
      corpo.style.margin = "8px 0";
      const data = $e("input"); data.type = "datetime-local"; data.title = "Deixe em branco para publicar agora";
      const aprovar = $e("button", "chip", "Aprovar e publicar"); aprovar.type = "button";
      const agendar = $e("button", "chip", "Aprovar e agendar"); agendar.type = "button";
      const devolver = $e("button", "chip", "Devolver ao autor"); devolver.type = "button";
      const msg = $e("p", "nota", "");
      aprovar.onclick = async () => { const r2 = await api("/api/blog", { method: "POST", body: { acao: "aprovar", id: p.id } }); msg.textContent = r2.ok ? "Publicado." : r2.dados.erro; if (r2.ok) revisaoRecarrega(); };
      agendar.onclick = async () => { if (!data.value) { msg.textContent = "Escolha a data e a hora para agendar."; return; } const r2 = await api("/api/blog", { method: "POST", body: { acao: "aprovar", id: p.id, publicar_em: new Date(data.value).toISOString() } }); msg.textContent = r2.ok ? "Agendado." : r2.dados.erro; if (r2.ok) revisaoRecarrega(); };
      devolver.onclick = async () => { const r2 = await api("/api/blog", { method: "POST", body: { acao: "devolver", id: p.id } }); msg.textContent = r2.ok ? "Devolvido ao autor." : r2.dados.erro; if (r2.ok) revisaoRecarrega(); };
      c.append(corpo, data, aprovar, agendar, devolver, msg);
      lista.append(c);
    });
    function revisaoRecarrega() { v.innerHTML = ""; revisao(v); }
  }

  async function equipe(v) {
    v.append($e("h1", "", "Equipe"), $e("p", "sub", "Convide colunistas e editores. A pessoa precisa ter uma conta na plataforma."));
    const form = $e("form"); form.style.maxWidth = "560px";
    const email = $e("input"); email.type = "email"; email.placeholder = "E-mail da conta";
    const nome = $e("input"); nome.maxLength = 80; nome.placeholder = "Nome que aparece nos textos";
    const papel = $e("select"); [["colunista", "Colunista (escreve)"], ["editor", "Editor (aprova e agenda)"]].forEach(([k, t]) => { const o = $e("option", "", t); o.value = k; papel.append(o); });
    const bio = $e("textarea"); bio.rows = 3; bio.maxLength = 400; bio.placeholder = "Uma linha sobre a pessoa (opcional)";
    const msg = $e("p", "nota", "");
    const enviar = $e("button", "btn", "Convidar"); enviar.type = "submit";
    form.append(campoTexto("E-mail", email), campoTexto("Nome público", nome), campoTexto("Papel", papel), campoTexto("Bio", bio), enviar, msg);
    form.onsubmit = async e => { e.preventDefault(); const r = await api("/api/blog", { method: "POST", body: { acao: "convidar", email: email.value, nome_publico: nome.value, papel: papel.value, bio: bio.value } }); msg.textContent = r.ok ? "Convite feito. A pessoa já pode escrever ou revisar." : (r.dados.erro || "Não foi possível convidar."); };
    v.append(form);
  }

  // Menu de autor aparece só para contas de autor
  async function menuAutor() {
    if (document.querySelector('.menu a[data-p="escrever"]')) return;
    const r = await api("/api/blog?papel=1");
    if (!r.ok || !r.dados.papel) return;
    ESTADO.papel = r.dados.papel;
    const links = document.querySelector(".menu .links");
    const extras = [["escrever", "Escrever"]];
    if (r.dados.papel === "editor" || r.dados.papel === "admin") extras.push(["revisao", "Revisão"]);
    if (r.dados.papel === "admin") extras.push(["equipe", "Equipe"]);
    extras.forEach(([p, t]) => { const a = $e("a", "", t); a.href = "#" + p; a.dataset.p = p; links.append(a); });
  }
  const appEl = document.getElementById("app");
  if (appEl) new MutationObserver(() => { if (!appEl.hidden) menuAutor(); }).observe(appEl, { attributes: true, attributeFilter: ["hidden"] });

  PAGINAS.escrever = escrever;
  PAGINAS.revisao = revisao;
  PAGINAS.equipe = equipe;

  // Notícias do painel: posts publicados no blog
  PAGINAS.noticias = async function (v) {
    v.append($e("h1", "", "Notícias"), $e("p", "sub", "Publicações do blog da tek4ll."));
    const r = await fetch("/api/publico?feed=1");
    const lista = r.ok ? await r.json() : [];
    if (!lista.length) { v.append($e("p", "nota", "Em breve, novas publicações.")); return; }
    const g = $e("div", "grid"); v.append(g);
    lista.forEach(p => {
      const c = $e("div", "card"); c.append($e("div", "tag", p.tema || "Notícia"), $e("h3", "", p.titulo), $e("p", "", p.resumo || ""), $e("div", "status", (p.autor_nome || "") + " · " + new Date(p.publicado_em).toLocaleDateString("pt-BR")));
      const a = $e("a", "", "Ler"); a.href = "/blog/" + p.slug; a.target = "_blank"; a.rel = "noopener"; c.append(a);
      g.append(c);
    });
  };

  /* ---------- menu e rotas ---------- */
  const links = document.querySelector(".menu .links");
  if (links) [["ia", "Minha IA"], ["profissionais", "Profissionais"], ["planos", "Planos"]].forEach(([p, t]) => {
    const a = $e("a", "", t); a.href = "#" + p; a.dataset.p = p; links.append(a);
  });
  PAGINAS.ia = minhaIA;
  PAGINAS.profissionais = profissionais;
  PAGINAS.planos = planos;
})();
