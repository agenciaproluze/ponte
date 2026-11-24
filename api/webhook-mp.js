// Webhook do Mercado Pago. Ativa a assinatura quando o pagamento é aprovado.
// ATENÇÃO: antes de produção, valide a assinatura x-signature conforme a documentação do Mercado Pago
// e confirme o fluxo de Pix Automático (recorrência) com o provedor.
import { admin } from "./_lib.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).end();
  const id = req.body?.data?.id || req.query?.["data.id"];
  if (!id) return res.status(200).json({ ok: true });

  const r = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` }
  });
  if (!r.ok) return res.status(502).end();
  const pag = await r.json();
  if (pag.status !== "approved") return res.status(200).json({ ok: true });

  const [userId, plano, metodo] = String(pag.external_reference || "").split("|");
  if (!userId || !plano || !metodo) return res.status(200).json({ ok: true });

  await admin.from("assinaturas").upsert({
    user_id: userId, plano, metodo, status: "ativa", ultimo_pagamento: new Date().toISOString(), mp_pagamento_id: String(id)
  });
  return res.status(200).json({ ok: true });
}
