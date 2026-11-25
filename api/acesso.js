// Diz ao site se a conta pode ver o conteúdo: assinatura ativa e dentro do prazo, ou moderador.
import { admin, usuarioDoToken, moderadores } from "./_lib.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ erro: "método não permitido" });
  const user = await usuarioDoToken(req);
  if (!user) return res.status(401).json({ erro: "não autenticado" });

  const moderador = moderadores().includes((user.email || "").toLowerCase());
  const { data: ass } = await admin.from("assinaturas").select("status,valido_ate").eq("user_id", user.id).maybeSingle();
  const dentroDoPrazo = ass && ass.status === "ativa" && ass.valido_ate && new Date(ass.valido_ate) > new Date();
  return res.status(200).json({ ativo: !!(moderador || dentroDoPrazo), moderador, valido_ate: ass?.valido_ate || null });
}
