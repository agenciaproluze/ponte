// Funções compartilhadas pelas rotas da tek4ll. Arquivos com "_" no início não viram rotas públicas.
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

export const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

export function escapar(t) {
  return String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export async function usuarioDoToken(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data: { user }, error } = await admin.auth.getUser(token);
  return error || !user ? null : user;
}

export function idadeDe(perfil) {
  if (!perfil || !perfil.nascimento) return null;
  const n = new Date(perfil.nascimento + "T00:00:00Z");
  const h = new Date();
  let a = h.getUTCFullYear() - n.getUTCFullYear();
  const m = h.getUTCMonth() - n.getUTCMonth();
  if (m < 0 || (m === 0 && h.getUTCDate() < n.getUTCDate())) a--;
  return a;
}

export function hashToken(t) {
  return crypto.createHash("sha256").update(t).digest("hex");
}

export async function enviarEmail(para, assunto, html) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return false;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [para], subject: assunto, html })
  });
  return r.ok;
}

export function moderadores() {
  return (process.env.MODERADORES || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
}

/* ---------- detecção de risco (primeira linha de defesa; não substitui revisão humana) ---------- */
const REGRAS = [
  { gravidade: "critica", tipo: "exploracao_sexual",
    re: /(manda(r)? (uma )?foto|foto (nua|pelada)|nudes?|pelad[oa]|n[aã]o conta (pra|para) ningu[eé]m|segredo nosso|encontrar (sozinh[oa]|escondid[oa])|me mostra (o|seu) corpo|tira a roupa)/i },
  { gravidade: "alta", tipo: "autolesao",
    re: /(me matar|suic[ií]dio|suicidar|n[aã]o quero (mais )?viver|me cortar|automutila|me machucar)/i },
  { gravidade: "media", tipo: "violencia",
    re: /(vou te matar|quero (te )?bater|vou bater|tenho uma arma|arma de fogo)/i },
  { gravidade: "baixa", tipo: "palavreado",
    re: /(ofensa|idiota|imbecil)/i }
];

export function avaliarRisco(texto) {
  for (const r of REGRAS) if (r.re.test(texto)) return { gravidade: r.gravidade, tipo: r.tipo };
  return null;
}

export const RESPOSTA_CRISE = `Sinto muito que você esteja passando por isso. Você não precisa lidar com isso sozinho(a).
Fale agora com um adulto de confiança (pai, mãe, responsável, professor ou alguém da família).
Se você estiver em perigo ou sentindo que pode se machucar, ligue 190 (Polícia Militar) ou 192 (SAMU).
Para conversar com alguém agora, ligue 188 (CVV, gratuito, 24h). Denúncias de violações de direitos: Disque 100.`;

export const RESPOSTA_SEGURANCA = `Não posso continuar essa conversa sobre esse assunto. Se alguém está pedindo fotos, segredos ou encontros, conte imediatamente para um adulto de confiança. Você não tem culpa. Denúncias: Disque 100 ou 190 em caso de perigo imediato.`;
