// Avatar e nome da IA escolhidos pela pessoa. Valores fora da lista são recusados.
import { admin, usuarioDoToken } from "../lib/_lib.js";

const OPC = {
  genero: ["menina", "menino", "neutro"],
  cabelo: ["curto", "medio", "longo", "cacheado", "liso"],
  roupa: ["camiseta", "moletom", "jaqueta", "jaleco"]
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const user = await usuarioDoToken(req);
  if (!user) return res.status(401).json({ erro: "não autenticado" });

  if (req.method === "GET") {
    const { data } = await admin.from("avatares").select("nome_ia,genero,cabelo,roupa,cor").eq("user_id", user.id).maybeSingle();
    return res.status(200).json(data || null);
  }
  if (req.method !== "POST") return res.status(405).json({ erro: "método não permitido" });

  const b = req.body || {};
  const nomeIa = String(b.nome_ia ?? "").replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, 30);
  if (nomeIa.length < 2) return res.status(400).json({ erro: "dê um nome para a sua assistente (2 a 30 letras)" });
  for (const k of Object.keys(OPC)) if (!OPC[k].includes(b[k])) return res.status(400).json({ erro: `opção inválida: ${k}` });
  if (!/^#[0-9a-fA-F]{6}$/.test(String(b.cor || ""))) return res.status(400).json({ erro: "cor inválida" });

  const { error } = await admin.from("avatares").upsert({
    user_id: user.id, nome_ia: nomeIa, genero: b.genero, cabelo: b.cabelo, roupa: b.roupa, cor: b.cor,
    atualizado_em: new Date().toISOString()
  });
  if (error) return res.status(500).json({ erro: "não foi possível salvar" });
  return res.status(200).json({ ok: true });
}
