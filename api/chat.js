// Conversa com a IA da tek4ll.
// Menores só conversam com a IA depois que o responsável aprova o acesso.
import { admin, usuarioDoToken, idadeDe, avaliarRisco, RESPOSTA_CRISE, RESPOSTA_SEGURANCA } from "./_lib.js";

const MODELO = "claude-haiku-5-5";

const PROMPT_SISTEMA = `Você é a assistente da tek4ll, uma plataforma de ciência cidadã e colaboração para pessoas com altas habilidades.
Regras obrigatórias:
- Diga, quando perguntarem, que você é uma inteligência artificial.
- Ajude a pensar e planejar projetos de forma prática: objetivo, etapas, dados necessários, riscos e próximos passos.
- Respeite a idade da pessoa: use linguagem clara e nunca conteúdo sexual, violento ou assustador.
- Não dê diagnósticos, orientação médica, psicológica ou jurídica. Encaminhe para um profissional habilitado.
- Não peça dados pessoais sensíveis (endereço, escola, telefone, senhas, fotos).
- Se a pessoa falar em se machucar, em abuso ou em perigo, acolha, oriente a procurar um adulto de confiança e informe os canais 190, 192, 188 e Disque 100.
- Seja breve, objetiva e encorajadora.`;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ erro: "método não permitido" });

  const user = await usuarioDoToken(req);
  if (!user) return res.status(401).json({ erro: "não autenticado" });

  const mensagem = String((req.body || {}).mensagem ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 1000);
  if (mensagem.length < 1) return res.status(400).json({ erro: "mensagem vazia" });

  const { data: perfil } = await admin.from("perfis").select("nascimento,menor").eq("id", user.id).maybeSingle();
  const idade = idadeDe(perfil);
  const menor = idade !== null && idade < 18;

  if (menor) {
    const { data: ap } = await admin.from("aprovacoes_responsavel")
      .select("aprovado_em,revogado_em").eq("user_id", user.id).maybeSingle();
    if (!ap || !ap.aprovado_em || ap.revogado_em) {
      return res.status(403).json({ erro: "aguardando aprovação do responsável", codigo: "sem_aprovacao" });
    }
  }

  // Verificação antes de qualquer envio ao modelo
  const risco = avaliarRisco(mensagem);
  if (risco) {
    await admin.from("sinalizacoes").insert({
      user_id: user.id, gravidade: risco.gravidade, motivo: risco.tipo,
      trecho: mensagem.slice(0, 300), status: "pendente"
    });
    const resposta = risco.tipo === "exploracao_sexual" ? RESPOSTA_SEGURANCA : RESPOSTA_CRISE;
    await admin.from("conversas").insert([
      { user_id: user.id, papel: "usuario", conteudo: mensagem },
      { user_id: user.id, papel: "ia", conteudo: resposta }
    ]);
    return res.status(200).json({ resposta, bloqueada: true });
  }

  // Histórico recente para contexto
  const { data: historico } = await admin.from("conversas")
    .select("papel,conteudo").eq("user_id", user.id).order("criado_em", { ascending: false }).limit(10);
  const mensagens = (historico || []).reverse().map(m => ({ role: m.papel === "ia" ? "assistant" : "user", content: m.conteudo }));
  mensagens.push({ role: "user", content: mensagem });

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: MODELO,
      max_tokens: 600,
      system: PROMPT_SISTEMA + (menor ? "\nA pessoa é menor de idade: use linguagem simples e adequada à idade." : ""),
      messages: mensagens
    })
  });
  if (!r.ok) return res.status(502).json({ erro: "a assistente está indisponível agora" });
  const dados = await r.json();
  const resposta = (dados.content || []).filter(p => p.type === "text").map(p => p.text).join("\n").trim()
    || "Não consegui responder agora. Tente de novo.";

  await admin.from("conversas").insert([
    { user_id: user.id, papel: "usuario", conteudo: mensagem },
    { user_id: user.id, papel: "ia", conteudo: resposta }
  ]);
  return res.status(200).json({ resposta, bloqueada: false });
}
