// Direito de arrependimento (CDC, art. 49): até 7 dias após o pagamento, com reembolso integral via Pix.
import { admin, usuarioDoToken } from "../lib/_lib.js";

const PRAZO_DIAS = 7;
const PIX_RE = /^[^\s]{5,100}$/;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ erro: "método não permitido" });
  const user = await usuarioDoToken(req);
  if (!user) return res.status(401).json({ erro: "entre na sua conta" });

  const { data: ass } = await admin.from("assinaturas")
    .select("status,ultimo_pagamento").eq("user_id", user.id).maybeSingle();
  if (!ass || ass.status !== "ativa") return res.status(404).json({ erro: "não encontramos uma assinatura ativa" });

  const limite = new Date(new Date(ass.ultimo_pagamento).getTime() + PRAZO_DIAS * 24 * 60 * 60 * 1000);
  if (new Date() > limite) return res.status(409).json({ erro: "o prazo de 7 dias para desistir encerrou. Você pode cancelar a renovação." });

  const chavePix = String((req.body || {}).chave_pix || "").trim();
  if (!PIX_RE.test(chavePix)) return res.status(400).json({ erro: "informe a chave Pix para receber o reembolso" });

  await admin.from("assinaturas").update({
    status: "cancelada", reembolso_pix: chavePix, atualizado_em: new Date().toISOString()
  }).eq("user_id", user.id);
  return res.status(200).json({ ok: true, mensagem: "Desistência registrada. O reembolso integral será enviado para a chave Pix informada, pela equipe, dentro do prazo legal." });
}
