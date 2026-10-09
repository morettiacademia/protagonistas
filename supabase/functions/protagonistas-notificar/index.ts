// Edge Function: envia por e-mail cada nova candidatura do Programa Protagonistas.
//
// Disparada por um Database Webhook (INSERT em public.protagonistas_candidaturas),
// que precisa mandar o cabeçalho  x-webhook-secret: <WEBHOOK_SECRET>.
// Desative "Enforce JWT verification" nesta função: quem a protege é esse segredo.
//
// Segredos (Edge Functions › Secrets):
//   RESEND_API_KEY   chave do Resend (https://resend.com)
//   WEBHOOK_SECRET   texto aleatório, o mesmo configurado no webhook
//   NOTIFY_FROM      remetente verificado no Resend, ex.: "Programa Protagonistas <protagonistas@academiadamagia.com.br>"
//   NOTIFY_TO        destino (padrão: diretoria@academiadamagia.com.br)
//   PANEL_URL        (opcional) endereço do painel, para o link no e-mail

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Resposta = { campo: string; label: string; valor: string };
type Candidatura = {
  id: string;
  created_at: string;
  oportunidade: string;
  oportunidade_titulo: string;
  nome: string;
  email: string;
  respostas: Resposta[];
};

function renderEmail(c: Candidatura, panelUrl: string) {
  const titulo = c.oportunidade_titulo || c.oportunidade;
  const rows = (c.respostas ?? [])
    .map(
      (r) =>
        `<tr><td style="padding:10px 14px;border-bottom:1px solid #e3e7ef;vertical-align:top;width:34%;color:#46516b;font-weight:600">${esc(r.label)}</td>` +
        `<td style="padding:10px 14px;border-bottom:1px solid #e3e7ef;white-space:pre-wrap;color:#141c33">${r.valor ? esc(r.valor) : '<span style="color:#9aa3b5">—</span>'}</td></tr>`,
    )
    .join("");
  const quando = new Date(c.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:720px;margin:0 auto;color:#141c33">' +
    '<div style="background:#0B3A78;color:#fff;padding:22px 26px;border-radius:14px 14px 0 0">' +
    '<div style="font-size:12px;letter-spacing:.14em;color:#9FD6F2;font-weight:700">NOVA CANDIDATURA · PROGRAMA PROTAGONISTAS</div>' +
    `<div style="font-size:22px;font-weight:800;margin-top:8px">${esc(titulo)}</div>` +
    `<div style="font-size:15px;margin-top:6px;color:#E8B85A;font-weight:700">${esc(c.nome)}</div></div>` +
    `<table style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.5;border:1px solid #e3e7ef;border-top:0">${rows}</table>` +
    `<p style="font-size:13px;color:#46516b;margin:18px 0 0">Recebida em ${esc(quando)} · código ${esc(c.id.slice(0, 8))}</p>` +
    (panelUrl
      ? `<p style="font-size:13px;margin:10px 0 0"><a href="${esc(panelUrl)}" style="color:#3450B0;font-weight:700">Abrir o painel de candidaturas</a></p>`
      : "") +
    "</div>";

  const text =
    `Nova candidatura — ${titulo}\n\n` +
    (c.respostas ?? []).map((r) => `${r.label}:\n${r.valor || "—"}`).join("\n\n");

  return { subject: `Nova candidatura: ${titulo} — ${c.nome}`, html, text };
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("WEBHOOK_SECRET");
  if (!secret || req.headers.get("x-webhook-secret") !== secret) {
    return new Response("unauthorized", { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  if (payload?.type !== "INSERT" || payload?.table !== "protagonistas_candidaturas" || !payload.record) {
    return new Response("ignored", { status: 200 });
  }

  const c = payload.record as Candidatura;
  const { subject, html, text } = renderEmail(c, Deno.env.get("PANEL_URL") ?? "");
  const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: Deno.env.get("NOTIFY_FROM"),
      to: [Deno.env.get("NOTIFY_TO") || "diretoria@academiadamagia.com.br"],
      ...(validEmail ? { reply_to: c.email } : {}),
      subject,
      html,
      text,
    }),
  });

  if (!res.ok) {
    console.error("Resend", res.status, await res.text());
    return new Response("email failed", { status: 502 });
  }
  return new Response("sent", { status: 200 });
});
