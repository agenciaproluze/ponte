// Administração da plataforma. Acesso restrito aos e-mails de MODERADORES.
import { admin, usuarioDoToken, moderadores } from "./_lib.js";

const ANTHROPIC_OK = () => !!process.env.ANTHROPIC_API_KEY;

async function contar(tabela, filtro) {
  let q = admin.from(tabela).select("*", { count: "exact", head: true });
  if (filtro) q = filtro(q);
  const { count } = await q;
  return count || 0;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const user = await usuarioDoToken(req);
  if (!user) return res.status(401).json({ erro: "não autenticado" });
  if (!moderadores().includes((user.email || "").toLowerCase())) return res.status(403).json({ erro: "acesso restrito à equipe" });

  if (req.method === "GET") {
    const secao = req.query.secao || "visao";

    if (secao === "visao") {
      return res.status(200).json({
        membros: await contar("perfis"),
        assinaturas_ativas: await contar("assinaturas", q => q.eq("status", "ativa")),
        pagamentos_pendentes: await contar("assinaturas", q => q.eq("status", "pendente")),
        posts_publicados: await contar("posts", q => q.eq("status", "publicado")),
        posts_em_revisao: await contar("posts", q => q.eq("status", "revisao")),
        sinalizacoes_abertas: await contar("sinalizacoes", q => q.in("status", ["pendente", "em_analise"])),
        fichas_novas: await contar("fichas_profissionais", q => q.eq("status", "nova")),
        assistente_ativa: ANTHROPIC_OK()
      });
    }
    if (secao === "assinaturas") {
      const { data } = await admin.from("assinaturas").select("user_id,plano,metodo,status,mp_pagamento_id,valido_ate,ultimo_pagamento,reembolso_pix,atualizado_em").order("atualizado_em", { ascending: false }).limit(200);
      const ids = [...new Set((data || []).map(a => a.user_id))];
      const { data: perfis } = ids.length ? await admin.from("perfis").select("id,nome").in("id", ids) : { data: [] };
      const nomes = Object.fromEntries((perfis || []).map(p => [p.id, p.nome]));
      return res.status(200).json((data || []).map(a => ({ ...a, nome: nomes[a.user_id] || "" })));
    }
    if (secao === "membros") {
      const q = String(req.query.q || "").trim().toLowerCase();
      const { data: lista } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const usuarios = (lista?.users || []).filter(u => !q || (u.email || "").toLowerCase().includes(q) || (u.user_metadata?.nome || "").toLowerCase().includes(q)).slice(0, 50);
      const ids = usuarios.map(u => u.id);
      const { data: perfis } = ids.length ? await admin.from("perfis").select("id,nome,nascimento,menor").in("id", ids) : { data: [] };
      const { data: ass } = ids.length ? await admin.from("assinaturas").select("user_id,status,valido_ate").in("user_id", ids) : { data: [] };
      const perfilDe = Object.fromEntries((perfis || []).map(p => [p.id, p]));
      const assDe = Object.fromEntries((ass || []).map(a => [a.user_id, a]));
      return res.status(200).json(usuarios.map(u => ({
        id: u.id, email: u.email, nome: perfilDe[u.id]?.nome || u.user_metadata?.nome || "",
        nascimento: perfilDe[u.id]?.nascimento || null, menor: !!perfilDe[u.id]?.menor,
        assinatura: assDe[u.id]?.status || "sem assinatura", valido_ate: assDe[u.id]?.valido_ate || null,
        suspenso: !!u.banned_until && new Date(u.banned_until) > new Date()
      })));
    }
    if (secao === "sinalizacoes") {
      const { data } = await admin.from("sinalizacoes").select("id,user_id,gravidade,motivo,trecho,status,criado_em,tratado_por,tratado_em")
        .order("criado_em", { ascending: false }).limit(200);
      return res.status(200).json(data || []);
    }
    if (secao === "fichas") {
      const { data } = await admin.from("fichas_profissionais").select("*").order("criado_em", { ascending: false }).limit(200);
      return res.status(200).json(data || []);
    }
    return res.status(400).json({ erro: "seção inválida" });
  }

  if (req.method !== "POST") return res.status(405).json({ erro: "método não permitido" });
  const b = req.body || {};
  const agora = new Date().toISOString();

  if (b.acao === "assinatura") {
    const { data: ass } = await admin.from("assinaturas").select("user_id").eq("mp_pagamento_id", String(b.referencia || "")).maybeSingle();
    if (!ass) return res.status(404).json({ erro: "pedido não encontrado" });
    if (b.status === "ativa") {
      const validoAte = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString();
      await admin.from("assinaturas").update({ status: "ativa", ultimo_pagamento: agora, valido_ate: validoAte, atualizado_em: agora }).eq("user_id", ass.user_id);
    } else if (b.status === "cancelada") {
      await admin.from("assinaturas").update({ status: "cancelada", atualizado_em: agora }).eq("user_id", ass.user_id);
    } else return res.status(400).json({ erro: "status inválido" });
    return res.status(200).json({ ok: true });
  }
  if (b.acao === "membro") {
    if (!b.user_id) return res.status(400).json({ erro: "membro inválido" });
    const duracao = b.suspender ? "876000h" : "none";
    const { error } = await admin.auth.admin.updateUserById(String(b.user_id), { ban_duration: duracao });
    if (error) return res.status(500).json({ erro: "não foi possível alterar a conta" });
    return res.status(200).json({ ok: true });
  }
  if (b.acao === "sinalizacao") {
    if (!["pendente", "em_analise", "encaminhada", "arquivada"].includes(b.status)) return res.status(400).json({ erro: "status inválido" });
    await admin.from("sinalizacoes").update({ status: b.status, tratado_por: user.email, tratado_em: agora }).eq("id", Number(b.id));
    return res.status(200).json({ ok: true });
  }
  if (b.acao === "ficha") {
    if (!["nova", "em_contato", "aprovada", "recusada"].includes(b.status)) return res.status(400).json({ erro: "status inválido" });
    await admin.from("fichas_profissionais").update({ status: b.status }).eq("id", Number(b.id));
    return res.status(200).json({ ok: true });
  }
  if (b.acao === "relatorio") {
    if (!ANTHROPIC_OK()) return res.status(503).json({ erro: "Os relatórios automáticos ficam disponíveis quando a assistente for ativada." });
    const dia = String(b.dia || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || !b.user_id) return res.status(400).json({ erro: "dados inválidos" });
    const { data: msgs } = await admin.from("conversas").select("papel,conteudo").eq("user_id", b.user_id)
      .gte("criado_em", dia + "T00:00:00Z").lt("criado_em", dia + "T23:59:59Z").limit(200);
    if (!msgs || msgs.length === 0) return res.status(200).json({ resumo: "Nenhuma conversa neste dia." });
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-haiku-5-5", max_tokens: 400,
        system: "Você escreve relatórios diários simples para responsáveis. Liste o que foi pensado, planejado e desenvolvido, em até 5 tópicos. Não copie frases literais e não inclua dados pessoais.",
        messages: [{ role: "user", content: msgs.map(m => `${m.papel}: ${m.conteudo}`).join("\n") }] })
    });
    if (!r.ok) return res.status(502).json({ erro: "não foi possível gerar o relatório" });
    const dados = await r.json();
    const resumo = (dados.content || []).filter(p => p.type === "text").map(p => p.text).join("\n").trim();
    await admin.from("relatorios").upsert({ user_id: b.user_id, dia, resumo, gerado_em: agora });
    return res.status(200).json({ resumo });
  }
  return res.status(400).json({ erro: "ação desconhecida" });
}
