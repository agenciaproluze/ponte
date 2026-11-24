// Moderação/administração: confirma o Pix recebido e ativa a assinatura (válida por 31 dias).
import { admin, usuarioDoToken, moderadores } from "./_lib.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ erro: "método não permitido" });
  const user = await usuarioDoToken(req);
  if (!user) return res.status(401).json({ erro: "não autenticado" });
  if (!moderadores().includes((user.email || "").toLowerCase())) return res.status(403).json({ erro: "acesso restrito" });

  const { referencia, acao } = req.body || {};
  if (!/^TEK4LL-[A-Z0-9]{8}-[A-Z0-9]+$/.test(String(referencia || ""))) return res.status(400).json({ erro: "referência inválida" });

  const { data: ass } = await admin.from("assinaturas").select("user_id,status").eq("mp_pagamento_id", referencia).maybeSingle();
  if (!ass) return res.status(404).json({ erro: "pedido não encontrado" });

  if (acao === "ativar") {
    const agora = new Date();
    const validoAte = new Date(agora.getTime() + 31 * 24 * 60 * 60 * 1000);
    await admin.from("assinaturas").update({
      status: "ativa", ultimo_pagamento: agora.toISOString(), valido_ate: validoAte.toISOString(),
      atualizado_em: agora.toISOString()
    }).eq("user_id", ass.user_id);
    return res.status(200).json({ ok: true, mensagem: "Assinatura ativada até " + validoAte.toLocaleDateString("pt-BR") });
  }
  if (acao === "cancelar") {
    await admin.from("assinaturas").update({ status: "cancelada", atualizado_em: new Date().toISOString() }).eq("user_id", ass.user_id);
    return res.status(200).json({ ok: true });
  }
  return res.status(400).json({ erro: "ação inválida" });
}
