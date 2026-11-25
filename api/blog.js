// Área de autores do blog: colunistas escrevem, editores aprovam e agendam, admin convida.
import crypto from "node:crypto";
import { admin, usuarioDoToken, moderadores } from "../lib/_lib.js";

const TIPOS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_IMG = 2 * 1024 * 1024;
const PAPEIS = ["colunista", "editor", "admin"];

function limpa(s, max) { return String(s ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max); }
function slugDe(t) {
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) + "-" + crypto.randomBytes(3).toString("hex");
}

// Papel de quem chama: admin (lista MODERADORES), editor/colunista (tabela autores) ou nenhum
async function papelDe(user) {
  if (moderadores().includes((user.email || "").toLowerCase())) return { papel: "admin", nome: user.email };
  const { data } = await admin.from("autores").select("papel,nome_publico").eq("user_id", user.id).maybeSingle();
  return data ? { papel: data.papel, nome: data.nome_publico } : null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const user = await usuarioDoToken(req);
  if (!user) return res.status(401).json({ erro: "não autenticado" });
  const eu = await papelDe(user);
  if (!eu) return res.status(403).json({ erro: "esta conta não é de autor do blog" });
  const ehEditor = eu.papel === "editor" || eu.papel === "admin";

  if (req.method === "GET") {
    if (req.query?.papel) return res.status(200).json({ papel: eu.papel, nome: eu.nome });
    if (req.query?.fila) {
      if (!ehEditor) return res.status(403).json({ erro: "somente editores" });
      const { data } = await admin.from("posts").select("id,titulo,resumo,corpo,tema,imagem_url,autor_nome,status,atualizado_em").eq("status", "revisao").order("atualizado_em");
      return res.status(200).json(data || []);
    }
    const { data } = await admin.from("posts").select("id,titulo,resumo,corpo,tema,imagem_url,status,publicado_em,atualizado_em")
      .eq("autor_id", user.id).order("atualizado_em", { ascending: false }).limit(100);
    return res.status(200).json(data || []);
  }
  if (req.method !== "POST") return res.status(405).json({ erro: "método não permitido" });

  const b = req.body || {};

  if (b.acao === "imagem") {
    const ext = TIPOS[b.tipo];
    if (!ext) return res.status(400).json({ erro: "use imagem JPG, PNG ou WebP" });
    const buf = Buffer.from(String(b.dados || ""), "base64");
    if (buf.length === 0 || buf.length > MAX_IMG) return res.status(400).json({ erro: "a imagem deve ter até 2 MB" });
    const nome = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
    const { error } = await admin.storage.from("blog").upload(nome, buf, { contentType: b.tipo, upsert: false });
    if (error) return res.status(500).json({ erro: "falha ao enviar a imagem" });
    const { data } = admin.storage.from("blog").getPublicUrl(nome);
    return res.status(200).json({ url: data.publicUrl });
  }

  if (b.acao === "salvar") {
    const titulo = limpa(b.titulo, 140), resumo = limpa(b.resumo, 300), corpo = limpa(b.corpo, 20000);
    const tema = limpa(b.tema, 40), imagem = limpa(b.imagem_url, 500);
    if (titulo.length < 5) return res.status(400).json({ erro: "dê um título com pelo menos 5 letras" });
    if (corpo.length < 50) return res.status(400).json({ erro: "o texto precisa ter pelo menos 50 caracteres" });
    if (imagem && !/^https:\/\/[^\s]+$/.test(imagem)) return res.status(400).json({ erro: "imagem inválida" });
    if (b.id) {
      const { data: atual } = await admin.from("posts").select("id,autor_id,status").eq("id", Number(b.id)).maybeSingle();
      if (!atual || (atual.autor_id !== user.id && !ehEditor)) return res.status(404).json({ erro: "post não encontrado" });
      await admin.from("posts").update({ titulo, resumo, corpo, tema, imagem_url: imagem || null, atualizado_em: new Date().toISOString() }).eq("id", atual.id);
      return res.status(200).json({ ok: true, id: atual.id });
    }
    const { data, error } = await admin.from("posts").insert({
      slug: slugDe(titulo), titulo, resumo, corpo, tema, imagem_url: imagem || null,
      autor_id: user.id, autor_nome: eu.nome, status: "rascunho"
    }).select("id").single();
    if (error) return res.status(500).json({ erro: "não foi possível salvar" });
    return res.status(200).json({ ok: true, id: data.id });
  }

  const id = Number(b.id);
  if (!Number.isInteger(id)) return res.status(400).json({ erro: "post inválido" });
  const { data: post } = await admin.from("posts").select("id,autor_id,status,slug").eq("id", id).maybeSingle();
  if (!post) return res.status(404).json({ erro: "post não encontrado" });
  const meu = post.autor_id === user.id;

  if (b.acao === "enviar") {
    if (!meu || post.status !== "rascunho") return res.status(403).json({ erro: "só o autor envia um rascunho para revisão" });
    await admin.from("posts").update({ status: "revisao", atualizado_em: new Date().toISOString() }).eq("id", id);
    return res.status(200).json({ ok: true });
  }
  if (b.acao === "aprovar") {
    if (!ehEditor) return res.status(403).json({ erro: "somente editores aprovam" });
    if (post.status !== "revisao") return res.status(400).json({ erro: "o post não está em revisão" });
    // Sem data: publica agora. Com data: agenda (fica invisível até a data chegar).
    const quando = b.publicar_em ? new Date(b.publicar_em) : new Date();
    if (isNaN(quando)) return res.status(400).json({ erro: "data de publicação inválida" });
    await admin.from("posts").update({ status: "publicado", publicado_em: quando.toISOString(), atualizado_em: new Date().toISOString() }).eq("id", id);
    return res.status(200).json({ ok: true, publicado_em: quando.toISOString() });
  }
  if (b.acao === "devolver") {
    if (!ehEditor) return res.status(403).json({ erro: "somente editores devolvem" });
    await admin.from("posts").update({ status: "rascunho", atualizado_em: new Date().toISOString() }).eq("id", id);
    return res.status(200).json({ ok: true });
  }
  if (b.acao === "excluir") {
    if (!(ehEditor || (meu && post.status === "rascunho"))) return res.status(403).json({ erro: "não é possível excluir este post" });
    await admin.from("posts").delete().eq("id", id);
    return res.status(200).json({ ok: true });
  }
  if (b.acao === "convidar") {
    if (eu.papel !== "admin") return res.status(403).json({ erro: "somente o administrador convida autores" });
    const email = limpa(b.email, 254).toLowerCase(), papel = b.papel;
    if (!PAPEIS.includes(papel) || papel === "admin") return res.status(400).json({ erro: "papel inválido" });
    const { data: lista } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const alvo = (lista?.users || []).find(u => (u.email || "").toLowerCase() === email);
    if (!alvo) return res.status(404).json({ erro: "essa pessoa precisa criar uma conta na plataforma primeiro" });
    await admin.from("autores").upsert({ user_id: alvo.id, nome_publico: limpa(b.nome_publico, 80) || email, papel, bio: limpa(b.bio, 400) });
    return res.status(200).json({ ok: true });
  }
  return res.status(400).json({ erro: "ação desconhecida" });
}
