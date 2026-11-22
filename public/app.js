const sb = supabase.createClient(window.PONTE_CONFIG.url, window.PONTE_CONFIG.anonKey);
const $ = id => document.getElementById(id);
const dlg = $('dlg');
let usuario = "";
let temas = [];

/* ---------- utilidades ---------- */
function idade(s){ if(!s) return null; const h=new Date(), n=new Date(s+"T00:00:00"); let a=h.getFullYear()-n.getFullYear(); const m=h.getMonth()-n.getMonth(); if(m<0||(m===0&&h.getDate()<n.getDate())) a--; return a; }
function menor(){ const a=idade($("nasc").value); return a!==null && a<18; }
function cpfValido(c){
  c=c.replace(/\D/g,""); if(c.length!==11||/^(\d)\1+$/.test(c)) return false;
  let s=0; for(let i=0;i<9;i++) s+=c[i]*(10-i); let d=(s*10)%11%10; if(d!=c[9]) return false;
  s=0; for(let i=0;i<10;i++) s+=c[i]*(11-i); d=(s*10)%11%10; return d==c[10];
}
function emailOk(e){ return /^\S+@\S+\.\S+$/.test(e); }
function h(tag,cls,txt){ const e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; }

$("cpf").addEventListener("input", e=>{
  let v=e.target.value.replace(/\D/g,"").slice(0,11);
  v=v.replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d{1,2})$/,"$1-$2");
  e.target.value=v;
});
$("nasc").addEventListener("change", ()=>{ $("pais").hidden = !menor(); });

function abrir(aba){ dlg.showModal(); trocarAba(aba||"cad"); }
function trocarAba(aba){
  document.querySelectorAll(".aba").forEach(b=>b.classList.toggle("on", b.dataset.aba===aba));
  $("formCad").hidden = aba!=="cad"; $("formLogin").hidden = aba!=="login"; $("sucesso").hidden = true;
  $("tituloDlg").textContent = aba==="cad" ? "Entrar na tek4ll" : "Acessar sua conta";
  $("errCad").textContent=""; $("errLogin").textContent="";
}
document.querySelectorAll(".aba").forEach(b=>b.addEventListener("click", ()=>trocarAba(b.dataset.aba)));
$("btnQueroFazer").addEventListener("click", ()=>abrir("cad"));
$("btnEntrarTopo").addEventListener("click", ()=>abrir("login"));
$("fechar").addEventListener("click", ()=>dlg.close());

function validarCad(){
  const nome=$("nome").value.trim(), email=$("email").value.trim();
  if(!nome) return "Informe seu nome.";
  if(!emailOk(email)) return "Informe um e-mail válido.";
  if(!$("nasc").value) return "Informe sua data de nascimento.";
  if($("senha").value.length<8) return "A senha precisa ter pelo menos 8 caracteres.";
  if($("senha").value!==$("senha2").value) return "As senhas não são iguais.";
  if(menor()){
    if(!$("resp").value.trim()) return "Informe o nome do responsável.";
    if(!cpfValido($("cpf").value)) return "Confira o CPF do responsável.";
    if(!emailOk($("emailr").value.trim())) return "Informe o e-mail do responsável.";
    if(!$("autoriz").checked) return "O responsável precisa autorizar a participação.";
    if($("assin").value.trim().toLowerCase()!==$("resp").value.trim().toLowerCase()) return "A assinatura deve ser o nome completo do responsável.";
  }
  if(!$("termos").checked) return "Aceite os termos para continuar.";
  return null;
}

/* ---------- cadastro ---------- */
$("formCad").addEventListener("submit", async e=>{
  e.preventDefault();
  const erro=validarCad();
  if(erro){ $("errCad").textContent=erro; return; }
  const btn=e.submitter; btn.disabled=true; $("errCad").textContent="Criando sua conta...";
  const nome=$("nome").value.trim();
  const {data, error}=await sb.auth.signUp({
    email: $("email").value.trim(),
    password: $("senha").value,
    options: { data: { nome } }
  });
  btn.disabled=false;
  if(error){ $("errCad").textContent = error.message.includes("already") ? "Este e-mail já tem cadastro. Use \"Já tenho conta\"." : "Não foi possível criar a conta: "+error.message; return; }
  $("errCad").textContent="";
  // se a confirmação de e-mail estiver ativa, não há sessão ainda
  if(!data.session){ e.target.hidden=true; $("sucesso").hidden=false; $("sucesso").querySelector("p").textContent="Enviamos um e-mail para confirmar sua conta. Depois, entre com seu e-mail e senha."; $("irArea").hidden=true; return; }
  await registrarNoServidor(data.session.access_token, nome);
  e.target.hidden=true; $("sucesso").hidden=false; $("irArea").hidden=false;
  $("sucesso").querySelector("p").textContent="Enviamos um e-mail de boas-vindas com o primeiro guia.";
});

async function registrarNoServidor(token, nome){
  const body = { nome, nascimento: $("nasc").value, menor: menor() };
  if(menor()){
    Object.assign(body, { responsavel:$("resp").value.trim(), parentesco:$("parent").value, cpf:$("cpf").value, emailResponsavel:$("emailr").value.trim(), assinatura:$("assin").value.trim() });
  }
  const r = await fetch("/api/registrar", { method:"POST", headers:{ "Content-Type":"application/json", "Authorization":"Bearer "+token }, body: JSON.stringify(body) });
  if(!r.ok) console.error("registro no servidor falhou");
}

/* ---------- login ---------- */
$("formLogin").addEventListener("submit", async e=>{
  e.preventDefault();
  $("errLogin").textContent="Entrando...";
  const {data, error}=await sb.auth.signInWithPassword({ email: $("lemail").value.trim(), password: $("lsenha").value });
  if(error){ $("errLogin").textContent="E-mail ou senha incorretos."; return; }
  $("errLogin").textContent="";
  await entrarArea(data.user);
});

$("irArea").addEventListener("click", async ()=>{
  const {data}=await sb.auth.getUser();
  if(data && data.user) await entrarArea(data.user);
});

/* ---------- área logada ---------- */
async function carregarPerfil(user){
  const {data}=await sb.from("perfis").select("temas").eq("id", user.id).maybeSingle();
  temas = (data && data.temas) ? data.temas : [];
  return data;
}
async function salvarTemas(lista){
  temas = lista;
  const {data:{user}}=await sb.auth.getUser();
  if(user) await sb.from("perfis").upsert({ id:user.id, temas: lista });
}

async function entrarArea(user){
  usuario = (user.user_metadata && user.user_metadata.nome) || user.email;
  dlg.close();
  $("home").style.display="none";
  document.querySelector("header").style.display="none";
  $("app").hidden=false;
  const perfil = await carregarPerfil(user);
  if(!perfil || !perfil.temas || perfil.temas.length===0){
    const sel=new Set(); chips($("obChips"), sel);
    $("ob").showModal();
    $("obSalvar").onclick=async ()=>{ await salvarTemas([...sel]); $("ob").close(); rota(); };
    $("obPular").onclick=async ()=>{ await salvarTemas([]); $("ob").close(); rota(); };
  } else rota();
}

async function sairConta(){
  await sb.auth.signOut();
  $("app").hidden=true;
  document.querySelector("header").style.display="flex";
  $("home").style.display="flex";
  location.hash="";
  window.scrollTo(0,0);
}

/* ---------- conteúdo (exemplos) ---------- */
const TEMAS=["Saúde","Saúde mental","Alimentação","Saneamento","Meio ambiente e clima","Tecnologia","Economia","Empreendedorismo","Educação","Matemática","Filosofia","Astronomia"];
const ROTULO={noticia:"Notícia",curso:"Curso",projeto:"Projeto",pesquisa:"Pesquisa",divulgacao:"Divulgação científica"};
const DADOS=[
 {t:"noticia",tema:"Saúde",titulo:"Exemplo: saúde pública e dados locais",resumo:"Como informações de bairro ajudam a entender problemas de saúde."},
 {t:"noticia",tema:"Saneamento",titulo:"Exemplo: saneamento básico em comunidades",resumo:"Um resumo simples sobre água, esgoto e participação dos moradores."},
 {t:"noticia",tema:"Meio ambiente e clima",titulo:"Exemplo: monitoramento climático feito por voluntários",resumo:"Como observações de pessoas comuns complementam estações oficiais."},
 {t:"noticia",tema:"Economia",titulo:"Exemplo: economia e inovação no Brasil",resumo:"Panorama curto sobre novos negócios de base científica."},
 {t:"noticia",tema:"Empreendedorismo",titulo:"Exemplo: startups de impacto social",resumo:"Histórias de projetos que unem tecnologia e problemas reais."},
 {t:"noticia",tema:"Tecnologia",titulo:"Exemplo: ferramentas abertas para ciência",resumo:"Novidades sobre dados abertos e colaboração entre pesquisadores."},
 {t:"noticia",tema:"Saúde mental",titulo:"Exemplo: bem-estar e rotina de quem estuda",resumo:"Dicas de pesquisa sobre equilíbrio entre estudo e descanso."},
 {t:"noticia",tema:"Alimentação",titulo:"Exemplo: alimentação e segurança alimentar",resumo:"Dados simples sobre acesso a alimentos em diferentes regiões."},
 {t:"curso",tema:"Tecnologia",titulo:"Primeiros passos com o Claude",resumo:"O que é o Claude, como começar e como fazer o primeiro pedido.",status:"Disponível",link:"https://claude.ai/artifact/2xrXRyuLXVEyR7LmzLTzJt",cta:"Abrir guia",livro:true},
 {t:"curso",tema:"Tecnologia",titulo:"Claude Code na ciência cidadã",resumo:"Como delegar tarefas repetitivas e focar nas ideias.",status:"Em breve"},
 {t:"curso",tema:"Matemática",titulo:"Estatística para relatos de campo",resumo:"Organizar e interpretar dados coletados pela comunidade.",status:"Em breve"},
 {t:"curso",tema:"Filosofia",titulo:"Pensamento crítico e evidências",resumo:"Como avaliar informações antes de compartilhar.",status:"Em breve"},
 {t:"projeto",tema:"Saúde",titulo:"Mapa colaborativo de saúde de bairro",resumo:"Moradores registram necessidades locais para orientar ações.",status:"Em formação",cta:"Ver vagas"},
 {t:"projeto",tema:"Meio ambiente e clima",titulo:"Observação de aves e clima urbano",resumo:"Registros de fauna e temperatura em praças e parques.",status:"Aberto",cta:"Participar"},
 {t:"projeto",tema:"Saneamento",titulo:"Água limpa: relatos de torneiras",resumo:"Coleta de amostras simples e relatos sobre a qualidade da água.",status:"Aberto",cta:"Participar"},
 {t:"pesquisa",tema:"Educação",titulo:"Ensino de ciências em escolas públicas",resumo:"Pesquisa em andamento sobre métodos de aprendizagem.",status:"Em andamento"},
 {t:"pesquisa",tema:"Saúde mental",titulo:"Bem-estar de voluntários",resumo:"Estudo sobre rotina e motivação em projetos de ciência cidadã.",status:"Em andamento"},
 {t:"divulgacao",tema:"Astronomia",titulo:"Exemplo: artigo sobre astronomia amadora",resumo:"Resumo em linguagem simples de um artigo científico recente."},
 {t:"divulgacao",tema:"Filosofia",titulo:"Exemplo: ética e tecnologia",resumo:"Por que perguntas sobre tecnologia também são perguntas sobre pessoas."}
];
const filtrado = ()=> temas.length ? DADOS.filter(d=>temas.includes(d.tema)) : DADOS;
const por = (lista,t)=> lista.filter(d=>d.t===t);

function chips(el, sel, onChange){
  el.innerHTML="";
  TEMAS.forEach(t=>{ const b=h("button","chip"+(sel.has(t)?" on":""),t); b.type="button";
    b.onclick=()=>{ if(sel.has(t)) sel.delete(t); else sel.add(t); b.classList.toggle("on"); if(onChange) onChange(); };
    el.append(b); });
}
function cartao(d){
  const c=h("div","card"); c.append(h("div","tag",ROTULO[d.t]), h("h3","",d.titulo));
  if(d.resumo) c.append(h("p","",d.resumo));
  if(d.status) c.append(h("div","status",d.status));
  if(d.link){ const a=h("a","",d.cta||"Abrir"); a.href=d.link; a.target="_blank"; a.rel="noopener"; c.append(a); }
  else if(d.cta){ const b=h("a","",d.cta); b.href="#projetos"; c.append(b); }
  return c;
}
function secao(v,titulo,lista){ if(!lista.length) return; v.append(h("h2","",titulo)); const g=h("div","grid"); lista.forEach(d=>g.append(cartao(d))); v.append(g); }

/* ---------- páginas ---------- */
function inicio(v){
  v.append(h("h1","","Olá, "+(usuario.split(" ")[0]||"")+"!"));
  v.append(h("p","sub","Seu painel de ciência cidadã. Aqui está o que é novo para você."));
  const f=filtrado();
  secao(v,"Notícias do dia",por(f,"noticia").slice(0,4));
  secao(v,"Novos cursos",por(f,"curso"));
  secao(v,"Projetos com pessoas reais",por(f,"projeto"));
  secao(v,"Pesquisas em andamento",por(f,"pesquisa"));
  secao(v,"Divulgação científica",por(f,"divulgacao"));
}
function noticias(v){
  v.append(h("h1","","Notícias"), h("p","sub","Escolha os temas que quer acompanhar."));
  const box=h("div","chips"); v.append(box);
  const sel=new Set(temas); const lista=h("div"); v.append(lista);
  const desenha=()=>{ lista.innerHTML=""; const r=DADOS.filter(d=>d.t==="noticia"&&(sel.size===0||sel.has(d.tema))); const g=h("div","grid"); r.forEach(d=>g.append(cartao(d))); lista.append(g); };
  chips(box, sel, ()=>{ salvarTemas([...sel]); desenha(); });
  desenha();
}
function cursos(v){ v.append(h("h1","","Cursos"), h("p","sub","Aprenda no seu ritmo, com linguagem simples.")); secao(v,"Todos os cursos",por(DADOS,"curso")); }
function biblioteca(v){
  v.append(h("h1","","Biblioteca"), h("p","sub","E-books e materiais para ler e guardar."));
  secao(v,"E-books",DADOS.filter(d=>d.livro));
  secao(v,"Em breve",DADOS.filter(d=>d.t==="curso"&&!d.livro));
}
function pesquisas(v){
  v.append(h("h1","","Pesquisas"), h("p","sub","Estudos em andamento e artigos divulgados."));
  secao(v,"Pesquisas em andamento",por(DADOS,"pesquisa"));
  secao(v,"Artigos e divulgação",por(DADOS,"divulgacao"));
}
function projetos(v){ v.append(h("h1","","Projetos"), h("p","sub","Projetos reais com pessoas reais. Escolha onde quer contribuir.")); secao(v,"Projetos",por(DADOS,"projeto")); }
function perfil(v){
  v.append(h("h1","","Meu perfil"), h("p","sub","Olá, "+usuario+". Ajuste o que você quer ver no seu painel."));
  const box=h("div","chips"); v.append(h("h2","","Temas de interesse"), box);
  const sel=new Set(temas); chips(box, sel);
  const salvar=h("button","btn","Salvar temas"); salvar.style.marginTop="8px";
  salvar.onclick=async ()=>{ await salvarTemas([...sel]); location.hash="#inicio"; };
  const sair=h("button","ghostbtn","Sair da conta"); sair.style.marginTop="8px"; sair.onclick=sairConta;
  v.append(salvar, sair);
}
const PAGINAS={inicio,noticias,cursos,biblioteca,pesquisas,projetos,perfil};
function rota(){
  const p=(location.hash||"#inicio").slice(1);
  const pg=PAGINAS[p]?p:"inicio";
  document.querySelectorAll(".menu a").forEach(a=>a.classList.toggle("on", a.dataset.p===pg));
  const v=$("view"); v.innerHTML=""; PAGINAS[pg](v); window.scrollTo(0,0);
}
window.addEventListener("hashchange", rota);

/* ---------- sessão ao abrir a página ---------- */
(async ()=>{
  const {data:{session}}=await sb.auth.getSession();
  if(session && session.user) await entrarArea(session.user);
})();
