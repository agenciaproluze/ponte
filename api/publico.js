// Páginas públicas do blog (/blog, /blog/:slug), sitemap, feed para o painel e anúncios do Google.
import { admin } from "../lib/_lib.js";

const SITE = () => (process.env.SITE_URL || "https://ponte-git-main-proluze.vercel.app").replace(/\/$/, "");
const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const data = d => d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : "";

// Cookies: aviso simples (LGPD). Anúncios só carregam depois do "Aceitar" (ver public/blog.js).
const BANNER = `<div id="ck" style="position:fixed;bottom:0;left:0;right:0;background:#000;color:#fff;border-top:1px solid #333;padding:14px 18px;font:15px Arial;z-index:99">
Usamos cookies para medir o site e exibir anúncios. <a href="/#planos" style="color:#c6ff00">Saiba mais</a>
<button id="ck-aceitar" style="margin-left:12px;background:#c6ff00;border:0;padding:8px 14px;font-weight:700;border-radius:6px;cursor:pointer">Aceitar</button></div>`;

function anuncio() {
  const c = process.env.ADSENSE_CLIENT, slot = process.env.ADSENSE_SLOT;
  if (!c || !slot) return "";
  return `<div style="margin:30px 0;text-align:center"><ins class="adsbygoogle" style="display:block" data-ad-client="${esc(c)}" data-ad-slot="${esc(slot)}" data-ad-format="auto" data-full-width-responsive="true"></ins></div>`;
}

function pagina({ titulo, descricao, url, imagem, corpo, extraHead = "" }) {
  const c = process.env.ADSENSE_CLIENT;
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)} · tek4ll</title><meta name="description" content="${esc(descricao)}">
<link rel="canonical" href="${esc(url)}"><meta property="og:title" content="${esc(titulo)}"><meta property="og:description" content="${esc(descricao)}"><meta property="og:url" content="${esc(url)}">${imagem ? `<meta property="og:image" content="${esc(imagem)}">` : ""}
${c ? `<meta name="google-adsense-account" content="${esc(c)}">` : ""}${extraHead}
<style>body{margin:0;background:#000;color:#fff;font-family:Arial,Helvetica,sans-serif;font-size:19px;line-height:1.7}a{color:#c6ff00}header{padding:20px 24px;border-bottom:1px solid #222;display:flex;justify-content:space-between}
main{max-width:760px;margin:0 auto;padding:30px 22px 120px}h1{font-size:40px;line-height:1.15;margin:10px 0 16px}p{color:#e5e5e5;margin:0 0 18px}.meta{color:#a8a8a8;font-size:15px}
img{max-width:100%;border-radius:12px;margin:18px 0}.card{border:1px solid #2a2a2a;border-radius:14px;padding:20px;margin-bottom:16px}.card h2{font-size:24px;margin:6px 0}.card p{color:#b5b5b5;font-size:17px}.tag{color:#c6ff00;font-size:13px;font-weight:700;text-transform:uppercase}</style>
</head><body>
<header><a href="/blog" style="color:#fff;font-weight:700;text-decoration:none">tek4ll · Blog</a><a href="/" style="color:#c6ff00">Entrar na plataforma</a></header>
<main>${corpo}</main>${BANNER}<script src="/blog.js" defer></script></body></html>`;
}

export default async function handler(req, res) {
  const q = req.query || {};

  // Sitemap para o Google
  if (q.sitemap) {
    const { data: lista } = await admin.from("posts").select("slug,atualizado_em").eq("status", "publicado").lte("publicado_em", new Date().toISOString());
    const itens = (lista || []).map(p => `<url><loc>${SITE()}/blog/${esc(p.slug)}</loc><lastmod>${new Date(p.atualizado_em).toISOString()}</lastmod></url>`).join("");
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${SITE()}/blog</loc></url>${itens}</urlset>`);
  }

  // Lista de posts publicados (feed para o painel de membros)
  if (q.feed) {
    const { data: lista } = await admin.from("posts").select("id,slug,titulo,resumo,tema,imagem_url,autor_nome,publicado_em")
      .eq("status", "publicado").lte("publicado_em", new Date().toISOString()).order("publicado_em", { ascending: false }).limit(50);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(lista || []);
  }

  // Índice do blog
  if (q.indice) {
    const { data: lista } = await admin.from("posts").select("slug,titulo,resumo,tema,imagem_url,autor_nome,publicado_em")
      .eq("status", "publicado").lte("publicado_em", new Date().toISOString()).order("publicado_em", { ascending: false }).limit(50);
    const cards = (lista || []).map(p => `<a href="/blog/${esc(p.slug)}" style="text-decoration:none;color:inherit"><div class="card">
      <div class="tag">${esc(p.tema || "Notícia")}</div><h2>${esc(p.titulo)}</h2><p>${esc(p.resumo)}</p><div class="meta">${esc(p.autor_nome || "")} · ${data(p.publicado_em)}</div></div></a>`).join("")
      || "<p>Em breve, novas publicações.</p>";
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.status(200).send(pagina({
      titulo: "Blog", descricao: "Notícias e artigos sobre ciência cidadã, saúde, tecnologia e inovação.", url: `${SITE()}/blog`,
      corpo: `<h1>Blog</h1><p>Notícias e artigos sobre ciência cidadã, saúde, tecnologia e inovação.</p>${anuncio()}${cards}`
    }));
  }

  // Post individual
  if (q.slug) {
    const slug = String(q.slug).toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 120);
    const { data: p } = await admin.from("posts").select("*").eq("slug", slug).eq("status", "publicado").lte("publicado_em", new Date().toISOString()).maybeSingle();
    if (!p) return res.status(404).send(pagina({ titulo: "Não encontrado", descricao: "", url: `${SITE()}/blog`, corpo: "<h1>Página não encontrada</h1><p>Veja as <a href='/blog'>publicações</a>.</p>" }));
    const paragrafos = String(p.corpo || "").split(/\n\s*\n/).map(t => t.trim()).filter(Boolean).map(t => `<p>${esc(t).replace(/\n/g, "<br>")}</p>`).join("");
    const url = `${SITE()}/blog/${p.slug}`;
    const jsonld = `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "Article", headline: p.titulo, description: p.resumo, datePublished: p.publicado_em, author: { "@type": "Person", name: p.autor_nome || "tek4ll" }, url })}</script>`;
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.status(200).send(pagina({
      titulo: p.titulo, descricao: p.resumo, url, imagem: p.imagem_url, extraHead: jsonld,
      corpo: `<div class="tag">${esc(p.tema || "")}</div><h1>${esc(p.titulo)}</h1><div class="meta">${esc(p.autor_nome || "")} · ${data(p.publicado_em)}</div>
        ${p.imagem_url ? `<img src="${esc(p.imagem_url)}" alt="${esc(p.titulo)}">` : ""}
        ${paragrafos}${anuncio()}<p><a href="/blog">← Voltar ao blog</a></p>`
    }));
  }

  return res.status(400).send("Requisição inválida");
}
