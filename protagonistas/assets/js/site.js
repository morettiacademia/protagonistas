// Programa Protagonistas — interações do site estático.
(function () {
  'use strict';

  var endpoint = document.body.getAttribute('data-endpoint') || '';
  var norm = function (s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  };

  // ---------- Filtros (mural e histórias) + busca ----------
  function setupFilters(name, itemSelector, dataAttr, allLabel) {
    var group = document.querySelector('[data-filter-group="' + name + '"]');
    var target = document.querySelector('[data-filter-target="' + name + '"]');
    if (!group || !target) return;
    var empty = document.querySelector('[data-empty="' + name + '"]');
    var search = document.querySelector('[data-search-input="' + name + '"]');
    var items = Array.prototype.slice.call(target.querySelectorAll(itemSelector));
    var current = allLabel;

    function apply() {
      var q = search ? norm(search.value.trim()) : '';
      var shown = 0;
      items.forEach(function (el) {
        var tags = (el.getAttribute(dataAttr) || '').split('|');
        var okFilter = current === allLabel || tags.indexOf(current) !== -1;
        var okSearch = !q || norm(el.getAttribute('data-search')).indexOf(q) !== -1;
        var visible = okFilter && okSearch;
        el.hidden = !visible;
        if (visible) shown++;
      });
      if (empty) empty.hidden = shown !== 0;
    }

    group.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-filter]');
      if (!btn) return;
      current = btn.getAttribute('data-filter');
      group.querySelectorAll('[data-filter]').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b === btn));
      });
      apply();
    });
    if (search) search.addEventListener('input', apply);
    apply();
  }

  setupFilters('opps', '.opp-card', 'data-cats', 'TODAS');
  setupFilters('stories', '.person-card', 'data-tags', 'Todos');

  // ---------- Formulários ----------
  function collect(form) {
    var respostas = [];
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.type === 'submit') return;
      respostas.push({ campo: el.name, label: el.getAttribute('data-label') || el.name, valor: el.value });
    });
    return respostas;
  }

  function criteria(form) {
    var el = form.querySelector('script[data-criteria]');
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (e) { return null; }
  }

  // Envia como text/plain: é uma requisição "simples" (sem preflight CORS),
  // o formato que o Google Apps Script aceita vindo de outro domínio.
  function send(payload) {
    if (!endpoint) return Promise.resolve();
    return fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json().catch(function () { return { ok: true }; });
    }).then(function (data) {
      if (data && data.ok === false) throw new Error(data.erro || 'falha');
    });
  }

  document.querySelectorAll('form[data-form]').forEach(function (form) {
    var kind = form.getAttribute('data-form');
    var error = form.querySelector('.form-error');
    var submit = form.querySelector('[type="submit"]');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      if (error) error.hidden = true;
      submit.disabled = true;

      send({
        tipo: kind,
        oportunidade: form.getAttribute('data-opp') || null,
        oportunidadeTitulo: form.getAttribute('data-opp-title') || null,
        criterios: criteria(form),
        pagina: location.href,
        enviadoEm: new Date().toISOString(),
        respostas: collect(form),
      })
        .then(function () {
          if (kind === 'candidatura') {
            var wrap = document.querySelector('[data-apply-form]');
            var ok = document.querySelector('[data-apply-success]');
            if (wrap) wrap.hidden = true;
            if (ok) {
              ok.hidden = false;
              ok.focus({ preventScroll: true });
              ok.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            var float = document.querySelector('[data-float-apply]');
            if (float) float.hidden = true;
            var asideBtn = document.querySelector('.opp-aside a[href="#candidatura"]');
            if (asideBtn) asideBtn.hidden = true;
          } else {
            form.hidden = true;
            var msg = form.parentElement.querySelector('.done-msg');
            if (msg) msg.hidden = false;
          }
        })
        .catch(function () {
          if (error) error.hidden = false;
        })
        .then(function () {
          submit.disabled = false;
        });
    });
  });

  // ---------- Nav: destaque das âncoras da home ----------
  var spyLinks = document.querySelectorAll('.nav-links [data-spy]');
  if (spyLinks.length) {
    var mark = function (id) {
      spyLinks.forEach(function (a) {
        if (a.getAttribute('data-spy') === id) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
    };
    var sections = ['como-funciona', 'quem-protagoniza']
      .map(function (id) { return document.getElementById(id); })
      .filter(Boolean);
    var onScroll = function () {
      var y = 90;
      var active = 'top';
      sections.forEach(function (sec) {
        var r = sec.getBoundingClientRect();
        if (r.top <= y && r.bottom > y) active = sec.id;
      });
      mark(active);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
})();
