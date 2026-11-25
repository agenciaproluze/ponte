// Ficha de interesse de profissionais que querem lecionar ou publicar cursos.
import { admin, usuarioDoToken, enviarEmail, escapar } from "../lib/_lib.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ erro: "método não permitido" });
  const user = await usuarioDoToken(req);
  if (!user) return res.status(401).json({ erro: "entre na sua conta para enviar a ficha" });

  const b = req.body || {};
  const campo = (k, max) => String(b[k] ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
  const ficha = {
    user_id: user.id,
    nome: campo("nome", 120),
    email: campo("email", 254),
    area: campo("area", 120),
    formacao: campo("formacao", 300),
    interesse: campo("interesse", 20),
    portfolio: campo("portfolio", 300),
    mensagem: campo("mensagem", 1000)
  };
  if (ficha.nome.length < 3) return res.status(400).json({ erro: "informe seu nome completo" });
  if (!/^\S+@\S+\.\S+$/.test(ficha.email)) return res.status(400).json({ erro: "e-mail inválido" });
  if (ficha.area.length < 2) return res.status(400).json({ erro: "informe sua área" });
  if (!["professor", "publicar_curso", "ambos"].includes(ficha.interesse)) return res.status(400).json({ erro: "escolha o tipo de participação" });

  const { error } = await admin.from("fichas_profissionais").insert(ficha);
  if (error) return res.status(500).json({ erro: "não foi possível enviar a ficha" });

  if (process.env.SUPORTE_EMAIL) {
    await enviarEmail(process.env.SUPORTE_EMAIL, "Nova ficha de profissional: " + escapar(ficha.nome),
      `<p><b>${escapar(ficha.nome)}</b> (${escapar(ficha.email)}) · ${escapar(ficha.area)} · ${escapar(ficha.interesse)}</p>
       <p>Formação: ${escapar(ficha.formacao)}</p><p>Portfólio: ${escapar(ficha.portfolio)}</p><p>${escapar(ficha.mensagem)}</p>`);
  }
  return res.status(200).json({ ok: true });
}
