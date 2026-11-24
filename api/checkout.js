// Pagamento via Pix (manual, por enquanto). A pessoa recebe a chave Pix e a referência.
// A equipe confirma o recebimento no banco e ativa a assinatura pela área de moderação (api/admin-assinatura.js).
import { admin, usuarioDoToken } from "./_lib.js";

const PLANOS = {
  comunidade: { titulo: "Comunidade", preco: 119.9 },
  "ao-vivo": { titulo: "Ao vivo", preco: 189.0 }
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ erro: "método não permitido" });
  const user = await usuarioDoToken(req);
  if (!user) return res.status(401).json({ erro: "entre na sua conta para assinar" });

  const p = PLANOS[(req.body || {}).plano];
  if (!p) return res.status(400).json({ erro: "plano inválido" });
  if (!process.env.PIX_CHAVE) return res.status(503).json({ erro: "pagamento indisponível no momento" });

  // Pix: 15% de desconto
  const valor = Math.round(p.preco * 0.85 * 100) / 100;
  const referencia = `TEK4LL-${user.id.slice(0, 8).toUpperCase()}-${(req.body.plano || "").toUpperCase().replace("-", "")}`;

  const { error } = await admin.from("assinaturas").upsert({
    user_id: user.id, plano: req.body.plano, metodo: "pix", status: "pendente",
    mp_pagamento_id: referencia, atualizado_em: new Date().toISOString()
  });
  if (error) return res.status(500).json({ erro: "não foi possível registrar o pedido" });

  return res.status(200).json({
    plano: p.titulo, valor, chave: process.env.PIX_CHAVE, referencia,
    instrucoes: `Pague ${valor.toFixed(2).replace(".", ",")} reais por Pix para a chave acima. Na descrição do Pix, escreva ${referencia}. Quando recebermos, sua assinatura é ativada.`
  });
}
