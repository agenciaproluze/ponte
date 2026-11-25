// Gera o pedido Pix: valor com 15% de desconto, código copia e cola e QR Code.
// A ativação continua manual (api/admin-assinatura.js) até ligarmos um provedor de cobrança recorrente.
import QRCode from "qrcode";
import crypto from "node:crypto";
import { admin, usuarioDoToken } from "../lib/_lib.js";
import { pixCopiaCola } from "../lib/_pix.js";

const PLANOS = {
  comunidade: { titulo: "Comunidade", preco: 119.9, codigo: "COM" },
  "ao-vivo": { titulo: "Ao vivo", preco: 189.0, codigo: "AOV" }
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ erro: "método não permitido" });
  const user = await usuarioDoToken(req);
  if (!user) return res.status(401).json({ erro: "entre na sua conta para assinar" });

  const plano = (req.body || {}).plano;
  const p = PLANOS[plano];
  if (!p) return res.status(400).json({ erro: "plano inválido" });
  if (!process.env.PIX_CHAVE) return res.status(503).json({ erro: "pagamento indisponível no momento" });

  const valor = Math.round(p.preco * 0.85 * 100) / 100;
  // Identificador curto e alfanumérico (até 25 caracteres), usado na conciliação
  const referencia = "TEK4LL" + crypto.randomBytes(4).toString("hex").toUpperCase() + p.codigo;

  const { error } = await admin.from("assinaturas").upsert({
    user_id: user.id, plano, metodo: "pix", status: "pendente",
    mp_pagamento_id: referencia, atualizado_em: new Date().toISOString()
  });
  if (error) return res.status(500).json({ erro: "não foi possível registrar o pedido" });

  const copiaECola = pixCopiaCola({
    chave: process.env.PIX_CHAVE, valor, txid: referencia,
    nome: process.env.PIX_NOME || "TEK4LL", cidade: process.env.PIX_CIDADE || "RIO DE JANEIRO"
  });
  const qr = await QRCode.toDataURL(copiaECola, { width: 300, margin: 1, color: { dark: "#000000", light: "#ffffff" } });

  return res.status(200).json({ plano: p.titulo, valor, referencia, copiaECola, qr });
}
