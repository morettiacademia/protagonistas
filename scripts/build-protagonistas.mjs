#!/usr/bin/env node
// Gera as páginas estáticas do Programa Protagonistas a partir de content/protagonistas.json.
// Sem dependências: `node scripts/build-protagonistas.mjs`.
//
// Saída (em protagonistas/):
//   index.html                          /protagonistas
//   oportunidades/index.html            /protagonistas/oportunidades
//   oportunidades/<slug>/index.html     /protagonistas/oportunidades/<slug>
//   historias/index.html                /protagonistas/historias
//   <slug-do-protagonista>/index.html   /protagonistas/<slug>
//   sitemap.xml

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'protagonistas');
const data = JSON.parse(readFileSync(join(ROOT, 'content/protagonistas.json'), 'utf8'));
const { site, images, status: STATUS, oportunidades: OPPS, protagonistas: PEOPLE } = data;

const RESERVED = new Set(['oportunidades', 'historias', 'assets', 'sitemap.xml']);

// ---------- validação ----------
const errors = [];
const oppBySlug = new Map(OPPS.map((o) => [o.slug, o]));
const personBySlug = new Map(PEOPLE.map((p) => [p.slug, p]));
for (const p of PEOPLE) {
  if (RESERVED.has(p.slug)) errors.push(`Protagonista usa slug reservado: ${p.slug}`);
  if (p.opp && !oppBySlug.has(p.opp)) errors.push(`${p.slug}.opp aponta para oportunidade inexistente: ${p.opp}`);
}
for (const o of OPPS) {
  if (!STATUS[o.status]) errors.push(`${o.slug}: status desconhecido "${o.status}"`);
  if (o.selected && !personBySlug.has(o.selected)) errors.push(`${o.slug}.selected aponta para Protagonista inexistente: ${o.selected}`);
}
if (oppBySlug.size !== OPPS.length || personBySlug.size !== PEOPLE.length) errors.push('Slugs duplicados no conteúdo.');
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pad = (i) => String(i + 1).padStart(2, '0');
const abs = (path) => `${site.url}${site.basePath}/${path}`;
const cleanDesc = (s) => String(s).replace(/^(foto\/vídeo( real| hero)?|foto real|foto|vídeo|reels):\s*/i, '');
const t = (strings, ...vals) => strings.reduce((acc, s, i) => acc + s + (i < vals.length ? (Array.isArray(vals[i]) ? vals[i].join('') : vals[i] ?? '') : ''), '');

function decorateOpp(o) {
  const sel = o.selected && personBySlug.get(o.selected);
  return {
    ...o,
    st: STATUS[o.status],
    catLine: o.cats.join(' · '),
    prazoLabel: o.status === 'aberta' ? `Candidaturas ${o.prazo}` : o.prazo,
    isOpen: o.status === 'aberta',
    isSoon: o.status === 'breve',
    isRunning: o.status === 'andamento',
    isClosed: o.status === 'encerrada',
    selectedName: sel ? sel.name : '',
  };
}
const opps = OPPS.map(decorateOpp);
const liveOpps = opps.filter((o) => !o.isClosed);
const closedOpps = opps.filter((o) => o.isClosed);

// Uma entrada de `images` pode ser só o caminho ("pessoas/x.webp") ou um objeto
// { src, alt, fit: "contain", bg, pad, cardPad } para logos que não podem ser cortados,
// ou { src, pos } para escolher o enquadramento de uma foto (ex.: "40% 45%").
// cardPad é o espaçamento só nos cards (para o logo não ficar sob o selo de status).
const imageCfg = (id) => {
  const v = images[id];
  if (!v) return null;
  return typeof v === 'string' ? { src: v } : v;
};
const imageSrc = (id) => imageCfg(id)?.src || null;

// Slot de imagem: usa a imagem mapeada em `images`, senão mostra um placeholder descritivo.
function slot(ctx, id, desc, cls = '') {
  const cfg = imageCfg(id);
  if (cfg) {
    const contain = cfg.fit === 'contain';
    const wrapStyle = cfg.bg ? ` style="background:${esc(cfg.bg)}"` : '';
    const cardPad = cfg.cardPad ? `;--card-pad:${esc(cfg.cardPad)}` : '';
    const imgStyle = contain
      ? ` style="object-fit:contain;padding:${esc(cfg.pad || '0')}${cardPad}"`
      : cfg.pos ? ` style="object-position:${esc(cfg.pos)}"` : '';
    return `<div class="slot${contain ? ' slot-logo' : ''} ${cls}"${wrapStyle}><img src="${ctx.P}assets/img/${esc(cfg.src)}" alt="${esc(cfg.alt || cleanDesc(desc))}" loading="lazy" decoding="async"${imgStyle}></div>`;
  }
  return `<div class="slot slot-empty ${cls}" aria-hidden="true" data-slot="${esc(id)}"><span>${esc(desc)}</span></div>`;
}

const badge = (o, inline = false) => `<span class="badge st-${o.status}${inline ? ' inline' : ''}">${esc(o.st.label)}</span>`;

// ---------- layout ----------
function layout(ctx, { title, description, path, body, active, float, ogImage, jsonLd }) {
  const P = ctx.P;
  const home = P || './';
  const onHome = ctx.page === 'home';
  const anchor = (id) => (onHome ? `#${id}` : `${home}#${id}`);
  const nav = [
    ['PROTAGONISTAS', home, active === 'home'],
    ['COMO FUNCIONA', anchor('como-funciona'), false, 'como-funciona'],
    ['OPORTUNIDADES', `${P}oportunidades/`, active === 'opps'],
    ['HISTÓRIAS', `${P}historias/`, active === 'stories'],
    ['QUEM JÁ PROTAGONIZA', anchor('quem-protagoniza'), false, 'quem-protagoniza'],
  ];
  const canonical = abs(path);
  const og = ogImage || abs('assets/img/hero-protagonistas.jpg');
  return t`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="Academia da Magia">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(og)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0B3A78">
<link rel="icon" type="image/png" href="${P}assets/img/logo-academia.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;700;800&family=Work+Sans:wght@400;500;600&display=swap">
<link rel="stylesheet" href="${P}assets/css/site.css">
<script>document.documentElement.classList.add('js')</script>
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body data-endpoint="${esc(site.formEndpoint || '')}">
<a class="skip-link" href="#conteudo">Pular para o conteúdo</a>
<header class="site-header">
  <nav class="site-nav" aria-label="Protagonistas">
    <a class="brand" href="${home}" aria-label="Programa Protagonistas · início">
      <span class="brand-adm"><img src="${P}assets/img/logo-academia.png" alt="Academia da Magia" width="34" height="24"></span>
      <picture><source srcset="${P}assets/img/protagonistas-logo.webp" type="image/webp"><img class="brand-prot" src="${P}assets/img/protagonistas-logo.png" alt="Protagonistas" width="120" height="40"></picture>
    </a>
    <div class="nav-links">
      ${nav.map(([label, href, on, spy]) => `<a href="${href}"${on ? ' aria-current="page"' : ''}${spy && onHome ? ` data-spy="${spy}"` : ''}${label === 'PROTAGONISTAS' && onHome ? ' data-spy="top"' : ''}>${label}</a>`)}
    </div>
    <a class="nav-cta" href="${P}oportunidades/"><span class="live-dot"></span>VER OPORTUNIDADES</a>
  </nav>
</header>
<main id="conteudo">
${body}
</main>
<footer class="site-footer">
  <div class="footer-inner">
    <div>
      <span class="footer-logo"><img src="${P}assets/img/logo-academia.png" alt="Academia da Magia" width="34" height="24" loading="lazy"></span>
      <p class="footer-title">PROGRAMA PROTAGONISTAS</p>
      <p class="footer-sign">Sua jornada. Sua voz. Seu espaço.</p>
    </div>
    <nav class="footer-links" aria-label="Rodapé">
      <a href="${anchor('como-funciona')}">Como funciona</a>
      <a href="${P}oportunidades/">Oportunidades</a>
      <a href="${P}historias/">Histórias</a>
      <a href="${anchor('quem-protagoniza')}">Quem já protagoniza</a>
    </nav>
  </div>
</footer>
${float ? `<a class="float-cta" href="${float.href}"${float.apply ? ' data-float-apply' : ''}><span class="live-dot"></span>${esc(float.label)}</a>` : ''}
<script src="${P}assets/js/site.js" defer></script>
</body>
</html>
`;
}

// ---------- componentes ----------
function personCard(ctx, p) {
  const hay = `${p.name} ${p.spec} ${p.typeLabel}`;
  return t`<a class="person-card" href="${ctx.P}${esc(p.slug)}/" data-tags="${esc(p.tags.join('|'))}" data-search="${esc(hay)}">
  <div class="person-media">
    ${slot(ctx, `person-${p.slug}`, `foto real: ${p.name}`)}
    <div class="person-overlay">
      <p class="person-type">${esc(p.typeLabel)}</p>
      <p class="person-name">${esc(p.name)}</p>
    </div>
  </div>
  <div class="person-body">
    <p class="person-spec">${esc(p.spec)}</p>
    <p class="person-bio">${esc(p.bio)}</p>
    <span class="link-arrow">CONHECER A HISTÓRIA →</span>
  </div>
</a>`;
}

function homeOppCard(ctx, o) {
  return t`<article class="opp-card home">
  <div class="opp-media sm">
    ${slot(ctx, `opp-${o.slug}`, o.img)}
    ${badge(o)}
  </div>
  <div class="opp-body">
    <p class="opp-kicker">${esc(o.homeLabel || '')}</p>
    <h3 class="opp-title">${esc(o.title)}</h3>
    <p class="opp-catline">${esc(o.catLine)}</p>
    <p class="opp-headline">${esc(o.headline)}</p>
    <p class="opp-meta">${esc(o.local)} · ${esc(o.prazoLabel)}</p>
    <a class="link-arrow" href="${ctx.P}oportunidades/${esc(o.slug)}/">CONHECER OPORTUNIDADE →</a>
  </div>
</article>`;
}

function muralOppCard(ctx, o) {
  return t`<article class="opp-card" data-cats="${esc(o.cats.join('|'))}">
  <div class="opp-media">
    ${slot(ctx, `opp-${o.slug}`, o.img)}
    ${badge(o)}
  </div>
  <div class="opp-body">
    <p class="opp-cats">${esc(o.catLine)}</p>
    <h2 class="opp-title">${esc(o.title)}</h2>
    ${o.subtitle ? `<p class="opp-subtitle">${esc(o.subtitle)}</p>` : ''}
    <p class="opp-headline">${esc(o.headline)}</p>
    <dl class="opp-dl">
      <dt>Perfil</dt><dd>${esc(o.perfil)}</dd>
      <dt>Local</dt><dd>${esc(o.local)}</dd>
      <dt>Período</dt><dd>${esc(o.periodo)}</dd>
      <dt>Candidatura</dt><dd>${esc(o.prazoLabel)}</dd>
    </dl>
    <a class="btn btn-primary" href="${ctx.P}oportunidades/${esc(o.slug)}/">CONHECER OPORTUNIDADE</a>
  </div>
</article>`;
}

const filterButtons = (labels) =>
  labels.map((label, i) => `<button type="button" class="filter" data-filter="${esc(label)}" aria-pressed="${i === 0}">${esc(label)}</button>`).join('');

const notifyForm = (id, label, kind, extraAttrs = '', center = false) => t`<form class="inline-form${center ? ' center' : ''}" data-form="${kind}"${extraAttrs}>
  <label for="${id}" class="sr-only">E-mail</label>
  <input id="${id}" class="input-pill" type="email" name="email" required placeholder="seu@email.com" autocomplete="email">
  <div class="hp" aria-hidden="true"><label for="${id}-website">Não preencha este campo</label><input id="${id}-website" name="website" type="text" tabindex="-1" autocomplete="off"></div>
  <button type="submit" class="btn btn-primary">${label}</button>
  <p class="form-error" role="alert" hidden>Não foi possível enviar agora. Tente novamente em instantes.</p>
</form>`;

// ---------- páginas ----------
function pageHome() {
  const ctx = { P: '', page: 'home' };
  const pri = personBySlug.get('priscila-mior');
  const body = t`
<section class="hero">
  <div class="hero-media">
    <picture>
      <source srcset="assets/img/hero-protagonistas.webp" type="image/webp">
      <img class="hero-photo" src="assets/img/hero-protagonistas.jpg" alt="Protagonistas da Academia da Magia" width="1672" height="941" fetchpriority="high">
    </picture>
    <div class="hero-fade"></div>
    <picture>
      <source srcset="assets/img/protagonistas-logo.webp" type="image/webp">
      <img class="hero-logo" src="assets/img/protagonistas-logo.png" alt="Protagonistas" width="1400" height="467">
    </picture>
  </div>
  <div class="hero-copy">
    <p class="eyebrow">PROGRAMA PROTAGONISTAS · ACADEMIA DA MAGIA</p>
    <h1>Você já faz parte da Academia. <span class="hl">Agora, pode fazer magia dentro dela.</span></h1>
    <p class="intro">O Protagonistas abre espaço para que alunos da Academia da Magia transformem suas histórias, conhecimentos e experiências em novas formas de contribuir, inspirar e ocupar o palco da nossa comunidade.</p>
    <div class="btn-row">
      <a class="btn btn-primary" href="#como-funciona">CONHEÇA O PROTAGONISTAS</a>
      <a class="btn btn-secondary" href="oportunidades/">VER OPORTUNIDADES ABERTAS</a>
    </div>
    <p class="signature">SUA JORNADA. SUA VOZ. SEU ESPAÇO.</p>
  </div>
</section>

<section class="section cream manifesto">
  <div class="wrap-md split">
    <h2 class="h2">Todo mundo entra na Academia para aprender alguma coisa. <span>Mas algumas histórias também têm muito a ensinar.</span></h2>
    <div>
      <div class="rule-list">
        <p>Talvez seja uma experiência.</p>
        <p>Um conhecimento.</p>
        <p>Uma transformação.</p>
        <p>Uma habilidade.</p>
        <p>Uma forma diferente de enxergar o turismo.</p>
      </div>
      <p class="manifesto-close">E talvez exista um espaço dentro da Academia onde tudo isso possa ganhar voz.</p>
    </div>
  </div>
</section>

<section class="section what">
  <div class="wrap-md">
    <p class="eyebrow">O QUE É SER PROTAGONISTA?</p>
    <h2 class="h2">Ser Protagonista não é simplesmente aparecer.</h2>
    <div class="split">
      <div class="body-lg">
        <p>É ter construído uma trajetória que pode <strong>contribuir, inspirar, ensinar, conectar ou ajudar a construir algo junto com a Academia.</strong></p>
        <p>É quando aquilo que você aprendeu, viveu, aplicou e conquistou pode abrir possibilidades não apenas para você, mas também para outras pessoas.</p>
        <p>Por isso, não existe apenas uma maneira de protagonizar.</p>
      </div>
      <div>
        <p class="chips-label">Um Protagonista pode…</p>
        <div class="chips">
          ${data.podeSer.map((c) => `<span class="chip">${esc(c)}</span>`)}
          <span class="chip chip-dashed">ou ocupar um lugar que ainda nem existe hoje</span>
        </div>
      </div>
    </div>
    <p class="statement">Protagonismo não é sobre aparecer mais. <span class="hl">É sobre ter algo para contribuir.</span></p>
  </div>
</section>

${pri ? t`<section class="feature" aria-labelledby="pri-title">
  <div class="feature-card">
    <div class="feature-media">
      ${slot(ctx, 'pri-action-1', 'foto/vídeo real: Priscila Mior em Orlando com participantes')}
      ${imageCfg('pri-action-video') || !imageCfg('pri-action-1') ? `<div class="feature-mini">${slot(ctx, 'pri-action-video', 'reels: bastidores')}</div>` : ''}
    </div>
    <div class="feature-copy">
      <p class="tag-live">PROTAGONISTA EM AÇÃO · ORLANDO</p>
      <h2 id="pri-title">${esc(pri.name)}</h2>
      <p class="feature-sub">De aluna a parte ativa de uma experiência da Academia.</p>
      <div class="feature-body">
        <p>A Pri entrou na Academia procurando um caminho para transformar uma paixão em profissão. Vieram formações, experiências, prática e novos caminhos profissionais.</p>
        <p>Agora, em Orlando, ela vive um novo capítulo. Como <strong>primeira Protagonista deste novo formato</strong>, Pri acompanha uma experiência prática da Academia por dentro, conversa com os participantes, registra experiências, mostra bastidores e ajuda outras pessoas a enxergarem novas possibilidades.</p>
      </div>
      <blockquote class="quote-gold"><p>“${esc(pri.quotes[0])}”</p></blockquote>
      <div><a class="btn btn-primary btn-sm" href="${esc(pri.slug)}/">CONHEÇA A HISTÓRIA DA PRI</a></div>
    </div>
  </div>
</section>` : ''}

<section id="formas" class="section bg-alt">
  <div class="wrap">
    <div class="head-row">
      <h2 class="h2">Não existe um único tipo de Protagonista.</h2>
      <p class="side-note">Cada pessoa pode contribuir de uma maneira diferente.</p>
    </div>
    <div class="grid-300">
      ${data.tiposDeProtagonista.map((r, i) => t`<div class="role-card">
        <span class="role-n">${pad(i)}</span>
        <div>
          <h3>${esc(r.titulo)}</h3>
          <p>${esc(r.descricao)}</p>
        </div>
      </div>`)}
      <div class="role-close">
        <p>Essas são algumas possibilidades. Não são limites.</p>
        <p>À medida que a Academia cresce, novas formas de protagonizar também podem surgir.</p>
      </div>
    </div>
  </div>
</section>

<section id="quem-protagoniza" class="section">
  <div class="wrap">
    <p class="eyebrow">CONHEÇA NOSSOS PROTAGONISTAS</p>
    <div class="head-row">
      <h2 class="h2">Quem já está fazendo magia com a gente.</h2>
      <p class="people-intro">Histórias diferentes. Conhecimentos diferentes. Um ponto em comum: cada uma encontrou uma forma de contribuir.</p>
    </div>
    <div class="grid-people">
      ${PEOPLE.map((p) => personCard(ctx, p))}
    </div>
    <div style="margin-top:40px"><a class="btn btn-secondary btn-sm" href="historias/">CONHEÇA TODOS OS PROTAGONISTAS</a></div>
  </div>
</section>

<section id="como-funciona" class="section bg-alt how">
  <div class="wrap">
    <p class="eyebrow">COMO FUNCIONA</p>
    <h2 class="h2">Como alguém se torna Protagonista?</h2>
    <div class="how-intro">
      <p>Você não precisa criar um projeto para tentar convencer a Academia.</p>
      <p>Nós criamos oportunidades. <span class="hl">Você nos mostra por que aquela pode ser a sua.</span></p>
    </div>
    <ol class="steps">
      ${data.comoFunciona.map((s, i) => t`<li class="step">
        <span class="step-n">${pad(i)}</span>
        <h3>${esc(s.titulo)}</h3>
        <p>${esc(s.texto)}</p>
      </li>`)}
    </ol>
  </div>
</section>

<section class="section cream">
  <div class="wrap-md split">
    <h2 class="h2">Cada oportunidade procura uma história diferente.</h2>
    <div>
      <div class="rule-list bold">
        <p>Não existe uma quantidade obrigatória de cursos.</p>
        <p>Não existe um único caminho.</p>
        <p>Não existe uma pontuação que automaticamente transforma alguém em Protagonista.</p>
      </div>
      <p class="cream-body">Algumas oportunidades podem exigir uma formação específica. Outras podem procurar determinada experiência, conhecimento, resultado, habilidade ou disponibilidade.</p>
      <p class="cream-strong">Os critérios estarão sempre descritos em cada oportunidade.</p>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <p class="eyebrow">MURAL DE OPORTUNIDADES</p>
    <div class="head-row">
      <h2 class="h2">Seu próximo lugar pode estar aqui.</h2>
      <a class="btn btn-primary btn-sm" href="oportunidades/">VER TODAS AS OPORTUNIDADES</a>
    </div>
    <div class="grid-opps home">
      ${liveOpps.slice(0, 4).map((o) => homeOppCard(ctx, o))}
    </div>
  </div>
</section>

<section class="section bg-alt gains-section">
  <div class="wrap-md">
    <div class="split gains-intro">
      <h2 class="h2">Protagonizar também é viver novas experiências.</h2>
      <div class="body">
        <p>Cada oportunidade possui suas próprias características e contrapartidas.</p>
        <p>Dependendo da missão, um Protagonista poderá ter acesso a experiências, eventos, cursos, projetos, bastidores, mentorias, destinos, conteúdos ou outros espaços da Academia.</p>
      </div>
    </div>
    <ul class="gains">
      ${data.contrapartidas.map((g) => `<li>${esc(g)}</li>`)}
    </ul>
    <p class="statement">Não é um prêmio por aquilo que você comprou. <span class="hl">É uma oportunidade construída a partir daquilo que você se tornou.</span></p>
  </div>
</section>

<section class="section culture">
  <div class="wrap-md split">
    <figure class="culture-figure">
      <figcaption class="culture-title">
        <span class="culture-name">Camila Moretti</span>
        <span class="culture-sub">De aluna a sócia.</span>
      </figcaption>
      <div class="photo-45">${slot(ctx, 'camila-photo', 'foto real: Camila Moretti')}</div>
    </figure>
    <div>
      <p class="eyebrow">NOSSA CULTURA</p>
      <h2>Quando uma comunidade também revela talentos.</h2>
      <p class="body">A Camila Moretti entrou na Academia como aluna. Ao longo da sua trajetória, passou por diferentes espaços até se tornar parte ativa do negócio — e hoje é sócia da Academia.</p>
      <p class="belief">As pessoas que entram na nossa comunidade podem ter muito mais para construir com ela do que imaginavam quando chegaram.</p>
    </div>
  </div>
</section>

<section class="final">
  <div class="mosaic">
    ${data.mosaicoFinal.map((ph, i) => `<div>${slot(ctx, `final-m${i}`, `foto: ${ph}`)}</div>`)}
  </div>
  <div class="final-copy">
    <h2>Talvez você tenha chegado até aqui procurando conhecimento.</h2>
    <p class="final-sub">E talvez, em algum momento, descubra que também existe um palco esperando pelo que você tem para compartilhar.</p>
    <p class="final-body">Você não precisa saber agora qual será.<br>Continue aprendendo. Continue aplicando. Continue construindo sua história.</p>
    <p class="final-ready">Quando a oportunidade certa aparecer, esteja pronto para ocupá-la.</p>
    <div class="btn-row">
      <a class="btn btn-primary" href="oportunidades/">VER OPORTUNIDADES ABERTAS</a>
      <a class="btn btn-secondary" href="historias/">CONHECER OS PROTAGONISTAS</a>
    </div>
    <p class="final-sign">A Academia fez parte da sua história.<br><span class="hl">Agora, sua história pode fazer parte da Academia.</span></p>
  </div>
</section>`;

  return layout(ctx, {
    title: 'Programa Protagonistas · Academia da Magia',
    description: 'O Programa Protagonistas abre espaço para que alunos da Academia da Magia — agentes de viagens e profissionais do turismo — transformem suas histórias em novas formas de contribuir. Conheça as oportunidades abertas.',
    path: '',
    body,
    active: 'home',
    float: { href: 'oportunidades/', label: 'VER OPORTUNIDADES' },
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Academia da Magia',
      url: site.url,
      logo: abs('assets/img/logo-academia.png'),
      department: { '@type': 'Organization', name: 'Programa Protagonistas', url: abs('') },
    },
  });
}

function pageMural() {
  const ctx = { P: '../', page: 'opps' };
  const body = t`
<section class="page-top">
  <div class="wrap">
    <p class="crumbs"><a href="../">Protagonistas</a> / Oportunidades</p>
    <p class="eyebrow">MURAL DE OPORTUNIDADES</p>
    <h1 class="h1">Seu próximo lugar pode estar aqui.</h1>
    <p class="lead">Conheça as oportunidades atualmente abertas para Protagonistas. Cada uma descreve sua missão, seus critérios e o que envolve.</p>
    <div class="filters js-only" role="group" aria-label="Filtrar por categoria" data-filter-group="opps">
      ${filterButtons(data.filtrosOportunidades)}
    </div>
    <div class="grid-opps" data-filter-target="opps">
      ${liveOpps.map((o) => muralOppCard(ctx, o))}
    </div>
    <div class="empty" data-empty="opps"${liveOpps.length ? ' hidden' : ''}>Nenhuma oportunidade aberta nesta categoria agora. Novas oportunidades são publicadas aqui ao longo do ano.</div>
  </div>
</section>

<section class="notify">
  <div class="notify-box">
    <div style="max-width:560px">
      <h2>Acompanhe novas oportunidades.</h2>
      <p>Receba um aviso sempre que uma nova oportunidade for publicada no mural.</p>
    </div>
    ${notifyForm('notify-list', 'QUERO SER AVISADO', 'aviso-mural')}
    <p class="done-msg" role="status" hidden>Pronto. Você será avisado sobre novas oportunidades.</p>
  </div>
</section>

${closedOpps.length ? t`<section class="archive">
  <div class="wrap">
    <p class="eyebrow">ARQUIVO</p>
    <h2>Oportunidades que já viraram história.</h2>
    <p class="sub">Toda oportunidade encerrada aponta para quem a protagonizou.</p>
    <div class="archive-list">
      ${closedOpps.map((o) => t`<article class="archive-item">
        <div class="archive-media">${slot(ctx, `opp-${o.slug}`, o.img)}</div>
        <div>
          <p class="archive-kicker">OPORTUNIDADE ENCERRADA · ${esc(o.catLine)}</p>
          <h3><a href="${esc(o.slug)}/">${esc(o.title)}</a></h3>
          ${o.selected ? `<p class="who">Protagonista selecionada: <strong>${esc(o.selectedName)}</strong></p>` : ''}
        </div>
        ${o.selected ? `<div class="archive-cta"><a class="btn btn-outline-gold" href="../${esc(o.selected)}/">CONHEÇA QUEM PROTAGONIZOU</a></div>` : ''}
      </article>`)}
    </div>
  </div>
</section>` : ''}`;

  return layout(ctx, {
    title: 'Oportunidades · Protagonistas · Academia da Magia',
    description: 'Mural de Oportunidades do Programa Protagonistas: conheça as oportunidades abertas, a missão, os critérios e o que cada uma envolve.',
    path: 'oportunidades/',
    body,
    active: 'opps',
    float: null,
  });
}

// Critérios enviados junto com cada candidatura: a análise com IA no painel compara as respostas com eles.
const oppCriteria = (o) => ({
  titulo: o.title,
  subtitulo: o.subtitle || '',
  headline: o.headline,
  missao: o.mission,
  perfil: o.perfil,
  quem: o.who,
  requisitos: o.req,
  conhecer: o.know,
  fazer: o.todo,
  local: o.local,
  periodo: o.periodo,
});

function pageOpp(o) {
  const ctx = { P: '../../', page: 'opp' };
  const P = ctx.P;
  // Logos não viram fundo do hero (o degradê os apagaria): aparecem num painel ao lado do título.
  const heroLogo = imageCfg(`opp-${o.slug}`)?.fit === 'contain';
  const fields = [
    ...data.formularioBase,
    ...(o.extra || []).map((e, i) => ({ key: `extra_${i + 1}`, label: e.label, type: e.type, full: true, extra: true })),
  ];
  const fieldHtml = (f) => {
    const id = `f-${o.slug}-${f.key}`;
    const req = f.optional ? '' : ' required';
    const label = f.label + (f.optional ? ' (opcional)' : '');
    const ac = { nome: 'name', email: 'email', whats: 'tel', cidade: 'address-level2' }[f.key];
    const common = `id="${id}" name="${esc(f.key)}" data-label="${esc(f.label)}"${req}${ac ? ` autocomplete="${ac}"` : ''}`;
    let control;
    if (f.type === 'area') control = `<textarea ${common} rows="4"></textarea>`;
    else if (f.type === 'select') control = `<select ${common}><option value="" disabled selected>Selecione</option>${f.options.map((op) => `<option>${esc(op)}</option>`).join('')}</select>`;
    else control = `<input ${common} type="${esc(f.type)}">`;
    return t`<div class="field${f.full ? ' full' : ''}">
      <label for="${id}">${esc(label)}</label>
      ${control}
      ${f.extra ? '<p class="field-hint">Pergunta específica desta oportunidade</p>' : ''}
    </div>`;
  };

  let applyInner = '';
  if (o.isOpen) {
    applyInner = t`<div data-apply-form>
      <p class="eyebrow">CANDIDATURA · ${esc(o.title.toUpperCase())}</p>
      <h2>Mostre por que essa pode ser a sua.</h2>
      <p class="intro">Não existe resposta certa. Queremos conhecer sua trajetória e o que você pode contribuir com esta missão.</p>
      <form class="form-grid" data-form="candidatura" data-opp="${esc(o.slug)}" data-opp-title="${esc(o.title)}">
        ${fields.map(fieldHtml)}
        <div class="hp" aria-hidden="true"><label for="f-${esc(o.slug)}-website">Não preencha este campo</label><input id="f-${esc(o.slug)}-website" name="website" type="text" tabindex="-1" autocomplete="off"></div>
        <script type="application/json" data-criteria>${JSON.stringify(oppCriteria(o)).replace(/</g, '\\u003c')}</script>
        <p class="form-error" role="alert" hidden>Não foi possível enviar sua candidatura agora. Tente novamente em instantes.</p>
        <div class="form-foot">
          <p>Todas as candidaturas passam por curadoria e recebem retorno. Seus dados são usados só para avaliar esta candidatura, pelo time da Academia com apoio de inteligência artificial.</p>
          <button type="submit" class="btn btn-primary">ENVIAR CANDIDATURA</button>
        </div>
      </form>
    </div>
    <div class="success" role="status" tabindex="-1" data-apply-success hidden>
      <p class="eyebrow">CANDIDATURA ENVIADA</p>
      <h2>Recebemos a sua história.</h2>
      <p>Agora ela passa pela curadoria da Academia. Você recebe um retorno por e-mail, qualquer que seja o resultado.</p>
      <a class="btn btn-secondary btn-sm" href="../">VER OUTRAS OPORTUNIDADES</a>
    </div>`;
  } else if (o.isSoon) {
    applyInner = t`<div class="state center">
      <h2>As inscrições abrem em breve.</h2>
      <p>${esc(o.prazoLabel)}. Deixe seu e-mail para receber o aviso.</p>
      ${notifyForm(`notify-${o.slug}`, 'AVISE-ME', 'aviso-oportunidade', ` data-opp="${esc(o.slug)}"`, true)}
      <p class="done-msg" role="status" hidden>Pronto. Avisaremos quando as inscrições abrirem.</p>
    </div>`;
  } else if (o.isRunning) {
    applyInner = t`<div class="state center">
      <h2>Seleção em andamento.</h2>
      <p>Quando o próximo capítulo começar, você vai conhecer quem entrou em cena.</p>
      <a class="btn btn-primary btn-sm" href="../">VER OPORTUNIDADES ABERTAS</a>
    </div>`;
  } else if (o.isClosed) {
    applyInner = t`<p class="chain-label">OPORTUNIDADE ENCERRADA · ESSA OPORTUNIDADE VIROU HISTÓRIA</p>
    <div class="chain">
      <div><p class="k">OPORTUNIDADE</p><p class="v">${esc(o.title)}</p></div>
      ${o.selected ? t`<div><p class="k">SELECIONADA</p><p class="v">${esc(o.selectedName)}</p></div>
      <a href="${P}${esc(o.selected)}/"><p class="k">HISTÓRIA</p><p class="v">Veja como foi sua experiência →</p></a>` : ''}
    </div>`;
  }

  let asideAction = '';
  if (o.isOpen) asideAction = `<a class="btn btn-primary" href="#candidatura">QUERO ME CANDIDATAR</a>`;
  else if (o.isSoon) asideAction = `<p class="aside-note">As inscrições ainda não abriram. Você pode pedir um aviso logo abaixo.</p>`;
  else if (o.isRunning) asideAction = `<p class="aside-note">As candidaturas foram encerradas e a curadoria está em andamento. Todos os candidatos recebem retorno.</p>`;
  else if (o.isClosed && o.selected) asideAction = `<p class="aside-selected">Protagonista selecionada: <strong>${esc(o.selectedName)}</strong></p><a class="btn btn-outline-gold" href="${P}${esc(o.selected)}/">CONHEÇA QUEM PROTAGONIZOU</a>`;

  const list = (arr) => `<ul class="bullets">${arr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;

  const body = t`
<article>
  <section class="opp-hero${heroLogo ? ' has-logo' : ''}">
    ${heroLogo ? '' : slot(ctx, `opp-${o.slug}`, o.img)}
    <div class="opp-hero-fade"></div>
    <div class="opp-hero-inner">
      <div class="opp-hero-text">
        <p class="crumbs"><a href="${P}">Protagonistas</a> / <a href="../">Oportunidades</a></p>
        <div class="opp-hero-tags">
          ${badge(o, true)}
          <span class="cats">${esc(o.catLine)}</span>
        </div>
        <h1>${esc(o.title)}</h1>
        ${o.subtitle ? `<p class="subtitle">${esc(o.subtitle)}</p>` : ''}
        <p class="headline">${esc(o.headline)}</p>
      </div>
      ${heroLogo ? `<div class="opp-hero-logo">${slot(ctx, `opp-${o.slug}`, o.img)}</div>` : ''}
    </div>
  </section>

  <div class="opp-main">
    <div class="opp-cols">
      <div class="opp-content">
        <div class="block">
          <h2 class="block-label">01 · A MISSÃO</h2>
          <p class="block-mission">${esc(o.mission)}</p>
        </div>
        <div class="block block-2col">
          <div>
            <h2 class="block-label">02 · O QUE VOCÊ VAI VIVER</h2>
            ${list(o.live)}
          </div>
          <div>
            <h2 class="block-label">03 · O QUE VOCÊ VAI FAZER</h2>
            ${list(o.todo)}
          </div>
        </div>
        <div class="block">
          <h2 class="block-label">04 · QUEM ESTAMOS PROCURANDO</h2>
          <p class="block-text">${esc(o.who)}</p>
        </div>
        <div class="block">
          <h2 class="block-label">05 · PARA SE CANDIDATAR</h2>
          <ul class="checks">${o.req.map((x) => `<li>${esc(x)}</li>`)}</ul>
        </div>
        <div class="block">
          <h2 class="block-label">06 · O QUE QUEREMOS CONHECER SOBRE VOCÊ</h2>
          ${list(o.know)}
        </div>
        <div class="block">
          <h2 class="block-label">07 · COMO FUNCIONA A SELEÇÃO</h2>
          <ol class="sel-steps">${data.etapasSelecao.map((s, i) => `<li><span>${pad(i)}</span>${esc(s)}</li>`)}</ol>
        </div>
        <div class="block">
          <h2 class="block-label">08 · PERÍODO DA EXPERIÊNCIA</h2>
          <p class="period">${esc(o.periodo)}</p>
          <p class="period-note">${esc(o.periodoNote)}</p>
        </div>
        <div class="block">
          <h2 class="block-label">09 · CONTRAPARTIDAS E CONDIÇÕES</h2>
          <div class="terms">
            <div><h3>A Academia disponibiliza</h3>${list(o.gives)}</div>
            <div><h3>Responsabilidades do Protagonista</h3>${list(o.asks)}</div>
          </div>
        </div>
      </div>

      <aside class="opp-aside st-${o.status}" aria-label="Resumo da oportunidade">
        <p class="aside-label">STATUS DA OPORTUNIDADE</p>
        <p class="aside-status">${esc(o.st.label)}</p>
        <dl class="aside-dl">
          <div><dt>Período de candidatura</dt><dd>${esc(o.prazoLabel)}</dd></div>
          <div><dt>Período da experiência</dt><dd>${esc(o.periodo)}</dd></div>
          <div><dt>Localização</dt><dd>${esc(o.local)}</dd></div>
          <div><dt>Perfil</dt><dd>${esc(o.perfil)}</dd></div>
        </dl>
        ${asideAction}
      </aside>
    </div>
  </div>

  <section id="candidatura" class="apply">
    <div class="apply-inner">
      ${applyInner}
    </div>
  </section>
</article>`;

  return layout(ctx, {
    title: `${o.title}${o.subtitle ? ` — ${o.subtitle}` : ''} · Oportunidades · Protagonistas`,
    description: `${o.headline} ${o.mission}`.slice(0, 300),
    path: `oportunidades/${o.slug}/`,
    body,
    active: 'opps',
    float: o.isOpen ? { href: '#candidatura', label: 'QUERO ME CANDIDATAR', apply: true } : null,
    ogImage: imageSrc(`opp-${o.slug}`) ? abs(`assets/img/${imageSrc(`opp-${o.slug}`)}`) : null,
  });
}

function pageStories() {
  const ctx = { P: '../', page: 'stories' };
  const body = t`
<section class="stories">
  <div class="wrap">
    <p class="crumbs"><a href="../">Protagonistas</a> / Histórias</p>
    <h1 class="h1">Toda trajetória começa em algum lugar.</h1>
    <p class="lead">Conheça as pessoas que transformaram experiências, conhecimentos e histórias em novas formas de contribuir com a Academia.</p>
    <div class="story-tools js-only">
      <label for="story-q" class="sr-only">Buscar Protagonista</label>
      <input id="story-q" class="input-pill" type="search" placeholder="Buscar por nome ou especialidade" data-search-input="stories">
      <div class="filters" role="group" aria-label="Filtrar histórias" data-filter-group="stories">
        ${filterButtons(data.filtrosHistorias)}
      </div>
    </div>
    <div class="grid-people" data-filter-target="stories">
      ${PEOPLE.map((p) => personCard(ctx, p))}
    </div>
    <div class="empty" data-empty="stories" hidden>Nenhuma história encontrada com esse filtro. Novas histórias surgem a cada oportunidade.</div>
  </div>
</section>`;
  return layout(ctx, {
    title: 'Histórias · Protagonistas · Academia da Magia',
    description: 'Conheça as pessoas que transformaram experiências, conhecimentos e histórias em novas formas de contribuir com a Academia da Magia.',
    path: 'historias/',
    body,
    active: 'stories',
    float: { href: '../oportunidades/', label: 'VER OPORTUNIDADES' },
  });
}

function pageProfile(p) {
  const ctx = { P: '../', page: 'profile' };
  const pOpp = p.opp && opps.find((o) => o.slug === p.opp);
  const quotesTitle = p.quotesTitle || 'O QUE ELA DESCOBRIU PELO CAMINHO';
  const heroImg = imageSrc(`profile-hero-${p.slug}`) || imageSrc(`person-${p.slug}`);
  const body = t`
<article>
  <section class="profile-top">
    <div class="wrap">
      <p class="crumbs"><a href="../">Protagonistas</a> / <a href="../historias/">Histórias</a> / ${esc(p.name)}</p>
      <div class="profile-grid">
        <div class="profile-photo">${slot(ctx, `profile-hero-${p.slug}`, `foto/vídeo hero: ${p.name}`)}</div>
        <div>
          <p class="eyebrow">${esc(p.role)}</p>
          <h1>${esc(p.name)}</h1>
          <p class="profile-spec">${esc(p.spec)}</p>
          <p class="profile-label">SUA HISTÓRIA</p>
          <div class="profile-story">${p.story.map((s) => `<p>${esc(s)}</p>`)}</div>
        </div>
      </div>
    </div>
  </section>

  ${p.journey.length ? t`<section class="section-110 bg-alt">
    <div class="wrap">
      <p class="eyebrow">SUA JORNADA NA ACADEMIA</p>
      <h2 class="h2-md">${esc(p.journey[0].title)} → ${esc(p.journey[p.journey.length - 1].title)}.</h2>
      <ol class="journey">
        ${p.journey.map((j) => t`<li>
          <div class="journey-line"><span class="journey-dot"></span></div>
          <h3>${esc(j.title)}</h3>
          <p>${esc(j.text)}</p>
        </li>`)}
      </ol>
    </div>
  </section>` : ''}

  ${pOpp ? t`<section class="section-110">
    <div class="profile-opp">
      <div>
        <p class="eyebrow">SUA OPORTUNIDADE</p>
        <h2>${esc(pOpp.title)}</h2>
        <p class="body">${esc(pOpp.mission)}</p>
      </div>
      <a class="opp-link-card" href="../oportunidades/${esc(pOpp.slug)}/">
        <p class="k">OPORTUNIDADE</p>
        <p class="v">${esc(pOpp.title)}</p>
        <p class="k">SELECIONADA</p>
        <p class="v">${esc(p.name)}</p>
        <span class="link-arrow">VER A OPORTUNIDADE →</span>
      </a>
    </div>
  </section>` : ''}

  ${p.gallery.length ? t`<section class="gallery-section">
    <div class="wrap">
      <p class="eyebrow">EM AÇÃO</p>
      <h2 class="h2-md">Vídeos, bastidores e conteúdos.</h2>
      <div class="gallery" tabindex="0" aria-label="Galeria de ${esc(p.name)}">
        ${p.gallery.map(([label, ph], i) => t`<figure>
          <div class="frame">${slot(ctx, `gal-${p.slug}-${i}`, ph)}</div>
          <figcaption>${esc(label)}</figcaption>
        </figure>`)}
      </div>
    </div>
  </section>` : ''}

  ${p.quotes.length ? t`<section class="section-110 cream">
    <div class="quotes">
      <p class="eyebrow">${esc(quotesTitle)}</p>
      ${p.quotes.map((q) => `<blockquote><p>“${esc(q)}”</p></blockquote>`)}
    </div>
  </section>` : ''}

  <section class="profile-close">
    <div>
      <p>Essa é a história da ${esc(p.short)}.<br><span>A próxima não precisa ser igual à dela.</span></p>
      <h2>Qual pode ser a sua?</h2>
      <a class="btn btn-primary" href="../oportunidades/">VER OPORTUNIDADES</a>
    </div>
  </section>
</article>`;

  return layout(ctx, {
    title: `${p.name} · Protagonistas · Academia da Magia`,
    description: `${p.name} — ${p.spec}. ${p.bio}`.slice(0, 300),
    path: `${p.slug}/`,
    body,
    active: 'stories',
    float: { href: '../oportunidades/', label: 'VER OPORTUNIDADES' },
    ogImage: heroImg ? abs(`assets/img/${heroImg}`) : null,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: p.name,
      description: p.bio,
      jobTitle: p.typeLabel,
      url: abs(`${p.slug}/`),
      ...(heroImg ? { image: abs(`assets/img/${heroImg}`) } : {}),
      affiliation: { '@type': 'Organization', name: 'Academia da Magia', url: site.url },
    },
  });
}

// ---------- escrita ----------
// Remove páginas geradas anteriormente (tudo exceto assets/), para não deixar rotas órfãs.
for (const entry of readdirSync(OUT, { withFileTypes: true })) {
  if (entry.name === 'assets') continue;
  rmSync(join(OUT, entry.name), { recursive: true, force: true });
}

const pages = [];
const write = (path, html) => {
  const dir = join(OUT, path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);
  pages.push(path);
};

write('', pageHome());
write('oportunidades/', pageMural());
for (const o of opps) write(`oportunidades/${o.slug}/`, pageOpp(o));
write('historias/', pageStories());
for (const p of PEOPLE) write(`${p.slug}/`, pageProfile(p));

writeFileSync(
  join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((p) => `  <url><loc>${esc(abs(p))}</loc></url>`).join('\n')}\n</urlset>\n`,
);

if (!existsSync(join(OUT, 'assets/js/site.js'))) console.warn('Aviso: protagonistas/assets/js/site.js não encontrado.');
console.log(`Geradas ${pages.length} páginas em protagonistas/`);
