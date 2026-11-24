// Área dos moderadores: sinalizações pendentes e relatórios diários.
// Acesso restrito aos e-mails listados em MODERADORES.
import { admin, usuarioDoToken, moderadores, idadeDe } from "./_lib.js";

const STATUS = ["pendente", "em_analise", "encaminhada", "arquivada"];

async function ehModerador(user) {
  return moderadores().includes((user.email || "").toLowerCase());
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const user = await usuarioDoToken(req);
  if (!user) return res.status(401).json({ erro: "não autenticado" });
  if (!(await ehModerador(user))) return res.status(403).json({ erro: "acesso restrito aos moderadores" });

  if (req.method === "GET") {
    const { data } = await admin.from("sinalizacoes")
      .select("id,user_id,gravidade,motivo,trecho,status,criado_em")
      .in("status", ["pendente", "em_analise"]).order("criado_em", { ascending: false }).limit(100);
    return res.status(200).json(data || []);
  }

  if (req.method !== "POST") return res.status(405).json({ erro: "método não permitido" });
  const b = req.body || {};

  if (b.acao === "atualizar_sinalizacao") {
    if (!STATUS.includes(b.status)) return res.status(400).json({ erro: "status inválido" });
    await admin.from("sinalizacoes").update({
      status: b.status, tratado_por: user.email, tratado_em: new Date().toISOString()
    }).eq("id", Number(b.id));
    return res.status(200).json({ ok: true });
  }

  if (b.acao === "gerar_relatorio") {
    // Resume apenas o dia pedido. O texto é curto e não inclui trechos literais das conversas.
    const dia = String(b.dia || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return res.status(400).json({ erro: "data inválida" });
    const { data: msgs } = await admin.from("conversas").select("papel,conteudo,criado_em")
      .eq("user_id", b.userId).gte("criado_em", dia + "T00:00:00Z").lt("criado_em", dia + "T23:59:59Z").limit(200);
    if (!msgs || msgs.length === 0) return res.status(200).json({ resumo: "Nenhuma conversa neste dia." });

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-5-5",
        max_tokens: 400,
        system: "Você escreve relatórios diários simples e objetivos para responsáveis e para a própria pessoa. Liste o que foi pensado, planejado e desenvolvido. Não copie frases literais das conversas, não use linguagem alarmista e não inclua dados pessoais.",
        messages: [{ role: "user", content: "Resuma as conversas deste dia em até 5 tópicos curtos:\n" + msgs.map(m => `${m.papel}: ${m.conteudo}`).join("\n") }]
      })
    });
    if (!r.ok) return res.status(502).json({ erro: "não foi possível gerar o relatório" });
    const dados = await r.json();
    const resumo = (dados.content || []).filter(p => p.type === "text").map(p => p.text).join("\n").trim();
    await admin.from("relatorios").upsert({ user_id: b.userId, dia, resumo, gerado_em: new Date().toISOString() });
    return res.status(200).json({ resumo });
  }

  return res.status(400).json({ erro: "ação desconhecida" });
}
