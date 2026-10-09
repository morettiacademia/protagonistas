// Programa Protagonistas — painel de curadoria (Supabase Auth + Edge Function protagonistas-ia).
(function () {
  var state = { apps: [], statuses: [], opp: 'todas', status: 'todos', sort: 'nota', q: '', selected: null, iaOk: true, busy: false };
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var norm = function (s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };

  var STATUSES = ['Nova', 'Em análise', 'Pré-selecionada', 'Selecionada', 'Não selecionada'];
  var cfg = window.PROTAGONISTAS_CONFIG || {};
  var sb = window.supabase && cfg.supabaseUrl && cfg.supabaseKey
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey)
    : null;
  state.statuses = STATUSES;
  state.iaOk = true;

  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 4200);
  }

  function showLogin(msg) {
    $('app').hidden = true; $('login').hidden = false;
    var err = $('login-err');
    err.textContent = msg || ''; err.hidden = !msg;
  }

  function logout() {
    if (sb) sb.auth.signOut();
    $('pw').value = '';
    showLogin();
  }

  // Erro das Edge Functions: a mensagem útil vem no corpo { erro }.
  function fnError(error) {
    var ctx = error && error.context;
    if (ctx && typeof ctx.json === 'function') {
      return ctx.json().then(function (b) { return new Error((b && b.erro) || error.message); }, function () { return error; });
    }
    return Promise.resolve(error instanceof Error ? error : new Error(String(error)));
  }

  function invoke(body) {
    return sb.functions.invoke('protagonistas-ia', { body: body }).then(function (res) {
      if (res.error) return fnError(res.error).then(function (e) { throw e; });
      return res.data;
    });
  }

  function toApp(r) {
    return {
      id: r.id,
      recebidaEm: r.created_at,
      oportunidade: r.oportunidade,
      oportunidadeTitulo: r.oportunidade_titulo,
      nome: r.nome,
      email: r.email,
      whatsapp: r.whatsapp,
      cidade: r.cidade,
      relacao: r.relacao,
      status: r.status,
      notas: r.notas,
      respostas: r.respostas || [],
      ia: r.ia,
      iaAnalisadaEm: r.ia_analisada_em,
    };
  }

  $('login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!sb) { showLogin('O painel ainda não está ligado ao Supabase (falta a chave no site).'); return; }
    var err = $('login-err'); err.hidden = true;
    sb.auth.signInWithPassword({ email: $('login-email').value.trim(), password: $('pw').value }).then(function (res) {
      if (res.error) { showLogin('E-mail ou senha incorretos.'); return; }
      enter();
    });
  });

  $('logout').addEventListener('click', logout);
  $('reload').addEventListener('click', function () { load(); });

  function enter() {
    return sb.rpc('protagonistas_is_admin').then(function (res) {
      if (res.error || res.data !== true) {
        sb.auth.signOut();
        showLogin('Este usuário não tem acesso ao painel. Peça para incluírem seu e-mail em protagonistas_admins.');
        return;
      }
      return load();
    });
  }

  function load() {
    return sb.from('protagonistas_candidaturas').select('*').order('created_at', { ascending: false }).then(function (res) {
      if (res.error) { toast('Não foi possível carregar as candidaturas.'); return; }
      state.apps = res.data.map(toApp);
      $('login').hidden = true; $('app').hidden = false;
      renderFilters(); render();
    });
  }

  var csvCell = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
  $('csv').addEventListener('click', function () {
    var items = visible();
    var labels = [];
    items.forEach(function (a) { a.respostas.forEach(function (r) { if (labels.indexOf(r.label) < 0) labels.push(r.label); }); });
    var header = ['Recebida em', 'Oportunidade', 'Status', 'Nota IA', 'Aderência IA', 'Resumo IA', 'Anotações'].concat(labels);
    var rows = items.map(function (a) {
      var byLabel = {};
      a.respostas.forEach(function (r) { byLabel[r.label] = r.valor; });
      return [a.recebidaEm, a.oportunidadeTitulo, a.status, a.ia ? a.ia.nota : '', a.ia ? a.ia.aderencia : '', a.ia ? a.ia.resumo : '', a.notas]
        .concat(labels.map(function (l) { return byLabel[l] || ''; }));
    });
    var csv = '\ufeff' + [header].concat(rows).map(function (r) { return r.map(csvCell).join(';'); }).join('\r\n');
    var link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = 'candidaturas-protagonistas.csv';
    document.body.appendChild(link); link.click(); link.remove();
  });

  function opps() {
    var map = {};
    state.apps.forEach(function (a) {
      map[a.oportunidade] = map[a.oportunidade] || { slug: a.oportunidade, titulo: a.oportunidadeTitulo || a.oportunidade, n: 0 };
      map[a.oportunidade].n++;
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return b.n - a.n; });
  }

  function renderFilters() {
    var list = [{ slug: 'todas', titulo: 'Todas', n: state.apps.length }].concat(opps());
    $('opp-chips').innerHTML = list.map(function (o) {
      return '<button type="button" class="chip" data-opp="' + esc(o.slug) + '" aria-pressed="' + (o.slug === state.opp) + '">' + esc(o.titulo) + '<b>' + o.n + '</b></button>';
    }).join('');
    $('status-filter').innerHTML = '<option value="todos">Todos os status</option>' + state.statuses.map(function (s) {
      return '<option' + (s === state.status ? ' selected' : '') + '>' + esc(s) + '</option>';
    }).join('');
  }

  $('opp-chips').addEventListener('click', function (e) {
    var b = e.target.closest('[data-opp]'); if (!b) return;
    state.opp = b.getAttribute('data-opp');
    $('compare-box').hidden = true;
    renderFilters(); render();
  });
  $('status-filter').addEventListener('change', function (e) { state.status = e.target.value; render(); });
  $('sort').addEventListener('change', function (e) { state.sort = e.target.value; render(); });
  $('q').addEventListener('input', function (e) { state.q = e.target.value; render(); });

  function visible() {
    var q = norm(state.q);
    return state.apps.filter(function (a) {
      return (state.opp === 'todas' || a.oportunidade === state.opp) &&
        (state.status === 'todos' || a.status === state.status) &&
        (!q || norm(a.nome + ' ' + a.email + ' ' + a.cidade).indexOf(q) >= 0);
    }).sort(function (a, b) {
      if (state.sort === 'nota') {
        var na = a.ia ? a.ia.nota : -1, nb = b.ia ? b.ia.nota : -1;
        if (na !== nb) return nb - na;
      }
      return String(b.recebidaEm).localeCompare(String(a.recebidaEm));
    });
  }

  function fmtDate(iso) {
    var d = new Date(iso); if (isNaN(d)) return '';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function scoreBadge(a, cls) {
    if (!a.ia) return '<span class="score ' + (cls || '') + '" title="Ainda não analisada">—</span>';
    return '<span class="score ' + esc(a.ia.aderencia) + ' ' + (cls || '') + '" title="Aderência ' + esc(a.ia.aderencia) + '">' + a.ia.nota + '</span>';
  }

  function render() {
    var items = visible();
    var pending = items.filter(function (a) { return !a.ia; });
    $('analyze-all').textContent = 'ANALISAR PENDENTES COM IA (' + pending.length + ')';
    $('analyze-all').disabled = state.busy || !pending.length || !state.iaOk;
        $('compare').hidden = state.opp === 'todas';
    $('compare').disabled = state.busy || !state.iaOk || items.filter(function (a) { return a.ia; }).length < 2;

    $('list').innerHTML = items.length ? items.map(function (a) {
      return '<button type="button" class="item" data-id="' + esc(a.id) + '" aria-current="' + (a.id === state.selected) + '">' +
        '<span class="name">' + esc(a.nome || '(sem nome)') + '</span>' + scoreBadge(a) +
        '<span class="meta"><span>' + esc(a.oportunidadeTitulo) + '</span><span>' + esc(fmtDate(a.recebidaEm)) + '</span><span class="pill">' + esc(a.status) + '</span></span>' +
        '</button>';
    }).join('') : '<div class="empty">Nenhuma candidatura com esses filtros.</div>';

    var sel = state.apps.filter(function (a) { return a.id === state.selected; })[0];
    renderDetail(sel);
  }

  $('list').addEventListener('click', function (e) {
    var b = e.target.closest('[data-id]'); if (!b) return;
    state.selected = b.getAttribute('data-id');
    $('main').classList.add('showing-detail');
    render();
    $('detail').scrollTop = 0;
    if (window.matchMedia('(max-width: 820px)').matches) window.scrollTo({ top: $('main').offsetTop - 60 });
  });

  var SIT = { 'atende': ['ok', '✓ atende'], 'parcial': ['part', '◐ parcial'], 'não atende': ['no', '✗ não atende'], 'não informado': ['na', '? não informado'] };

  function renderIa(a) {
    if (!a.ia) {
      return '<p class="note">Esta candidatura ainda não foi analisada pela IA.</p>' +
        '<div class="row" style="margin-top:10px"><button class="btn btn-gold" type="button" data-analyze' + (state.iaOk && !state.busy ? '' : ' disabled') + '>ANALISAR COM IA</button></div>';
    }
    var ia = a.ia;
    var list = function (arr) { return arr && arr.length ? '<ul>' + arr.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '<p class="note">—</p>'; };
    return '<div class="ia-head">' + scoreBadge(a, 'big') + '<div><strong>Aderência ' + esc(ia.aderencia) + '</strong><p class="note" style="margin:2px 0 0">Analisada em ' + esc(fmtDate(a.iaAnalisadaEm)) + '</p></div></div>' +
      '<p style="margin:0 0 6px">' + esc(ia.resumo) + '</p>' +
      (ia.requisitos && ia.requisitos.length ? '<table class="reqs"><tbody>' + ia.requisitos.map(function (r) {
        var s = SIT[r.situacao] || ['na', r.situacao];
        return '<tr><td>' + esc(r.requisito) + '</td><td class="' + s[0] + '">' + esc(s[1]) + '</td><td>' + esc(r.evidencia) + '</td></tr>';
      }).join('') + '</tbody></table>' : '') +
      '<div class="cols"><div><p class="label">PONTOS FORTES</p>' + list(ia.pontosFortes) + '</div><div><p class="label">PONTOS DE ATENÇÃO</p>' + list(ia.pontosDeAtencao) + '</div></div>' +
      '<p class="label" style="margin-top:14px">PERGUNTAS PARA A CONVERSA</p>' + list(ia.perguntasEntrevista) +
      '<p class="note">A análise da IA é um apoio à curadoria. A decisão é sempre do time.</p>' +
      '<div class="row" style="margin-top:10px"><button class="btn btn-line" type="button" data-analyze' + (state.iaOk && !state.busy ? '' : ' disabled') + '>REANALISAR</button></div>';
  }

  function renderDetail(a) {
    var d = $('detail');
    if (!a) { d.innerHTML = '<div class="empty">Selecione uma candidatura para ver as respostas e a análise.</div>'; return; }
    d.innerHTML =
      '<button type="button" class="btn btn-line back" data-back>← Voltar à lista</button>' +
      '<h2>' + esc(a.nome) + '</h2>' +
      '<p class="opp">' + esc(a.oportunidadeTitulo) + '</p>' +
      '<p class="contact"><span>' + esc(a.email) + '</span><span>' + esc(a.whatsapp) + '</span><span>' + esc(a.cidade) + '</span><span>' + esc(a.relacao) + '</span></p>' +
      '<div class="section"><p class="label">CURADORIA</p>' +
        '<div class="row"><label for="st" class="note" style="margin:0">Status</label><select id="st" class="field" style="width:auto">' +
          state.statuses.map(function (s) { return '<option' + (s === a.status ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') +
        '</select></div>' +
        '<label for="notes" class="note" style="display:block;margin:12px 0 6px">Anotações do time</label>' +
        '<textarea id="notes" class="field">' + esc(a.notas) + '</textarea>' +
        '<div class="row" style="margin-top:10px"><button class="btn btn-gold" type="button" data-save>SALVAR</button></div>' +
      '</div>' +
      '<div class="section"><p class="label">ANÁLISE DA IA</p>' + renderIa(a) + '</div>' +
      '<div class="section"><p class="label">RESPOSTAS</p>' + a.respostas.map(function (r) {
        return '<div class="answer"><p class="q">' + esc(r.label) + '</p><p>' + (r.valor ? esc(r.valor) : '<span class="note">—</span>') + '</p></div>';
      }).join('') + '<p class="note">Recebida em ' + esc(fmtDate(a.recebidaEm)) + ' · código ' + esc(a.id) + '</p></div>';
  }

  $('detail').addEventListener('click', function (e) {
    var a = state.apps.filter(function (x) { return x.id === state.selected; })[0];
    if (!a) return;
    if (e.target.closest('[data-back]')) { $('main').classList.remove('showing-detail'); return; }
    if (e.target.closest('[data-save]')) {
      var patch = { status: $('st').value, notas: $('notes').value };
      sb.from('protagonistas_candidaturas').update(patch).eq('id', a.id).then(function (res) {
        if (res.error) throw new Error('Não foi possível salvar.');
        a.status = patch.status; a.notas = patch.notas; toast('Salvo.'); render();
      }).catch(function (err) { toast(err.message); });
    }
    if (e.target.closest('[data-analyze]')) analyzeOne(a).then(render);
  });

  function analyzeOne(a) {
    state.busy = true; render();
    $('progress').textContent = 'Analisando ' + a.nome + '…';
    return invoke({ acao: 'analisar', id: a.id }).then(function (res) {
      a.ia = res.ia; a.iaAnalisadaEm = res.ia_analisada_em;
      if (a.status === 'Nova') a.status = 'Em análise';
    }).catch(function (err) { toast(a.nome + ': ' + err.message); })
      .then(function () { state.busy = false; $('progress').textContent = ''; });
  }

  $('analyze-all').addEventListener('click', function () {
    var queue = visible().filter(function (a) { return !a.ia; });
    var i = 0;
    (function next() {
      if (i >= queue.length) { render(); toast('Análise concluída.'); return; }
      var a = queue[i++];
      analyzeOne(a).then(function () { render(); $('progress').textContent = i < queue.length ? 'Analisadas ' + i + ' de ' + queue.length + '…' : ''; next(); });
    })();
  });

  $('compare').addEventListener('click', function () {
    var box = $('compare-box');
    state.busy = true; render();
    $('progress').textContent = 'Comparando candidatos…';
    invoke({ acao: 'comparar', oportunidade: state.opp }).then(function (out) {
      box.innerHTML = '<p class="label">COMPARAÇÃO DA IA · ' + esc((opps().filter(function (o) { return o.slug === state.opp; })[0] || {}).titulo) + '</p>' +
        '<p style="margin:0">' + esc(out.recomendacao) + '</p>' +
        '<ol>' + out.ranking.map(function (r) { return '<li><strong>' + esc(r.nome) + '</strong> — ' + esc(r.justificativa) + '</li>'; }).join('') + '</ol>' +
        '<p class="note">Considera só as candidaturas já analisadas e que não estão como “Não selecionada”. A decisão é do time.</p>';
      box.hidden = false;
    }).catch(function (err) { toast(err.message); })
      .then(function () { state.busy = false; $('progress').textContent = ''; render(); });
  });

  if (!sb) showLogin('O painel ainda não está ligado ao Supabase (falta a chave no site).');
  else sb.auth.getSession().then(function (res) { if (res.data && res.data.session) enter(); else showLogin(); });
})();
