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

    // conversa
    v.append($e("h2", "", "Converse com sua IA"));
    const aviso = $e("p", "nota", "Você está conversando com uma inteligência artificial. Conversas podem ser revisadas pela moderação se houver sinal de risco.");
    const area = $e("div"); area.style.cssText = "border:1px solid #333;border-radius:12px;padding:16px;min-height:200px;max-width:720px";
    const entrada = $e("input"); entrada.placeholder = "Escreva sua pergunta ou ideia"; entrada.maxLength = 1000;
    const enviar = $e("button", "btn", "Enviar"); enviar.type = "button";
    const linha = $e("div"); linha.style.cssText = "display:flex;gap:10px;margin-top:12px;max-width:720px"; entrada.style.flex = "1";
    linha.append(entrada, enviar);
    const bolha = (quem, texto) => { const b = $e("p", "", (quem === "ia" ? "IA: " : "Você: ") + texto); b.style.color = quem === "ia" ? "#fff" : "#b5b5b5"; area.append(b); area.scrollTop = area.scrollHeight; };
    const perguntar = async () => {
      const t = entrada.value.trim(); if (!t) return;
      bolha("usuario", t); entrada.value = "";
      const r = await api("/api/chat", { method: "POST", body: { mensagem: t } });
      if (r.ok) bolha("ia", r.dados.resumo || r.dados.resposta);
      else if (r.dados.codigo === "sem_aprovacao") bolha("ia", "Esta conta é de menor de idade. A conversa com a IA começa depois que o responsável aprovar o acesso pelo e-mail enviado.");
      else bolha("ia", r.dados.erro || "Não consegui responder agora.");
    };
    enviar.onclick = perguntar;
    entrada.onkeydown = e => { if (e.key === "Enter") perguntar(); };
    v.append(aviso, area, linha);
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

  /* ---------- menu e rotas ---------- */
  const links = document.querySelector(".menu .links");
  if (links) [["ia", "Minha IA"], ["profissionais", "Profissionais"], ["planos", "Planos"]].forEach(([p, t]) => {
    const a = $e("a", "", t); a.href = "#" + p; a.dataset.p = p; links.append(a);
  });
  PAGINAS.ia = minhaIA;
  PAGINAS.profissionais = profissionais;
  PAGINAS.planos = planos;
})();
