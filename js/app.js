/* Turkic Suffix Lab — UI */
(function () {
  'use strict';

  const E = window.TurkicEngine;
  const LEX = window.TurkicLexicon;
  const { UI, RULES, LESSONS, CLS } = window.TurkicI18n;
  const LANGS = E.LANGS;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const store = {
    get(k) {
      try {
        return localStorage.getItem(k);
      } catch (e) {
        return null;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, v);
      } catch (e) {
        /* storage unavailable */
      }
    },
  };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  const DEFAULT_SLOTS = { number: 'PL', poss: '1SG', case: 'LOC' };
  const KB = { tr: ['ç', 'ğ', 'ı', 'ö', 'ş', 'ü'], kk: ['ә', 'ғ', 'қ', 'ң', 'ө', 'ұ', 'ү', 'һ', 'і'], uz: ["o'", "g'", 'sh', 'ch'] };
  const SLOT_VAR = { NUMBER: 'num', POSS: 'poss', CASE: 'case', STEM: 'stem' };
  const POSS_LIST = E.SLOTS.poss;
  const CASE_LIST = E.SLOTS.case;
  const EX_SLOTS = [
    ['PL', { number: 'PL', poss: 'NONE', case: 'NOM' }, 'NUMBER'],
    ['1SG', { number: 'SG', poss: '1SG', case: 'NOM' }, 'POSS'],
    ['3SG', { number: 'SG', poss: '3SG', case: 'NOM' }, 'POSS'],
    ['GEN', { number: 'SG', poss: 'NONE', case: 'GEN' }, 'CASE'],
    ['ACC', { number: 'SG', poss: 'NONE', case: 'ACC' }, 'CASE'],
    ['DAT', { number: 'SG', poss: 'NONE', case: 'DAT' }, 'CASE'],
    ['LOC', { number: 'SG', poss: 'NONE', case: 'LOC' }, 'CASE'],
    ['ABL', { number: 'SG', poss: 'NONE', case: 'ABL' }, 'CASE'],
  ];

  const conceptById = (id) => LEX.find((c) => c.id === id) || LEX[1];
  const entriesFor = (id) => {
    const c = conceptById(id);
    return { tr: { ...c.tr }, kk: { ...c.kk }, uz: { ...c.uz } };
  };

  const state = {
    ui: store.get('tsl-ui') === 'zh' ? 'zh' : 'en',
    theme: store.get('tsl-theme') === 'light' ? 'light' : 'dark',
    tab: 'builder',
    concept: 'house',
    custom: false,
    entries: entriesFor('house'),
    slots: { ...DEFAULT_SLOTS },
    langs: { tr: true, kk: true, uz: true },
    para: { lang: 'tr', number: 'SG' },
    explorer: 'PL',
    quiz: { langs: { tr: true, kk: true, uz: true }, level: 2, score: 0, total: 0, streak: 0, best: Number(store.get('tsl-best')) || 0, q: null, picked: null },
  };

  /* ───────────── i18n helpers ───────────── */
  const t = (k) => (UI[state.ui] && UI[state.ui][k] != null ? UI[state.ui][k] : UI.en[k] != null ? UI.en[k] : k);
  const H = {
    t: (x) => `<mark class="t">${esc(x)}</mark>`,
    o: (x) => `<mark class="o">${esc(x)}</mark>`,
  };
  const ruleHTML = (r) => {
    const f = (RULES[state.ui] || RULES.en)[r.k];
    return f ? f(r.p || {}, H) : esc(r.k);
  };
  const conceptLabel = (c) => (state.ui === 'zh' ? c.zh : c.en);

  function meaning(c, slots) {
    const pl = slots.number === 'PL';
    const hasPoss = slots.poss && slots.poss !== 'NONE';
    if (state.ui === 'zh') {
      const noun = (state.custom ? '［詞幹］' : c.zh.split('／')[0]) + (pl ? '（複數）' : '');
      const np = (hasPoss ? UI.zh.poss_word[slots.poss] : '') + noun;
      return { NOM: np, GEN: np + '的', ACC: np + '（特指受詞）', DAT: '往／給' + np, LOC: '在' + np, ABL: '從' + np }[slots.case];
    }
    const base = state.custom ? (pl ? '[stem]s' : '[stem]') : pl ? c.enPl : c.en.split(' / ')[0];
    const np = hasPoss ? UI.en.poss_word[slots.poss] + ' ' + base : slots.case === 'NOM' ? base : 'the ' + base;
    return { NOM: np, GEN: 'of ' + np, ACC: np + ' (definite object)', DAT: 'to ' + np, LOC: 'in / at ' + np, ABL: 'from ' + np }[slots.case];
  }

  /* ───────────── Morpheme rendering ───────────── */
  function segsHTML(d, lang, roman) {
    return d.segs
      .map((s) => {
        const txt = roman ? E.roman(lang, s.text) : s.text;
        const cls = s.kind === 'stem' ? 'seg stem' + (s.altered ? ' altered' : '') : 'seg ' + s.slot + (s.kind === 'buffer' ? ' buffer' : '');
        return `<span class="${cls}">${esc(txt)}</span>`;
      })
      .join('');
  }
  const partsHTML = (s) =>
    '-' + s.parts.map((p) => (p.kind === 'buffer' ? `<span class="seg buffer">${esc(p.text)}</span>` : esc(p.text))).join('');

  function glossHTML(d, c) {
    const groups = [];
    for (const s of d.segs) {
      const g = groups[groups.length - 1];
      if (g && g.slot === s.slot && s.slot !== 'STEM') g.text += s.text;
      else groups.push({ slot: s.slot, tag: s.tag, text: s.text });
    }
    const top = groups.map((g) => `<span class="seg ${g.slot === 'STEM' ? 'stem' : g.slot}">${esc(g.text)}</span>`).join('<span class="sep">-</span>');
    const stemGloss = state.custom ? 'STEM' : conceptLabel(c).split(/ \/ |／/)[0];
    const bottom = groups.map((g) => (g.slot === 'STEM' ? esc(stemGloss) : `<span class="tag">${g.tag}</span>`)).join('-');
    return `${top}<br>${bottom}`;
  }

  function chainHTML(d) {
    const s0 = d.segs[0];
    let html = `<div class="block STEM${s0.altered ? ' altered' : ''}"><span class="bt">${esc(t('slot_STEM'))}</span>${
      s0.altered ? `<span class="ba">${esc(d.stem)} →</span>` : ''
    }<span class="bs">${esc(s0.text)}</span></div>`;
    for (const s of d.steps) {
      html += `<span class="plus" aria-hidden="true">+</span><div class="block ${s.slot}"><span class="bt">${s.tag}</span><span class="ba">${esc(
        s.archi
      )}</span><span class="bs">${s.parts.map((p) => (p.kind === 'buffer' ? `<span class="buf">${esc(p.text)}</span>` : esc(p.text))).join('')}</span></div>`;
    }
    return html;
  }

  function stepsHTML(d) {
    if (!d.steps.length) return `<p class="empty">${esc(t('nothingSelected'))}</p>`;
    return `<ol class="steps">${d.steps
      .map(
        (s) => `<li class="step ${s.slot}">
          <div class="sh"><span class="tag" style="color:var(--c-${SLOT_VAR[s.slot]})">${s.tag}</span><span class="arch">${esc(
            s.archi
          )}</span><span class="arrow">→</span><span class="surf">${partsHTML(s)}</span></div>
          <ul>${s.rules.map((r) => `<li>${ruleHTML(r)}</li>`).join('')}</ul>
        </li>`
      )
      .join('')}</ol>`;
  }

  function traitsHTML(lang, tr) {
    const ui = state.ui;
    const changes = [];
    if (tr.exception) changes.push(t('flag_exception'));
    if (tr.syncope) changes.push(t('flag_syncope'));
    if (tr.willVoice) changes.push(t('flag_voicing'));
    const items = [
      [t('lastVowel'), tr.lastVowel ? `<span class="mono">${esc(tr.lastVowel)}</span>` : '—'],
      [t('backness'), tr.backness ? esc(t(tr.backness)) : '—'],
      [t('rounding'), tr.lastVowel ? esc(t(tr.round ? 'rounded' : 'unrounded')) : '—'],
      [t('finalSeg'), tr.final ? `<span class="mono">${esc(tr.final)}</span> · ${esc(t(tr.finalType))}` : '—'],
      [t('syllables'), tr.syll],
      lang === 'kk' ? [t('kkClass'), esc(CLS[ui][tr.cls])] : [t('stemChange'), changes.length ? esc(changes.join(', ')) : '—'],
    ];
    let note = '';
    if (lang === 'uz') note = t('harmonyOff');
    else if (lang === 'kk') note = t('kkRoundNote');
    return `<div class="traits">${items.map(([k, v]) => `<div class="trait"><div class="k">${esc(k)}</div><div class="v">${v}</div></div>`).join('')}</div>${
      note ? `<p class="trait-note">${esc(note)}</p>` : ''
    }`;
  }

  /* ───────────── Static text & chrome ───────────── */
  function applyStatic() {
    document.documentElement.lang = state.ui === 'zh' ? 'zh-Hant-TW' : 'en';
    document.documentElement.dataset.theme = state.theme;
    $$('[data-t]').forEach((el) => {
      el.textContent = t(el.dataset.t);
    });
    const lb = $('#btn-lang');
    lb.textContent = t('langToggle');
    lb.title = t('langToggleTitle');
    $('#btn-theme').title = t('themeTitle');
    $$('.tabs [data-tab]').forEach((b) => {
      const on = b.dataset.tab === state.tab;
      b.setAttribute('aria-selected', on);
      b.tabIndex = on ? 0 : -1;
    });
    $$('.panel').forEach((p) => {
      p.hidden = p.id !== 'panel-' + state.tab;
    });
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = state.theme === 'dark' ? '#0e1120' : '#f5f6fb';
  }

  /* ───────────── Builder: controls ───────────── */
  function renderConcepts() {
    const groups = ['core', 'alt', 'special'];
    $('#concepts').innerHTML = groups
      .map(
        (g) => `<div class="concept-group"><h3>${esc(t('group_' + g))}</h3><div class="chips">${LEX.filter((c) => c.group === g)
          .map(
            (c) =>
              `<button type="button" class="chip concept" data-concept="${c.id}" aria-pressed="${!state.custom && state.concept === c.id}"><span class="w">${esc(
                c.tr.word
              )}</span><small>${esc(conceptLabel(c))}</small></button>`
          )
          .join('')}</div></div>`
      )
      .join('');
  }

  function flagsHTML(lang) {
    const en = state.entries[lang];
    const tr = E.traits(lang, en);
    const canVoice = E.traits(lang, { ...en, voicing: true }).willVoice;
    let html = `<label><input type="checkbox" data-flag="syncope" data-lang="${lang}" ${tr.syncope ? 'checked' : ''} ${tr.syll < 2 ? 'disabled' : ''}>${esc(
      t('flag_syncope')
    )}</label><label><input type="checkbox" data-flag="voicing" data-lang="${lang}" ${tr.willVoice ? 'checked' : ''} ${canVoice ? '' : 'disabled'}>${esc(
      t('flag_voicing')
    )}</label>`;
    if (lang === 'tr')
      html += `<label><input type="checkbox" data-flag="harmony" data-lang="tr" ${en.harmony === 'front' ? 'checked' : ''}>${esc(t('flag_exception'))}</label>`;
    return html;
  }

  function renderStemInputs() {
    $('#stem-inputs').innerHTML = LANGS.map((l) => {
      const en = state.entries[l];
      const romanLine = l === 'kk' ? `<small data-roman="kk">${esc(E.roman('kk', E.norm('kk', en.word)))}</small>` : `<small>${esc(t('br_' + l))}</small>`;
      return `<div class="stem-field${state.langs[l] ? '' : ' off'}">
        <label for="in-${l}"><span>${esc(t(l))}</span>${romanLine}</label>
        <input type="text" id="in-${l}" data-lang="${l}" value="${esc(en.word)}" placeholder="${esc(t('emptyStem'))}" autocomplete="off" autocapitalize="off" spellcheck="false" ${
        l === 'kk' ? 'lang="kk"' : l === 'tr' ? 'lang="tr"' : 'lang="uz"'
      }>
        <div class="kb" aria-label="${esc(t('kbHint'))}">${KB[l].map((k) => `<button type="button" data-kb="${esc(k)}" data-lang="${l}">${esc(k)}</button>`).join('')}</div>
        <div class="flags" data-flags="${l}">${flagsHTML(l)}</div>
        ${l === 'kk' ? `<p class="note">${esc(t('romanNote'))}</p>` : ''}
      </div>`;
    }).join('');
  }

  function renderSlots() {
    const s = state.slots;
    const row = (slot, key, values, label) =>
      `<div class="slot-row"><div class="slot-label"><span class="dot ${slot}"></span>${esc(t('slot_' + slot))}</div><div class="chips">${values
        .map((v) => `<button type="button" class="chip slot-${slot}" data-slot="${key}" data-val="${v}" aria-pressed="${s[key] === v}">${label(v)}</button>`)
        .join('')}</div></div>`;
    $('#slots').innerHTML =
      row('NUMBER', 'number', ['SG', 'PL'], (v) => esc(t(v))) +
      row('POSS', 'poss', POSS_LIST, (v) => (v === 'NONE' ? esc(t('NONE')) : `${esc(t(v))} <small>${v}</small>`)) +
      row('CASE', 'case', CASE_LIST, (v) => `${esc(t(v))} <small>${esc(t(v + '_s'))}</small>`);
  }

  function renderLangToggles() {
    $('#lang-toggles').innerHTML =
      LANGS.map(
        (l) =>
          `<button type="button" class="lang-toggle" data-toggle-lang="${l}" aria-pressed="${state.langs[l]}"><span class="sw"></span><span><span class="nm">${esc(
            t(l)
          )}</span><br><span class="br">${esc(t('br_' + l))}</span></span></button>`
      ).join('') +
      `<button type="button" class="lang-toggle" disabled aria-pressed="false" title="${esc(t('sahOff'))}"><span class="sw"></span><span><span class="nm">${esc(
        t('sah')
      )}</span><br><span class="br">${esc(t('sahOff'))}</span></span></button>`;
  }

  /* ───────────── Builder: results ───────────── */
  function renderResults() {
    const c = conceptById(state.concept);
    const active = LANGS.filter((l) => state.langs[l]);
    const data = active.map((l) => ({ l, d: E.derive(l, state.entries[l], state.slots), tr: E.traits(l, state.entries[l]) }));

    const legend = [
      ['seg stem', 'ev', 'legend_stem'],
      ['seg stem altered', 'kitab', 'legend_alt'],
      ['seg NUMBER', 'ler', 'slot_NUMBER'],
      ['seg POSS', 'im', 'slot_POSS'],
      ['seg CASE', 'de', 'slot_CASE'],
      ['seg buffer', 'y', 'legend_buffer'],
    ]
      .map(([cls, ex, k]) => `<span><span class="${cls}">${ex}</span>${esc(t(k))}</span>`)
      .join('');

    const summary = `<div class="card"><div class="summary"><div><div class="label">${esc(t('meaning'))}</div><div class="meaning">${esc(
      meaning(c, state.slots)
    )}</div></div><button type="button" class="btn small" id="btn-share">🔗 ${esc(t('share'))}</button></div>
      <div class="legend">${legend}<span>${H.t('a')}${esc(t('legend_trig'))}</span><span>${H.o('e')}${esc(t('legend_out'))}</span></div></div>`;

    const chains = `<div class="card"><div class="sub-h">${esc(t('chainTitle'))}</div><div style="display:grid;gap:12px">${data
      .map(
        ({ l, d }) => `<div><div class="note" style="margin-bottom:5px;font-weight:600">${esc(t(l))}</div><div class="chain">${
          d.stem ? chainHTML(d) : `<span class="empty">${esc(t('emptyStem'))}</span>`
        }</div></div>`
      )
      .join('')}</div></div>`;

    const cards = `<div class="lang-cards">${data
      .map(({ l, d, tr }) => {
        if (!d.stem)
          return `<article class="card lang-card"><header><span class="nm">${esc(t(l))}</span></header><p class="empty">${esc(t('emptyStem'))}</p></article>`;
        const badge = l === 'uz' ? 'warn' : 'good';
        return `<article class="card lang-card">
          <header><span class="nm">${esc(t(l))} <span class="muted" style="font-weight:500;font-size:12.5px">· ${esc(t('br_' + l))}</span></span><span class="badge ${badge}">${esc(
          t('badge_' + l)
        )}</span></header>
          <div><div class="word big">${segsHTML(d, l)}</div>${l === 'kk' ? `<div class="roman">${segsHTML(d, l, true)}</div>` : ''}</div>
          <div><div class="sub-h">${esc(t('gloss'))}</div><div class="gloss">${glossHTML(d, c)}</div></div>
          <div><div class="sub-h">${esc(t('traitsTitle'))}</div>${traitsHTML(l, tr)}</div>
          <div><div class="sub-h">${esc(t('stepsTitle'))}</div>${stepsHTML(d)}</div>
        </article>`;
      })
      .join('')}</div>`;

    const rows = [['slot_STEM', 'STEM'], ['slot_NUMBER', 'NUMBER'], ['slot_POSS', 'POSS'], ['slot_CASE', 'CASE'], ['row_result', 'RESULT']].filter(
      ([, k]) => k === 'STEM' || k === 'RESULT' || data.some(({ d }) => d.steps.some((s) => s.slot === k))
    );
    const cell = (d, k, l) => {
      if (!d.stem) return '—';
      if (k === 'STEM') return `<span class="seg stem${d.segs[0].altered ? ' altered' : ''}">${esc(d.segs[0].text)}</span>`;
      if (k === 'RESULT') return `<span class="word">${segsHTML(d, l)}</span>${l === 'kk' ? `<span class="rom">${esc(E.roman('kk', d.form))}</span>` : ''}`;
      const s = d.steps.find((x) => x.slot === k);
      return s ? `<span class="mono seg ${k}">${partsHTML(s)}</span> <span class="muted mono" style="font-size:11.5px">${esc(s.archi)}</span>` : '—';
    };
    const table = `<div class="card"><div class="sub-h">${esc(t('compareTitle'))}</div><div class="table-wrap"><table class="cmp"><thead><tr><th></th>${data
      .map(({ l }) => `<th>${esc(t(l))}</th>`)
      .join('')}</tr></thead><tbody>${rows
      .map(([lab, k]) => `<tr><th scope="row">${esc(t(lab))}</th>${data.map(({ l, d }) => `<td>${cell(d, k, l)}</td>`).join('')}</tr>`)
      .join('')}</tbody></table></div></div>`;

    $('#results').innerHTML = active.length ? summary + chains + cards + table : `<div class="card"><p class="empty">—</p></div>`;
    $('#live-bar').innerHTML = `<span class="lb-forms">${data
      .map(({ l, d }) => `<span class="lb-item"><small>${l.toUpperCase()}</small><span class="word">${d.stem ? segsHTML(d, l) : '—'}</span></span>`)
      .join('')}</span><span class="lb-go" aria-hidden="true">↓</span>`;
    $('#live-bar').setAttribute('aria-label', t('stepsTitle'));
  }

  /* Sticky mini-result on narrow screens, hidden once the real results are on screen */
  let resultsVisible = false;
  function updateLiveBar() {
    const narrow = window.matchMedia('(max-width: 1080px)').matches;
    $('#live-bar').hidden = !(narrow && state.tab === 'builder' && !resultsVisible);
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      resultsVisible = entries.some((e) => e.isIntersecting);
      updateLiveBar();
    }, { rootMargin: '0px 0px -35% 0px' }).observe(document.getElementById('results'));
  }
  window.addEventListener('resize', updateLiveBar);

  /* ───────────── Paradigms & explorer ───────────── */
  function langChips(attr, current) {
    return LANGS.map((l) => `<button type="button" class="chip" ${attr}="${l}" aria-pressed="${current === l}">${esc(t(l))}</button>`).join('');
  }

  function renderParadigm() {
    const P = state.para;
    const opts = LEX.map((c) => `<option value="${c.id}" ${!state.custom && c.id === state.concept ? 'selected' : ''}>${esc(c.tr.word)} · ${esc(conceptLabel(c))}</option>`).join('');
    $('#paradigm-controls').innerHTML = `
      <div class="group"><span class="label">${esc(t('concept'))}</span><select id="para-concept" class="select">${
        state.custom ? `<option value="" selected>✎ ${esc(state.entries.tr.word)} / ${esc(state.entries.kk.word)} / ${esc(state.entries.uz.word)}</option>` : ''
      }${opts}</select></div>
      <div class="group"><span class="label">${esc(t('langsTitle'))}</span>${langChips('data-para-lang', P.lang)}</div>
      <div class="group"><span class="label">${esc(t('slot_NUMBER'))}</span>${['SG', 'PL']
        .map((n) => `<button type="button" class="chip slot-NUMBER" data-para-num="${n}" aria-pressed="${P.number === n}">${esc(t(n))}</button>`)
        .join('')}</div>`;

    const l = P.lang;
    const en = state.entries[l];
    const head = `<tr><th>${esc(t('slot_CASE'))} \\ ${esc(t('slot_POSS'))}</th>${POSS_LIST.map(
      (p) => `<th>${p === 'NONE' ? '∅' : `${esc(t(p))}<span class="rom">${p}</span>`}</th>`
    ).join('')}</tr>`;
    const body = CASE_LIST.map(
      (cs) =>
        `<tr><th scope="row">${esc(t(cs))}<span class="rom">${esc(t(cs + '_s'))}</span></th>${POSS_LIST.map((p) => {
          const d = E.derive(l, en, { number: P.number, poss: p, case: cs });
          const cur = state.slots.number === P.number && state.slots.poss === p && state.slots.case === cs;
          return `<td class="cell${cur ? ' current' : ''}" data-cell-poss="${p}" data-cell-case="${cs}" tabindex="0">${d.stem ? segsHTML(d, l) : '—'}${
            l === 'kk' && d.stem ? `<span class="rom">${esc(E.roman('kk', d.form))}</span>` : ''
          }</td>`;
        }).join('')}</tr>`
    ).join('');
    $('#paradigm-table').innerHTML = `<div class="table-wrap"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
  }

  function renderExplorer() {
    $('#explorer-controls').innerHTML = `<div class="group">${EX_SLOTS.map(
      ([k, , slot]) =>
        `<button type="button" class="chip slot-${slot}" data-ex="${k}" aria-pressed="${state.explorer === k}">${k} <small>${esc(
          slot === 'NUMBER' ? t('PL') : slot === 'POSS' ? t(k) : t(k)
        )}</small></button>`
    ).join('')}</div>`;
    const [key, slots, slotName] = EX_SLOTS.find((x) => x[0] === state.explorer);
    const active = LANGS.filter((l) => state.langs[l]);
    $('#explorer').innerHTML = `<div class="explorer">${active
      .map((l) => {
        const groups = new Map();
        for (const c of LEX) {
          const d = E.derive(l, c[l], slots);
          const st = d.steps.find((s) => s.slot === slotName);
          if (!st) continue;
          const allo = '-' + st.surface;
          if (!groups.has(allo)) groups.set(allo, []);
          groups.get(allo).push(`<span class="word" title="${esc(conceptLabel(c))}">${segsHTML(d, l)}</span>`);
        }
        const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
        return `<div class="ex-lang"><h3>${esc(t(l))} <span class="badge">${sorted.length} ${esc(t('forms'))}</span></h3>${sorted
          .map(
            ([allo, words]) =>
              `<div class="ex-group ${slotName}"><div><span class="allo">${esc(allo)}</span>${
                l === 'kk' ? ` <span class="muted mono" style="font-size:12px">${esc(E.roman('kk', allo))}</span>` : ''
              } <span class="muted" style="font-size:12px">× ${words.length}</span></div><div class="words">${words.join('')}</div></div>`
          )
          .join('')}</div>`;
      })
      .join('')}</div>`;
    void key;
  }

  /* ───────────── Practice ───────────── */
  function randomSlots(level) {
    const which = E.shuffle(['number', 'poss', 'case']).slice(0, level);
    return {
      number: which.includes('number') ? 'PL' : 'SG',
      poss: which.includes('poss') ? pick(POSS_LIST.slice(1)) : 'NONE',
      case: which.includes('case') ? pick(CASE_LIST.slice(1)) : 'NOM',
    };
  }

  function newQuestion() {
    const Q = state.quiz;
    let langs = LANGS.filter((l) => Q.langs[l]);
    if (!langs.length) langs = LANGS.slice();
    let q = null;
    for (let i = 0; i < 25; i++) {
      const lang = pick(langs);
      const c = pick(LEX);
      const slots = randomSlots(Q.level);
      const d = E.derive(lang, c[lang], slots);
      const ds = E.distractors(lang, c[lang], slots, 3);
      q = { lang, c, slots, d, options: E.shuffle([d.form, ...ds]) };
      if (ds.length >= 3 || (i > 15 && ds.length >= 2)) break;
    }
    Q.q = q;
    Q.picked = null;
  }

  function answer(i) {
    const Q = state.quiz;
    if (!Q.q || Q.picked != null) return;
    Q.picked = i;
    Q.total++;
    if (Q.q.options[i] === Q.q.d.form) {
      Q.score++;
      Q.streak++;
      if (Q.streak > Q.best) {
        Q.best = Q.streak;
        store.set('tsl-best', String(Q.best));
      }
    } else Q.streak = 0;
    renderPractice();
    const next = $('#btn-next');
    if (next) next.focus({ preventScroll: true });
  }

  function renderPractice() {
    const Q = state.quiz;
    $('#practice-controls').innerHTML = `
      <div class="group"><span class="label">${esc(t('langsTitle'))}</span>${LANGS.map(
        (l) => `<button type="button" class="chip" data-q-lang="${l}" aria-pressed="${Q.langs[l]}">${esc(t(l))}</button>`
      ).join('')}</div>
      <div class="group"><span class="label">${esc(t('difficulty'))}</span>${[1, 2, 3]
        .map((n) => `<button type="button" class="chip" data-q-level="${n}" aria-pressed="${Q.level === n}">${n}</button>`)
        .join('')}</div>`;
    $('#scoreboard').innerHTML = [
      [t('score'), `${Q.score}/${Q.total}`],
      [t('streak'), Q.streak],
      [t('best'), Q.best],
    ]
      .map(([k, v]) => `<div class="stat"><div class="n">${esc(v)}</div><div class="k">${esc(k)}</div></div>`)
      .join('');

    if (!Q.q) newQuestion();
    const q = Q.q;
    const done = Q.picked != null;
    const stemWord = q.d.stem;
    const blocks = [];
    if (q.slots.number === 'PL') blocks.push(['NUMBER', 'PL', t('PL')]);
    if (q.slots.poss !== 'NONE') blocks.push(['POSS', q.slots.poss, t(q.slots.poss)]);
    if (q.slots.case !== 'NOM') blocks.push(['CASE', q.slots.case, t(q.slots.case)]);
    const prevCustom = state.custom;
    state.custom = false;
    const mean = meaning(q.c, q.slots);
    state.custom = prevCustom;

    const opts = q.options
      .map((o, i) => {
        let cls = 'option';
        if (done && o === q.d.form) cls += ' right';
        else if (done && i === Q.picked) cls += ' wrong';
        return `<button type="button" class="${cls}" data-answer="${i}" ${done ? 'disabled' : ''}><span class="kbd">${i + 1}</span><span>${esc(o)}${
          q.lang === 'kk' ? `<span class="rom">${esc(E.roman('kk', o))}</span>` : ''
        }</span></button>`;
      })
      .join('');

    const ok = done && q.options[Q.picked] === q.d.form;
    const fb = done
      ? `<div class="feedback ${ok ? 'ok' : 'no'}">${ok ? esc(t('correct')) : `${esc(t('wrong'))} <span class="word">${segsHTML(q.d, q.lang)}</span>`}</div>
         <div><div class="sub-h">${esc(t('showWhy'))}</div><div class="chain" style="margin-bottom:12px">${chainHTML(q.d)}</div>${stepsHTML(q.d)}</div>`
      : '';

    $('#quiz').innerHTML = `<div class="card quiz-q">
      <div class="quiz-meta"><span class="badge">${esc(t(q.lang))} · ${esc(t('br_' + q.lang))}</span><span class="badge">${esc(conceptLabel(q.c))}</span></div>
      <div class="quiz-prompt"><span class="block STEM"><span class="bs">${esc(stemWord)}</span></span>${blocks
        .map(([slot, tag, lab]) => `<span class="plus">+</span><span class="block ${slot}"><span class="bt">${tag}</span><span class="ba">${esc(lab)}</span></span>`)
        .join('')}<span class="plus">=</span><span class="muted">?</span></div>
      <p class="muted">${esc(t('meaning'))}: <b style="color:var(--text)">${esc(mean)}</b>${q.lang === 'kk' ? ` · <span class="mono">${esc(E.roman('kk', stemWord))}</span>` : ''}</p>
      <div class="sub-h" style="margin:0">${esc(t('question'))}</div>
      <div class="options">${opts}</div>
      ${fb}
      <div class="quiz-foot"><span class="note">${esc(t('keys'))}</span>${
        done ? `<button type="button" class="btn primary" id="btn-next">${esc(t('next'))} →</button>` : ''
      }</div>
    </div>`;
  }

  /* ───────────── Grammar ───────────── */
  const VOWEL_EX = { i: 'dil', ü: 'gün', ı: 'kız', u: 'kuş', e: 'ev', ö: 'göz', a: 'at', o: 'yol' };
  const KK_EQ = { i: 'і', ü: 'ү', ı: 'ы', u: 'ұ', e: 'е', ö: 'ө', a: 'а', o: 'о' };
  let selectedVowel = 'e';

  function renderGrammar() {
    const cols = [
      [t('front'), t('unrounded')],
      [t('front'), t('rounded')],
      [t('back'), t('unrounded')],
      [t('back'), t('rounded')],
    ];
    const rows = [
      [t('vc_high'), ['i', 'ü', 'ı', 'u']],
      [t('vc_low'), ['e', 'ö', 'a', 'o']],
    ];
    const grid = `<div class="vgrid"><span></span>${cols.map(([a, b]) => `<span class="hd">${esc(a)}<br>${esc(b)}</span>`).join('')}${rows
      .map(([lab, vs]) => `<span class="rh">${esc(lab)}</span>${vs.map((v) => `<button type="button" class="vbtn" data-vowel="${v}" aria-pressed="${v === selectedVowel}">${v}</button>`).join('')}`)
      .join('')}</div>`;
    const v = selectedVowel;
    const word = VOWEL_EX[v];
    const f = (slots) => E.derive('tr', { word }, slots);
    const pl = f({ number: 'PL', poss: 'NONE', case: 'NOM' });
    const loc = f({ number: 'SG', poss: 'NONE', case: 'LOC' });
    const my = f({ number: 'SG', poss: '1SG', case: 'NOM' });
    const back = 'aıou'.includes(v);
    const A = back ? 'a' : 'e';
    const I = { a: 'ı', ı: 'ı', o: 'u', u: 'u', e: 'i', i: 'i', ö: 'ü', ü: 'ü' }[v];
    const result = `<div class="vresult">
      <div class="row"><span class="k">${esc(t('vc_A'))}</span><span class="v">A → ${H.o(A)} · ${segsHTML(pl, 'tr')}, ${segsHTML(loc, 'tr')}</span></div>
      <div class="row"><span class="k">${esc(t('vc_I'))}</span><span class="v">I → ${H.o(I)} · ${segsHTML(my, 'tr')}</span></div>
      <div class="row"><span class="k">${esc(t('vc_kk'))} (${KK_EQ[v]})</span><span class="v">A → ${H.o(back ? 'а' : 'е')} · I → ${H.o(back ? 'ы' : 'і')}</span></div>
      <div class="row"><span class="k">${esc(t('vc_uz'))}</span><span class="v">-lar · -(i)m · -da</span></div>
    </div>`;
    $('#vowel-chart').innerHTML = grid + result;

    $('#lessons').innerHTML = (LESSONS[state.ui] || LESSONS.en)
      .map(
        (l) => `<article class="card lesson"><span class="ic" aria-hidden="true">${l.icon}</span><h3>${esc(l.title)}</h3><p>${esc(l.body)}</p>${
          l.ex.length ? `<div class="ex">${l.ex.map(([a, b]) => `<div><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join('')}</div>` : ''
        }</article>`
      )
      .join('');
  }

  /* ───────────── Code & trace ───────────── */
  function highlightTS(src) {
    const re = /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|('(?:\\.|[^'\\\n])*')|\b(const|type|interface|export|function|return|if|let|as|Record|import|from)\b|\b(\d+)\b/g;
    let out = '';
    let last = 0;
    let m;
    while ((m = re.exec(src))) {
      out += esc(src.slice(last, m.index));
      const cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'k' : 'n';
      out += `<span class="${cls}">${esc(m[0])}</span>`;
      last = re.lastIndex;
    }
    return out + esc(src.slice(last));
  }

  function renderCode() {
    const active = LANGS.filter((l) => state.langs[l]);
    const stateTxt = (l, st) => {
      if (l === 'uz' || !st) return 'harmony: n/a';
      return `V=${st.v || '–'} ${st.back ? '+back' : '−back'} ${st.round ? '+round' : '−round'}`;
    };
    $('#trace').innerHTML = `<div class="trace">${active
      .map((l) => {
        const d = E.derive(l, state.entries[l], state.slots);
        if (!d.stem) return '';
        let html = `<div class="state"><div class="sid">S0 · STEM</div><div class="sf">${esc(d.stem)}</div><div class="sv">${esc(stateTxt(l, d.initState))}</div></div>`;
        d.steps.forEach((s, i) => {
          html += `<div class="edge"><span>${s.tag}</span><span class="arr">→</span><span>${esc(s.archi)}⇒-${esc(s.surface)}</span></div><div class="state"><div class="sid">S${
            i + 1
          } · ${s.slot}</div><div class="sf">${esc(s.after)}</div><div class="sv">${esc(stateTxt(l, s.state))}</div></div>`;
        });
        return `<div class="trace-lang"><h3>${esc(t(l))}</h3><div class="fsm">${html}</div></div>`;
      })
      .join('')}</div>`;
    const code = $('#code-block');
    if (!code.dataset.done) {
      code.innerHTML = highlightTS(window.TurkicSnippet || '');
      code.dataset.done = '1';
    }
  }

  /* ───────────── URL state ───────────── */
  function writeHash() {
    const p = new URLSearchParams();
    p.set('tab', state.tab);
    if (state.custom) LANGS.forEach((l) => p.set(l, state.entries[l].word));
    else p.set('c', state.concept);
    p.set('n', state.slots.number);
    p.set('p', state.slots.poss);
    p.set('k', state.slots.case);
    const off = LANGS.filter((l) => !state.langs[l]);
    if (off.length) p.set('off', off.join('.'));
    try {
      history.replaceState(null, '', '#' + p.toString());
    } catch (e) {
      /* sandboxed */
    }
  }

  function readHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    if (['builder', 'paradigm', 'practice', 'grammar', 'code'].includes(p.get('tab'))) state.tab = p.get('tab');
    if (p.get('c') && LEX.some((c) => c.id === p.get('c'))) {
      state.concept = p.get('c');
      state.custom = false;
      state.entries = entriesFor(state.concept);
    } else if (LANGS.some((l) => p.has(l))) {
      state.custom = true;
      LANGS.forEach((l) => {
        if (p.has(l)) state.entries[l] = { word: p.get(l) };
      });
    }
    if (E.SLOTS.number.includes(p.get('n'))) state.slots.number = p.get('n');
    if (POSS_LIST.includes(p.get('p'))) state.slots.poss = p.get('p');
    if (CASE_LIST.includes(p.get('k'))) state.slots.case = p.get('k');
    state.langs = { tr: true, kk: true, uz: true };
    (p.get('off') || '').split('.').forEach((l) => {
      if (LANGS.includes(l)) state.langs[l] = false;
    });
  }

  /* ───────────── Render orchestration ───────────── */
  function renderBuilder(full = true) {
    if (full) {
      renderConcepts();
      renderStemInputs();
      renderSlots();
      renderLangToggles();
    }
    renderResults();
  }

  function renderTab() {
    if (state.tab === 'builder') renderBuilder();
    else if (state.tab === 'paradigm') {
      renderParadigm();
      renderExplorer();
    } else if (state.tab === 'practice') renderPractice();
    else if (state.tab === 'grammar') renderGrammar();
    else if (state.tab === 'code') renderCode();
  }

  function renderAll() {
    applyStatic();
    renderTab();
    writeHash();
    updateLiveBar();
  }

  function setTab(tab) {
    state.tab = tab;
    renderAll();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function selectConcept(id) {
    state.concept = id;
    state.custom = false;
    state.entries = entriesFor(id);
  }

  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 1600);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch (err) {
        /* ignore */
      }
      ta.remove();
    }
    toast(t('copied'));
  }

  /* ───────────── Events ───────────── */
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('button, td.cell');
    if (!el) return;
    const ds = el.dataset;

    if (ds.tab) return setTab(ds.tab);
    if (el.id === 'btn-lang') {
      state.ui = state.ui === 'en' ? 'zh' : 'en';
      store.set('tsl-ui', state.ui);
      return renderAll();
    }
    if (el.id === 'btn-theme') {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      store.set('tsl-theme', state.theme);
      return applyStatic();
    }
    if (el.id === 'btn-share') return copyText(location.href);
    if (el.id === 'live-bar') {
      const top = $('#results').getBoundingClientRect().top + window.scrollY - 120;
      return window.scrollTo({ top, behavior: 'smooth' });
    }
    if (el.id === 'btn-copy-code') return copyText(window.TurkicSnippet || '');
    if (el.id === 'btn-random') {
      selectConcept(pick(LEX).id);
      state.slots = randomSlots(1 + Math.floor(Math.random() * 3));
      return renderAll();
    }
    if (el.id === 'btn-reset') {
      selectConcept('house');
      state.slots = { ...DEFAULT_SLOTS };
      state.langs = { tr: true, kk: true, uz: true };
      return renderAll();
    }
    if (ds.concept) {
      selectConcept(ds.concept);
      return renderAll();
    }
    if (ds.slot) {
      state.slots[ds.slot] = ds.val;
      renderSlots();
      renderResults();
      return writeHash();
    }
    if (ds.toggleLang) {
      const l = ds.toggleLang;
      const on = LANGS.filter((x) => state.langs[x]);
      if (state.langs[l] && on.length === 1) return; // keep at least one language
      state.langs[l] = !state.langs[l];
      return renderAll();
    }
    if (ds.kb) {
      const input = $('#in-' + ds.lang);
      const s = input.selectionStart ?? input.value.length;
      const e = input.selectionEnd ?? input.value.length;
      input.value = input.value.slice(0, s) + ds.kb + input.value.slice(e);
      input.focus();
      input.setSelectionRange(s + ds.kb.length, s + ds.kb.length);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    if (ds.paraLang) {
      state.para.lang = ds.paraLang;
      return renderParadigm();
    }
    if (ds.paraNum) {
      state.para.number = ds.paraNum;
      return renderParadigm();
    }
    if (ds.cellPoss) {
      state.slots = { number: state.para.number, poss: ds.cellPoss, case: ds.cellCase };
      state.langs[state.para.lang] = true;
      return setTab('builder');
    }
    if (ds.ex) {
      state.explorer = ds.ex;
      return renderExplorer();
    }
    if (ds.qLang) {
      const Q = state.quiz;
      const on = LANGS.filter((x) => Q.langs[x]);
      if (Q.langs[ds.qLang] && on.length === 1) return;
      Q.langs[ds.qLang] = !Q.langs[ds.qLang];
      newQuestion();
      return renderPractice();
    }
    if (ds.qLevel) {
      state.quiz.level = Number(ds.qLevel);
      newQuestion();
      return renderPractice();
    }
    if (ds.answer != null) return answer(Number(ds.answer));
    if (el.id === 'btn-next') {
      newQuestion();
      renderPractice();
      const first = $('[data-answer="0"]');
      if (first) first.focus({ preventScroll: true });
      return;
    }
    if (ds.vowel) {
      selectedVowel = ds.vowel;
      return renderGrammar();
    }
  });

  document.addEventListener('input', (ev) => {
    const el = ev.target;
    if (el.matches('input[type="text"][data-lang]')) {
      const l = el.dataset.lang;
      state.entries[l] = { word: el.value };
      state.custom = true;
      const rom = $('[data-roman="kk"]');
      if (l === 'kk' && rom) rom.textContent = E.roman('kk', E.norm('kk', el.value));
      $(`[data-flags="${l}"]`).innerHTML = flagsHTML(l);
      $$('.chip.concept').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      renderResults();
      writeHash();
    }
  });

  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.dataset.flag) {
      const en = state.entries[el.dataset.lang];
      if (el.dataset.flag === 'syncope') en.syncope = el.checked;
      if (el.dataset.flag === 'voicing') en.voicing = el.checked;
      if (el.dataset.flag === 'harmony') en.harmony = el.checked ? 'front' : undefined;
      state.custom = true;
      renderResults();
      return writeHash();
    }
    if (el.id === 'para-concept' && el.value) {
      selectConcept(el.value);
      renderParadigm();
      return writeHash();
    }
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.target.matches('input, select, textarea')) return;
    // Tab list arrow navigation
    if (ev.target.closest('.tabs') && (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft')) {
      const tabs = $$('.tabs [data-tab]');
      const i = tabs.findIndex((b) => b.dataset.tab === state.tab);
      const n = tabs[(i + (ev.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      setTab(n.dataset.tab);
      $(`.tabs [data-tab="${n.dataset.tab}"]`).focus();
      return;
    }
    if (ev.target.matches('td.cell') && (ev.key === 'Enter' || ev.key === ' ')) {
      ev.preventDefault();
      ev.target.click();
      return;
    }
    if (state.tab !== 'practice') return;
    if (/^[1-4]$/.test(ev.key) && state.quiz.picked == null) {
      const i = Number(ev.key) - 1;
      if (state.quiz.q && i < state.quiz.q.options.length) answer(i);
    } else if (ev.key === 'Enter' && state.quiz.picked != null && !ev.target.closest('button')) {
      ev.preventDefault();
      const n = $('#btn-next');
      if (n) n.click();
    }
  });

  window.addEventListener('hashchange', () => {
    readHash();
    renderAll();
  });

  /* ───────────── Boot ───────────── */
  readHash();
  renderAll();
})();
