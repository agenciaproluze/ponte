// Direito de arrependimento (CDC, art. 49): até 7 dias após a contratação online, com reembolso integral.
import { admin, usuarioDoToken } from "./_lib.js";

const PRAZO_DIAS = 7;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ erro: "método não permitido" });
  const user = await usuarioDoToken(req);
  if (!user) return res.status(401).json({ erro: "entre na sua conta" });

  const { data: ass } = await admin.from("assinaturas")
    .select("plano,metodo,status,ultimo_pagamento,mp_pagamento_id").eq("user_id", user.id).maybeSingle();
  if (!ass || ass.status !== "ativa") return res.status(404).json({ erro: "não encontramos uma assinatura ativa" });

  const inicio = new Date(ass.ultimo_pagamento);
  const limite = new Date(inicio.getTime() + PRAZO_DIAS * 24 * 60 * 60 * 1000);
  if (new Date() > limite) {
    return res.status(409).json({ erro: "o prazo de 7 dias para desistir encerrou. Você ainda pode cancelar a renovação." });
  }

  // Reembolso integral no Mercado Pago
  const r = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(ass.mp_pagamento_id)}/refunds`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`, "Content-Type": "application/json", "X-Idempotency-Key": `arrep-${user.id}-${ass.mp_pagamento_id}` },
    body: JSON.stringify({})
  });
  if (!r.ok) return res.status(502).json({ erro: "não foi possível processar o reembolso agora. Tente de novo ou fale com o suporte." });

  await admin.from("assinaturas").update({ status: "cancelada", atualizado_em: new Date().toISOString() }).eq("user_id", user.id);
  return res.status(200).json({ ok: true, mensagem: "Desistência registrada. O reembolso integral foi solicitado ao Mercado Pago." });
}
