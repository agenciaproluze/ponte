// Cria o checkout no Mercado Pago. O valor do Pix Automático (15% off) é calculado aqui, no servidor.
// A ativação da assinatura acontece no webhook (api/webhook-mp.js), que ainda deve ser conferido com a documentação do Mercado Pago.
import { usuarioDoToken } from "./_lib.js";

const PLANOS = {
  comunidade: { titulo: "tek4ll · Comunidade", preco: 119.9 },
  "ao-vivo": { titulo: "tek4ll · Ao vivo", preco: 189.0 }
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ erro: "método não permitido" });
  const user = await usuarioDoToken(req);
  if (!user) return res.status(401).json({ erro: "entre na sua conta para assinar" });

  const { plano, metodo } = req.body || {};
  const p = PLANOS[plano];
  if (!p) return res.status(400).json({ erro: "plano inválido" });
  if (!["pix", "cartao"].includes(metodo)) return res.status(400).json({ erro: "forma de pagamento inválida" });

  const valor = Math.round((metodo === "pix" ? p.preco * 0.85 : p.preco) * 100) / 100;

  const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [{ title: p.titulo, quantity: 1, currency_id: "BRL", unit_price: valor }],
      payer: { email: user.email },
      external_reference: `${user.id}|${plano}|${metodo}`,
      notification_url: `${process.env.SITE_URL}/api/webhook-mp`,
      back_urls: { success: `${process.env.SITE_URL}/#meu-perfil`, failure: `${process.env.SITE_URL}/#planos`, pending: `${process.env.SITE_URL}/#planos` },
      auto_return: "approved",
      payment_methods: metodo === "pix" ? { excluded_payment_types: [{ id: "credit_card" }] } : { excluded_payment_types: [{ id: "bank_transfer" }] }
    })
  });
  if (!r.ok) return res.status(502).json({ erro: "não foi possível iniciar o pagamento" });
  const dados = await r.json();
  return res.status(200).json({ url: dados.init_point, valor });
}
