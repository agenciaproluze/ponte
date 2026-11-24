// Função serverless da tek4ll: grava o perfil, o consentimento do responsável (se menor)
// e envia os e-mails. Toda validação é refeita aqui no servidor; nada vem confiado do navegador.
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,}$/;
const PARENTESCOS = ["Mãe", "Pai", "Outro responsável legal"];
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

function escapar(t) {
  return String(t || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function limpa(s, max) {
  return String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
}
function soDigitos(s) {
  return String(s ?? "").replace(/\D/g, "");
}
function cpfValido(c) {
  c = soDigitos(c);
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += Number(c[i]) * (10 - i);
  let d = (s * 10) % 11 % 10;
  if (d !== Number(c[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += Number(c[i]) * (11 - i);
  d = (s * 10) % 11 % 10;
  return d === Number(c[10]);
}
// Idade calculada no servidor, a partir da data informada
function idadeEm(dataISO) {
  if (!DATA_RE.test(dataISO)) return null;
  const n = new Date(dataISO + "T00:00:00Z");
  if (isNaN(n) || n > new Date()) return null;
  const h = new Date();
  let a = h.getUTCFullYear() - n.getUTCFullYear();
  const m = h.getUTCMonth() - n.getUTCMonth();
  if (m < 0 || (m === 0 && h.getUTCDate() < n.getUTCDate())) a--;
  return a;
}
async function enviarEmail(para, assunto, html) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [para], subject: assunto, html })
  });
}
function boasVindasHtml(nome) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#111">
      <h2>Bem-vindo à tek4ll, ${escapar(nome)}!</h2>
      <p><b>Nosso propósito:</b> conectar pessoas com altas habilidades a projetos reais de ciência cidadã.</p>
      <p><b>Nossos valores:</b> curiosidade, colaboração, rigor e respeito a quem participa.</p>
      <p>Seu primeiro guia já está disponível: <a href="https://claude.ai/artifact/2xrXRyuLXVEyR7LmzLTzJt">Primeiros passos com o Claude</a>.</p>
      <p>Entre na plataforma para ver cursos, projetos e pesquisas.</p>
    </div>`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ erro: "método não permitido" });

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ erro: "não autenticado" });
  const { data: { user }, error: eAuth } = await admin.auth.getUser(token);
  if (eAuth || !user) return res.status(401).json({ erro: "não autenticado" });

  const b = req.body && typeof req.body === "object" ? req.body : {};

  const nome = limpa(b.nome, 120);
  if (nome.length < 2) return res.status(400).json({ erro: "nome inválido" });

  const nascimento = limpa(b.nascimento, 10);
  const idade = idadeEm(nascimento);
  if (idade === null || idade > 120) return res.status(400).json({ erro: "data de nascimento inválida" });

  // A condição de menor é decidida pela data, não pelo que o navegador envia
  const menor = idade < 18;

  let consentimento = null;
  if (menor) {
    const responsavel = limpa(b.responsavel, 120);
    const parentesco = limpa(b.parentesco, 60);
    const emailResp = limpa(b.emailResponsavel, 254);
    const assinatura = limpa(b.assinatura, 120);
    const cpf = soDigitos(b.cpf);
    if (responsavel.length < 3) return res.status(400).json({ erro: "nome do responsável inválido" });
    if (!PARENTESCOS.includes(parentesco)) return res.status(400).json({ erro: "parentesco inválido" });
    if (!EMAIL_RE.test(emailResp)) return res.status(400).json({ erro: "e-mail do responsável inválido" });
    if (!cpfValido(cpf)) return res.status(400).json({ erro: "CPF do responsável inválido" });
    if (assinatura.toLowerCase() !== responsavel.toLowerCase()) return res.status(400).json({ erro: "assinatura não confere" });
    if (b.autorizado !== true) return res.status(400).json({ erro: "autorização do responsável ausente" });
    consentimento = { responsavel, parentesco, emailResp, assinatura, cpf };
  }

  const { error: eP } = await admin.from("perfis").upsert({
    id: user.id, nome, nome_publico: nome, nascimento, menor
  });
  if (eP) return res.status(500).json({ erro: "falha ao salvar perfil" });

  if (consentimento) {
    // Evita duplicar o consentimento se a chamada for repetida
    const { data: existe } = await admin.from("consentimentos_responsavel")
      .select("id").eq("user_id", user.id).maybeSingle();
    if (!existe) {
      // CPF nunca é salvo em texto: só um HMAC com segredo do servidor
      const cpfHash = crypto.createHmac("sha256", process.env.CPF_PEPPER || "").update(consentimento.cpf).digest("hex");
      const ip = String((req.headers["x-forwarded-for"] || "").split(",")[0]).trim().slice(0, 64);
      const { error: eC } = await admin.from("consentimentos_responsavel").insert({
        user_id: user.id,
        nome_responsavel: consentimento.responsavel,
        parentesco: consentimento.parentesco,
        email_responsavel: consentimento.emailResp,
        cpf_hash: cpfHash,
        assinatura_nome: consentimento.assinatura,
        ip
      });
      if (eC) return res.status(500).json({ erro: "falha ao registrar consentimento" });
      // Aprovação parental para conversar com a IA: link único, guardado só como hash
      const tokenAprov = crypto.randomBytes(32).toString("hex");
      await admin.from("aprovacoes_responsavel").upsert({
        user_id: user.id,
        email_responsavel: consentimento.emailResp,
        token_hash: crypto.createHash("sha256").update(tokenAprov).digest("hex"),
        criado_em: new Date().toISOString(),
        aprovado_em: null,
        revogado_em: null
      });
      const link = `${process.env.SITE_URL}/api/aprovar?t=${tokenAprov}`;
      await enviarEmail(consentimento.emailResp, "Autorização registrada: tek4ll",
        `<p>Você autorizou a participação de ${escapar(nome)} na tek4ll.</p>
         <p>Para liberar a conversa com a assistente de IA, aprove neste link: <a href="${link}">${link}</a></p>
         <p>Guarde este e-mail como registro.</p>`);
    }
  }

  await enviarEmail(user.email, "Bem-vindo à tek4ll", boasVindasHtml(nome));
  return res.status(200).json({ ok: true });
}
