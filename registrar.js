// Vercel Serverless Function: grava o perfil, o consentimento do responsável (se menor)
// e envia o e-mail de boas-vindas. Usa a chave service_role somente no servidor.
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const GUIA_URL = process.env.SITE_URL ? `${process.env.SITE_URL}/#biblioteca` : "#";

function boasVindasHtml(nome) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#111">
      <h2>Bem-vindo à Ponte, ${escapar(nome)}!</h2>
      <p><b>Nosso propósito:</b> conectar pessoas com altas habilidades a projetos reais de ciência cidadã.</p>
      <p><b>Nossos valores:</b> curiosidade, colaboração, rigor e respeito a quem participa.</p>
      <p>Seu primeiro guia já está disponível: <a href="https://claude.ai/artifact/2xrXRyuLXVEyR7LmzLTzJt">Primeiros passos com o Claude</a>.</p>
      <p>Entre na plataforma para ver cursos, projetos e pesquisas.</p>
    </div>`;
}

function escapar(t) {
  return String(t || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function enviarEmail(para, assunto, html) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [para], subject: assunto, html })
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ erro: "método não permitido" });

  const token = (req.headers.authorization || "").replace("Bearer ", "");
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ erro: "não autenticado" });

  const b = req.body || {};
  const nome = String(b.nome || "").slice(0, 120);

  const { error: eP } = await admin.from("perfis").upsert({
    id: user.id, nome, nome_publico: nome, nascimento: b.nascimento || null, menor: !!b.menor
  });
  if (eP) return res.status(500).json({ erro: "falha ao salvar perfil" });

  if (b.menor) {
    if (!b.responsavel || !b.cpf || !b.emailResponsavel || !b.assinatura) {
      return res.status(400).json({ erro: "dados do responsável incompletos" });
    }
    // CPF nunca é salvo em texto: guardamos apenas um hash com segredo do servidor
    const cpfLimpo = String(b.cpf).replace(/\D/g, "");
    const cpfHash = crypto.createHmac("sha256", process.env.CPF_PEPPER || "").update(cpfLimpo).digest("hex");
    const { error: eC } = await admin.from("consentimentos_responsavel").insert({
      user_id: user.id,
      nome_responsavel: String(b.responsavel).slice(0, 120),
      parentesco: String(b.parentesco || "").slice(0, 60),
      email_responsavel: String(b.emailResponsavel).slice(0, 254),
      cpf_hash: cpfHash,
      assinatura_nome: String(b.assinatura).slice(0, 120),
      ip: String((req.headers["x-forwarded-for"] || "").split(",")[0]).slice(0, 64)
    });
    if (eC) return res.status(500).json({ erro: "falha ao registrar consentimento" });

    await enviarEmail(b.emailResponsavel,
      "Autorização registrada: Ponte",
      `<p>Você autorizou a participação de ${escapar(nome)} na Ponte. Guarde este e-mail como registro.</p>`);
  }

  await enviarEmail(user.email, "Bem-vindo à Ponte", boasVindasHtml(nome));
  return res.status(200).json({ ok: true });
}
