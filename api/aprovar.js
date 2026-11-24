// Link enviado ao responsável. Ao clicar, a conversa com a IA é liberada para o menor.
import { admin, hashToken } from "./_lib.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  const token = String(req.query?.t || "").slice(0, 200);
  if (!/^[a-f0-9]{64}$/.test(token)) return res.status(400).send(pagina("Link inválido."));

  const { data: ap } = await admin.from("aprovacoes_responsavel")
    .select("user_id,token_hash,aprovado_em,revogado_em").eq("token_hash", hashToken(token)).maybeSingle();
  if (!ap) return res.status(404).send(pagina("Link inválido ou já utilizado."));

  if (req.method === "POST" && req.body?.acao === "revogar") {
    await admin.from("aprovacoes_responsavel").update({ revogado_em: new Date().toISOString() }).eq("user_id", ap.user_id);
    return res.status(200).send(pagina("Acesso revogado. A conversa com a IA foi bloqueada para esta conta."));
  }
  if (req.method === "POST") {
    await admin.from("aprovacoes_responsavel").update({ aprovado_em: new Date().toISOString(), revogado_em: null }).eq("user_id", ap.user_id);
    return res.status(200).send(pagina("Acesso aprovado. A pessoa já pode conversar com a assistente da tek4ll."));
  }

  // GET: mostra o que está sendo aprovado, com confirmação explícita
  return res.status(200).send(`<!DOCTYPE html><html lang="pt-BR"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Aprovar acesso · tek4ll</title>
<body style="font-family:Arial,sans-serif;max-width:560px;margin:40px auto;padding:0 20px;color:#111">
<h2>Aprovar acesso à assistente de IA</h2>
<p>Ao aprovar, a pessoa menor de idade poderá conversar com a assistente de IA da tek4ll. Você pode revogar este acesso a qualquer momento usando o mesmo link.</p>
<ul><li>As conversas podem ser revisadas por moderadores em caso de sinal de risco.</li>
<li>Você recebe um relatório simples sobre as atividades.</li></ul>
<form method="POST"><button name="acao" value="aprovar" style="background:#c6ff00;border:0;padding:14px 22px;font-weight:bold;border-radius:8px;cursor:pointer">Aprovar acesso</button>
<button name="acao" value="revogar" style="background:#eee;border:0;padding:14px 22px;border-radius:8px;cursor:pointer">Não aprovar / revogar</button></form>
</body></html>`);
}

function pagina(msg) {
  return `<!DOCTYPE html><html lang="pt-BR"><meta charset="UTF-8"><body style="font-family:Arial,sans-serif;max-width:560px;margin:40px auto;padding:0 20px"><h2>tek4ll</h2><p>${msg}</p></body></html>`;
}
