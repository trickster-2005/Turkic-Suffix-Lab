/*
 * Turkic Suffix Lab — morphology engine
 * Languages: Turkish (tr, Oghuz) · Kazakh (kk, Kipchak) · Uzbek (uz, Karluk)
 * Sakha / Yakut (sah) is intentionally disabled in this version.
 *
 * Slot order (fixed, as in all Turkic languages):
 *   STEM → NUMBER (PL) → POSSESSIVE (1SG … 3PL) → CASE (GEN ACC DAT LOC ABL)
 *
 * Every slot is a state transition: the current form + harmony state go in,
 * one allomorph is selected, and the new form + state come out. Each step
 * records machine-readable rule objects ({k, p}) that the UI turns into
 * localized explanations.
 *
 * Distractor flags (used by Practice mode to generate plausible wrong answers):
 *   flipHarmony · noAssim · noBuffer · noAlt
 */
(function (root) {
  'use strict';

  const SLOTS = {
    number: ['SG', 'PL'],
    poss: ['NONE', '1SG', '2SG', '3SG', '1PL', '2PL', '3PL'],
    case: ['NOM', 'GEN', 'ACC', 'DAT', 'LOC', 'ABL'],
  };
  const is3 = (p) => p === '3SG' || p === '3PL';
  const lastCh = (s) => s.charAt(s.length - 1);
  const S = (text) => ({ text, kind: 'suffix' });
  const B = (text) => ({ text, kind: 'buffer' });
  const joinParts = (parts) => parts.map((x) => x.text).join('');

  class Derivation {
    constructor(lang, stem) {
      this.lang = lang;
      this.stem = stem;
      this.form = stem;
      this.segs = [{ text: stem, kind: 'stem', slot: 'STEM', tag: 'STEM' }];
      this.steps = [];
      this.atStem = true;
    }
    setStem(s) {
      this.segs[0].text = s;
      this.segs[0].altered = s !== this.stem;
      this.form = s;
    }
    add(step, parts, before) {
      step.before = before;
      step.stemBefore = step.stemBefore || null;
      for (const p of parts) {
        if (!p.text) continue;
        this.segs.push({ text: p.text, kind: p.kind, slot: step.slot, tag: step.tag });
      }
      this.form = this.segs.map((x) => x.text).join('');
      step.after = this.form;
      step.surface = joinParts(parts);
      step.parts = parts.filter((p) => p.text);
      this.steps.push(step);
      this.atStem = false;
    }
  }

  /* ───────────────────────────── TURKISH ───────────────────────────── */
  const TR = (() => {
    const V = 'aeıioöuü';
    const BACK = 'aıou';
    const ROUND = 'oöuü';
    const VOICELESS = 'fstkçşhp'; // mnemonic: "fıstıkçı şahap"
    const isV = (c) => V.includes(c);
    const norm = (w) =>
      String(w || '')
        .trim()
        .toLocaleLowerCase('tr-TR')
        .replace(/â/g, 'a')
        .replace(/î/g, 'i')
        .replace(/û/g, 'u')
        .replace(/[^a-zçğıöşü]/g, '');
    const lastVowelIdx = (s) => {
      for (let i = s.length - 1; i >= 0; i--) if (isV(s[i])) return i;
      return -1;
    };
    const feat = (v) => ({ v, back: v ? BACK.includes(v) : true, round: v ? ROUND.includes(v) : false });
    const syll = (s) => [...s].filter(isV).length;
    const A = (st) => (st.back ? 'a' : 'e');
    const I = (st) => (st.back ? (st.round ? 'u' : 'ı') : st.round ? 'ü' : 'i');
    const h2 = (st, out) => ({ k: 'tr.h2', p: { v: st.v, out, back: st.back, exc: !!st.exc } });
    const h4 = (st, out) => ({ k: 'tr.h4', p: { v: st.v, out, back: st.back, round: st.round, exc: !!st.exc } });
    const next = (text, st) => {
      const i = lastVowelIdx(text);
      return i < 0 ? st : feat(text[i]);
    };
    const finalType = (c) => (!c ? null : isV(c) ? 'vowel' : VOICELESS.includes(c) ? 'voiceless' : 'voiced');

    function willVoice(entry, s) {
      const c = lastCh(s);
      const auto = syll(s) > 1 && 'pçk'.includes(c);
      return !!((entry.voicing ?? auto) && 'pçtk'.includes(c));
    }

    function traits(entry) {
      const s = norm(entry.word);
      const i = lastVowelIdx(s);
      const f = feat(i < 0 ? null : s[i]);
      const c = lastCh(s);
      return {
        stem: s,
        lastVowel: f.v,
        backness: f.v ? (f.back ? 'back' : 'front') : null,
        round: f.round,
        final: c,
        finalType: finalType(c),
        syll: syll(s),
        harmonyActive: true,
        exception: entry.harmony === 'front',
        willVoice: willVoice(entry, s),
        syncope: !!entry.syncope && syll(s) > 1,
      };
    }

    function alternate(d, entry, o, rules) {
      if (!d.atStem || o.noAlt) return;
      let s = d.form;
      if (entry.syncope && syll(s) > 1) {
        const i = lastVowelIdx(s);
        const t = s.slice(0, i) + s.slice(i + 1);
        rules.push({ k: 'tr.syncope', p: { v: s[i], from: s, to: t } });
        s = t;
      }
      if (willVoice(entry, d.stem)) {
        const c = lastCh(s);
        let to = { p: 'b', ç: 'c', t: 'd', k: 'ğ' }[c];
        if (c === 'k' && s[s.length - 2] === 'n') to = 'g';
        const t = s.slice(0, -1) + to;
        rules.push({ k: 'tr.voice', p: { from: c, to, a: s, b: t } });
        s = t;
      }
      if (s !== d.form) d.setStem(s);
    }

    function build(entry, slots, o = {}) {
      const stem = norm(entry.word);
      const d = new Derivation('tr', stem);
      if (!stem) return d;
      const i0 = lastVowelIdx(stem);
      let st = feat(i0 < 0 ? null : stem[i0]);
      if (entry.harmony === 'front') st = { ...st, back: false, exc: true };
      if (o.flipHarmony) st = { ...st, back: !st.back };
      d.initState = { ...st };
      const endsV = () => isV(lastCh(d.form));
      const excRule = (rules) => {
        if (st.exc && d.atStem) rules.push({ k: 'tr.exception', p: { w: stem } });
      };

      // NUMBER
      if (slots.number === 'PL') {
        const before = d.form;
        const rules = [];
        excRule(rules);
        const a = A(st);
        rules.push(h2(st, a));
        const parts = [S('l' + a + 'r')];
        d.add({ slot: 'NUMBER', tag: 'PL', archi: '-lAr', rules, state: null }, parts, before);
        st = next(joinParts(parts), st);
        d.steps[d.steps.length - 1].state = { ...st };
      }

      // POSSESSIVE
      if (slots.poss && slots.poss !== 'NONE') {
        const p = slots.poss;
        const before = d.form;
        const rules = [];
        excRule(rules);
        let parts;
        let archi;
        if (p === '3PL' && slots.number !== 'PL') {
          archi = '-lArI';
          const a = A(st);
          const st2 = feat(a);
          const i = I(st2);
          rules.push(h2(st, a), h4(st2, i));
          parts = [S('l' + a + 'r' + i)];
        } else if (is3(p)) {
          archi = '-(s)I';
          if (p === '3PL') {
            archi = '-I';
            rules.push({ k: 'tr.merge3pl' });
          }
          if (endsV()) {
            const i = I(st);
            if (o.noBuffer) parts = [S(i)];
            else {
              rules.push({ k: 'tr.bufS', p: { c: lastCh(d.form) } });
              parts = [B('s'), S(i)];
            }
            rules.push(h4(st, i));
          } else {
            alternate(d, entry, o, rules);
            const i = I(st);
            rules.push(h4(st, i));
            parts = [S(i)];
          }
        } else {
          const core = { '1SG': ['m', ''], '2SG': ['n', ''], '1PL': ['m', 'z'], '2PL': ['n', 'z'] }[p];
          archi = { '1SG': '-(I)m', '2SG': '-(I)n', '1PL': '-(I)mIz', '2PL': '-(I)nIz' }[p];
          const i = I(st);
          const tail = core[0] + (core[1] ? i + core[1] : '');
          if (endsV() && !o.noBuffer) {
            rules.push({ k: 'tr.dropI', p: { c: lastCh(d.form) } });
            if (core[1]) rules.push(h4(st, i));
            parts = [S(tail)];
          } else {
            if (!endsV()) alternate(d, entry, o, rules);
            rules.push(h4(st, i));
            parts = [S(i + tail)];
          }
        }
        d.add({ slot: 'POSS', tag: p, archi, rules }, parts, before);
        st = next(joinParts(parts), st);
        d.steps[d.steps.length - 1].state = { ...st };
      }

      // CASE
      if (slots.case && slots.case !== 'NOM') {
        const c = slots.case;
        const before = d.form;
        const rules = [];
        excRule(rules);
        const after3 = is3(slots.poss);
        const lc = lastCh(d.form);
        let parts;
        let archi;
        if (c === 'GEN') {
          archi = '-(n)In';
          const i = I(st);
          if (endsV()) {
            if (o.noBuffer) parts = [S(i + 'n')];
            else {
              rules.push({ k: 'tr.bufN', p: { c: lc } });
              parts = [B('n'), S(i + 'n')];
            }
          } else {
            alternate(d, entry, o, rules);
            parts = [S(i + 'n')];
          }
          rules.push(h4(st, i));
        } else if (c === 'ACC' || c === 'DAT') {
          archi = c === 'ACC' ? (after3 ? '-nI' : '-(y)I') : after3 ? '-nA' : '-(y)A';
          const v = c === 'ACC' ? I(st) : A(st);
          if (endsV()) {
            if (o.noBuffer) parts = [S(v)];
            else if (after3) {
              rules.push({ k: 'tr.pronN' });
              parts = [B('n'), S(v)];
            } else {
              rules.push({ k: 'tr.bufY', p: { c: lc } });
              parts = [B('y'), S(v)];
            }
          } else {
            alternate(d, entry, o, rules);
            parts = [S(v)];
          }
          rules.push(c === 'ACC' ? h4(st, v) : h2(st, v));
        } else {
          archi = c === 'LOC' ? (after3 ? '-ndA' : '-DA') : after3 ? '-ndAn' : '-DAn';
          let pre = [];
          let trig = lc;
          if (after3 && !o.noBuffer) {
            rules.push({ k: 'tr.pronN' });
            pre = [B('n')];
            trig = 'n';
          }
          const vl = VOICELESS.includes(trig);
          const D = vl !== !!o.noAssim ? 't' : 'd';
          rules.push({ k: 'tr.D', p: { c: trig, out: D, vl } });
          const a = A(st);
          rules.push(h2(st, a));
          parts = [...pre, S(D + a + (c === 'ABL' ? 'n' : ''))];
        }
        d.add({ slot: 'CASE', tag: c, archi, rules }, parts, before);
        st = next(joinParts(parts), st);
        d.steps[d.steps.length - 1].state = { ...st };
      }
      return d;
    }

    return { norm, traits, build, roman: (s) => s, vowelSwap: { a: 'e', e: 'a', ı: 'i', i: 'ı', u: 'ü', ü: 'u', o: 'ö', ö: 'o' } };
  })();

  /* ───────────────────────────── KAZAKH ────────────────────────────── */
  const KK = (() => {
    const VOW = 'аәеоөұүыіэяюиё';
    const BACKV = 'аоұыяё';
    const FRONTV = 'әеөүіэ';
    const ROUNDV = 'оөұүё';
    const LAT = [
      ['sh', 'ш'], ['ch', 'ч'], ['zh', 'ж'], ['ng', 'ң'],
      ['a', 'а'], ['ä', 'ә'], ['b', 'б'], ['v', 'в'], ['g', 'г'], ['ğ', 'ғ'], ['ǵ', 'ғ'], ['d', 'д'],
      ['e', 'е'], ['j', 'ж'], ['z', 'з'], ['ı', 'ы'], ['i', 'і'], ['y', 'й'], ['k', 'к'], ['q', 'қ'],
      ['l', 'л'], ['m', 'м'], ['n', 'н'], ['ñ', 'ң'], ['ŋ', 'ң'], ['o', 'о'], ['ö', 'ө'], ['p', 'п'],
      ['r', 'р'], ['s', 'с'], ['t', 'т'], ['ū', 'ұ'], ['u', 'ұ'], ['ü', 'ү'], ['w', 'у'], ['f', 'ф'],
      ['h', 'х'], ['ç', 'ч'], ['ş', 'ш'],
    ];
    const CYR = {
      а: 'a', ә: 'ä', б: 'b', в: 'v', г: 'g', ғ: 'ğ', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i',
      й: 'y', к: 'k', қ: 'q', л: 'l', м: 'm', н: 'n', ң: 'ñ', о: 'o', ө: 'ö', п: 'p', р: 'r', с: 's',
      т: 't', у: 'u', ұ: 'ū', ү: 'ü', ф: 'f', х: 'h', һ: 'h', ц: 'ts', ч: 'ç', ш: 'ş', щ: 'şş', ъ: '',
      ы: 'ı', і: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya',
    };
    const hasCyr = (s) => /[а-яёәғқңөұүһі]/.test(s);
    function latToCyr(s) {
      let out = '';
      for (let i = 0; i < s.length; ) {
        const hit = LAT.find(([l]) => s.startsWith(l, i));
        if (hit) {
          out += hit[1];
          i += hit[0].length;
        } else {
          out += s[i];
          i += 1;
        }
      }
      return out;
    }
    const roman = (s) => [...s].map((c) => (c in CYR ? CYR[c] : c)).join('');
    const norm = (w) => {
      let s = String(w || '').trim().toLowerCase();
      if (!hasCyr(s)) s = latToCyr(s);
      return s.replace(/[^а-яёәғқңөұүһі]/g, '');
    };
    const harmIdx = (s) => {
      for (let i = s.length - 1; i >= 0; i--) if (BACKV.includes(s[i]) || FRONTV.includes(s[i])) return i;
      return -1;
    };
    const vowelIdx = (s) => {
      for (let i = s.length - 1; i >= 0; i--) if (VOW.includes(s[i])) return i;
      return -1;
    };
    const feat = (v) => ({ v, back: v ? BACKV.includes(v) : true, round: v ? ROUNDV.includes(v) : false });
    const syll = (s) => [...s].filter((c) => VOW.includes(c)).length;
    function finalOf(s) {
      let i = s.length - 1;
      while (i >= 0 && 'ьъ'.includes(s[i])) i--;
      return s[i] || '';
    }
    function cls(c) {
      if (!c || VOW.includes(c)) return 'V';
      if (c === 'р') return 'R';
      if ('йу'.includes(c)) return 'G';
      if ('лжз'.includes(c)) return 'Z';
      if ('мнң'.includes(c)) return 'N';
      return 'T';
    }
    //                V    R    G    Z    N    T
    const INIT = {
      PL: { V: 'л', R: 'л', G: 'л', Z: 'д', N: 'д', T: 'т' },
      GEN: { V: 'н', R: 'д', G: 'д', Z: 'д', N: 'н', T: 'т' },
      ACC: { V: 'н', R: 'д', G: 'д', Z: 'д', N: 'д', T: 'т' },
      LOC: { V: 'д', R: 'д', G: 'д', Z: 'д', N: 'д', T: 'т' },
      ABL: { V: 'д', R: 'д', G: 'д', Z: 'д', N: 'н', T: 'т' },
    };
    const OPTS = { PL: 'л / д / т', GEN: 'н / д / т', ACC: 'н / д / т', LOC: 'д / т', ABL: 'д / н / т', DAT: 'ғ / қ · г / к' };
    const A = (st) => (st.back ? 'а' : 'е');
    const I = (st) => (st.back ? 'ы' : 'і');
    const hr = (st, out) => ({ k: 'kk.h', p: { v: st.v, out, back: st.back } });
    const next = (text, st) => {
      const i = harmIdx(text);
      return i < 0 ? st : feat(text[i]);
    };
    const finalType = (c) => {
      const k = cls(c);
      return !c ? null : k === 'V' ? 'vowel' : k === 'T' ? 'voiceless' : 'voiced';
    };
    const willVoice = (entry, s) => entry.voicing !== false && 'кқп'.includes(lastCh(s));

    function traits(entry) {
      const s = norm(entry.word);
      const i = harmIdx(s);
      const f = feat(i < 0 ? null : s[i]);
      const c = finalOf(s);
      return {
        stem: s,
        lastVowel: f.v,
        backness: f.v ? (f.back ? 'back' : 'front') : null,
        round: f.round,
        final: c,
        finalType: finalType(c),
        cls: cls(c),
        syll: syll(s),
        harmonyActive: true,
        willVoice: willVoice(entry, s),
        syncope: !!entry.syncope && syll(s) > 1,
      };
    }

    function alternate(d, entry, o, rules) {
      if (!d.atStem || o.noAlt) return;
      let s = d.form;
      if (entry.syncope && syll(s) > 1) {
        const i = vowelIdx(s);
        const t = s.slice(0, i) + s.slice(i + 1);
        rules.push({ k: 'kk.syncope', p: { v: s[i], from: s, to: t } });
        s = t;
      }
      if (willVoice(entry, s)) {
        const c = lastCh(s);
        const to = { к: 'г', қ: 'ғ', п: 'б' }[c];
        const t = s.slice(0, -1) + to;
        rules.push({ k: 'kk.voice', p: { from: c, to, a: s, b: t } });
        s = t;
      }
      if (s !== d.form) d.setStem(s);
    }

    function build(entry, slots, o = {}) {
      const stem = norm(entry.word);
      const d = new Derivation('kk', stem);
      if (!stem) return d;
      const i0 = harmIdx(stem);
      let st = feat(i0 < 0 ? null : stem[i0]);
      if (o.flipHarmony) st = { ...st, back: !st.back };
      d.initState = { ...st };
      const init = (slot, c) => (o.noAssim ? INIT[slot].V : INIT[slot][cls(c)]);
      const endsV = () => cls(finalOf(d.form)) === 'V';

      if (slots.number === 'PL') {
        const before = d.form;
        const c = finalOf(d.form);
        const x = init('PL', c);
        const a = A(st);
        const rules = [{ k: 'kk.init', p: { c, cls: cls(c), out: x, opts: OPTS.PL } }, hr(st, a)];
        const parts = [S(x + a + 'р')];
        d.add({ slot: 'NUMBER', tag: 'PL', archi: '-LAr', rules }, parts, before);
        st = next(joinParts(parts), st);
        d.steps[d.steps.length - 1].state = { ...st };
      }

      if (slots.poss && slots.poss !== 'NONE') {
        const p = slots.poss;
        const before = d.form;
        const rules = [];
        let parts;
        let archi;
        if (is3(p)) {
          archi = '-(s)I';
          if (p === '3PL') rules.push({ k: 'kk.3same' });
          const i = I(st);
          if (endsV()) {
            if (o.noBuffer) parts = [S(i)];
            else {
              rules.push({ k: 'kk.bufS', p: { c: finalOf(d.form) } });
              parts = [B('с'), S(i)];
            }
          } else {
            alternate(d, entry, o, rules);
            parts = [S(i)];
          }
          rules.push(hr(st, i));
        } else {
          const core = { '1SG': ['м', ''], '2SG': ['ң', ''], '1PL': ['м', 'з'], '2PL': ['ң', 'з'] }[p];
          archi = { '1SG': '-(I)m', '2SG': '-(I)ñ', '1PL': '-(I)mIz', '2PL': '-(I)ñIz' }[p];
          if (p === '2PL') rules.push({ k: 'kk.2pl' });
          const i = I(st);
          const tail = core[0] + (core[1] ? i + core[1] : '');
          if (endsV() && !o.noBuffer) {
            rules.push({ k: 'kk.dropI', p: { c: finalOf(d.form) } });
            parts = [S(tail)];
          } else {
            if (!endsV()) alternate(d, entry, o, rules);
            parts = [S(i + tail)];
          }
          rules.push(hr(st, i));
        }
        d.add({ slot: 'POSS', tag: p, archi, rules }, parts, before);
        st = next(joinParts(parts), st);
        d.steps[d.steps.length - 1].state = { ...st };
      }

      if (slots.case && slots.case !== 'NOM') {
        const cs = slots.case;
        const before = d.form;
        const rules = [];
        const after3 = is3(slots.poss) && !o.noBuffer;
        const after12 = (slots.poss === '1SG' || slots.poss === '2SG') && !o.noBuffer;
        const c = finalOf(d.form);
        const k = cls(c);
        const archi = { GEN: '-NIñ', ACC: '-NI', DAT: '-GA', LOC: '-DA', ABL: '-DAn' }[cs];
        const a = A(st);
        const i = I(st);
        let parts;
        if (after3 && cs !== 'GEN') {
          rules.push({ k: 'kk.pronN' });
          if (cs === 'ACC') parts = [S('н')];
          else if (cs === 'DAT') parts = [B('н'), S(a)];
          else if (cs === 'LOC') parts = [B('н'), S('д' + a)];
          else parts = [S('н' + a + 'н')];
          if (cs !== 'ACC') rules.push(hr(st, a));
        } else if (cs === 'DAT') {
          if (after12) {
            rules.push({ k: 'kk.dat12', p: { c, out: a } });
            parts = [S(a)];
          } else {
            const vl = (k === 'T') !== !!o.noAssim;
            const g = vl ? (st.back ? 'қ' : 'к') : st.back ? 'ғ' : 'г';
            rules.push({ k: 'kk.init', p: { c, cls: k, out: g, opts: OPTS.DAT } });
            parts = [S(g + a)];
          }
          rules.push(hr(st, a));
        } else {
          const x = init(cs, c);
          rules.push({ k: 'kk.init', p: { c, cls: k, out: x, opts: OPTS[cs] } });
          const v = cs === 'GEN' || cs === 'ACC' ? i : a;
          rules.push(hr(st, v));
          parts = [S(cs === 'GEN' ? x + i + 'ң' : cs === 'ACC' ? x + i : cs === 'LOC' ? x + a : x + a + 'н')];
        }
        d.add({ slot: 'CASE', tag: cs, archi, rules }, parts, before);
        st = next(joinParts(parts), st);
        d.steps[d.steps.length - 1].state = { ...st };
      }
      return d;
    }

    return { norm, traits, build, roman, latToCyr, cls, vowelSwap: { а: 'е', е: 'а', ы: 'і', і: 'ы' } };
  })();

  /* ───────────────────────────── UZBEK ─────────────────────────────── */
  const UZ = (() => {
    const VOW = ['a', 'e', 'i', 'o', 'u', "o'"];
    const FEAT = {
      a: { bk: 'central', round: false },
      e: { bk: 'front', round: false },
      i: { bk: 'front', round: false },
      o: { bk: 'back', round: true },
      u: { bk: 'back', round: true },
      "o'": { bk: 'back', round: true },
    };
    const VOICELESS = ['p', 't', 'k', 'q', 's', 'sh', 'ch', 'f', 'h', 'x'];
    const norm = (w) =>
      String(w || '')
        .trim()
        .toLowerCase()
        .replace(/[ʻʼ’‘`´]/g, "'")
        .replace(/[^a-z']/g, '');
    const toks = (s) => {
      const out = [];
      for (let i = 0; i < s.length; i++) {
        const two = s.slice(i, i + 2);
        if (["o'", "g'", 'sh', 'ch'].includes(two)) {
          out.push(two);
          i++;
        } else out.push(s[i]);
      }
      return out;
    };
    const isV = (t) => VOW.includes(t);
    const lastTok = (s) => {
      const t = toks(s);
      return t[t.length - 1] || '';
    };
    const syll = (s) => toks(s).filter(isV).length;
    const lastVowel = (s) => {
      const t = toks(s);
      for (let i = t.length - 1; i >= 0; i--) if (isV(t[i])) return t[i];
      return null;
    };
    const finalType = (t) => (!t ? null : isV(t) ? 'vowel' : VOICELESS.includes(t) ? 'voiceless' : 'voiced');
    const willVoice = (entry, s) => {
      const t = lastTok(s);
      const auto = syll(s) > 1 && (t === 'k' || t === 'q');
      return !!((entry.voicing ?? auto) && (t === 'k' || t === 'q'));
    };

    function traits(entry) {
      const s = norm(entry.word);
      const v = lastVowel(s);
      const t = lastTok(s);
      return {
        stem: s,
        lastVowel: v,
        backness: v ? FEAT[v].bk : null,
        round: v ? FEAT[v].round : false,
        final: t,
        finalType: finalType(t),
        syll: syll(s),
        harmonyActive: false,
        willVoice: willVoice(entry, s),
        syncope: !!entry.syncope && syll(s) > 1,
      };
    }

    function alternate(d, entry, o, rules) {
      if (!d.atStem || o.noAlt) return;
      let s = d.form;
      if (entry.syncope && syll(s) > 1) {
        const t = toks(s);
        let i = t.length - 1;
        while (i >= 0 && !isV(t[i])) i--;
        const v = t[i];
        t.splice(i, 1);
        const n = t.join('');
        rules.push({ k: 'uz.syncope', p: { v, from: s, to: n } });
        s = n;
      }
      if (willVoice(entry, d.stem)) {
        const c = lastTok(s);
        const to = c === 'k' ? 'g' : "g'";
        const n = s.slice(0, -1) + to;
        rules.push({ k: 'uz.voice', p: { from: c, to, a: s, b: n } });
        s = n;
      }
      if (s !== d.form) d.setStem(s);
    }

    function build(entry, slots, o = {}) {
      const stem = norm(entry.word);
      const d = new Derivation('uz', stem);
      if (!stem) return d;
      const v0 = lastVowel(stem);
      d.initState = { v: v0, back: v0 ? FEAT[v0].bk === 'back' : true, round: v0 ? FEAT[v0].round : false };
      // Distractor: pretend Uzbek still had front/back harmony (a → e)
      const H = (t) => (o.flipHarmony ? t.replace(/a/g, 'e') : t);
      const endsV = () => isV(lastTok(d.form));
      const inv = (out) => ({ k: 'uz.inv', p: { out, v: v0 } });

      if (slots.number === 'PL') {
        const before = d.form;
        const t = H('lar');
        d.add({ slot: 'NUMBER', tag: 'PL', archi: '-lar', rules: [inv('-lar')] }, [S(t)], before);
      }

      if (slots.poss && slots.poss !== 'NONE') {
        const p = slots.poss;
        const before = d.form;
        const rules = [];
        let parts;
        let archi;
        if (p === '3PL' && slots.number !== 'PL') {
          archi = '-lari';
          rules.push(inv('-lari'));
          parts = [S(H('lari'))];
        } else if (is3(p)) {
          archi = '-(s)i';
          if (p === '3PL') {
            archi = '-i';
            rules.push({ k: 'uz.merge3pl' });
          }
          if (endsV()) {
            if (o.noBuffer) parts = [S('i')];
            else {
              rules.push({ k: 'uz.bufS', p: { c: lastTok(d.form) } });
              parts = [B('s'), S('i')];
            }
          } else {
            alternate(d, entry, o, rules);
            parts = [S('i')];
          }
          rules.push(inv('-(s)i'));
        } else {
          const base = { '1SG': 'm', '2SG': 'ng', '1PL': 'miz', '2PL': 'ngiz' }[p];
          archi = '-(i)' + base;
          if (endsV() && !o.noBuffer) {
            rules.push({ k: 'uz.dropI', p: { c: lastTok(d.form) } });
            parts = [S(base)];
          } else {
            if (!endsV()) alternate(d, entry, o, rules);
            parts = [S('i' + base)];
          }
          rules.push(inv(archi));
        }
        d.add({ slot: 'POSS', tag: p, archi, rules }, parts, before);
      }

      if (slots.case && slots.case !== 'NOM') {
        const cs = slots.case;
        const before = d.form;
        const rules = [];
        const archi = { GEN: '-ning', ACC: '-ni', DAT: '-ga', LOC: '-da', ABL: '-dan' }[cs];
        if (is3(slots.poss)) rules.push({ k: 'uz.noN' });
        let parts;
        if (cs === 'DAT') {
          const t = lastTok(d.form);
          if (!o.noAssim && t === 'k') {
            rules.push({ k: 'uz.datKQ', p: { c: 'k', out: 'ka' } });
            parts = [S('ka')];
          } else if (!o.noAssim && t === 'q') {
            rules.push({ k: 'uz.datKQ', p: { c: 'q', out: 'qa' } });
            parts = [S('qa')];
          } else if (!o.noAssim && t === "g'" && d.atStem) {
            const n = d.form.slice(0, -2) + 'q';
            d.setStem(n);
            rules.push({ k: 'uz.gq', p: { a: before, b: n } });
            parts = [S('qa')];
          } else {
            rules.push(inv('-ga'));
            parts = [S(H('ga'))];
          }
        } else {
          rules.push(inv(archi));
          parts = [S(H(archi.slice(1)))];
        }
        d.add({ slot: 'CASE', tag: cs, archi, rules }, parts, before);
      }
      return d;
    }

    return { norm, traits, build, toks, roman: (s) => s, vowelSwap: { a: 'e', e: 'a', i: 'u', u: 'i' } };
  })();

  /* ───────────────────────────── API ───────────────────────────────── */
  const ENGINES = { tr: TR, kk: KK, uz: UZ };
  const LANGS = ['tr', 'kk', 'uz'];

  function derive(lang, entry, slots, o) {
    return ENGINES[lang].build(entry || {}, slots || {}, o || {});
  }
  function traits(lang, entry) {
    return ENGINES[lang].traits(entry || {});
  }
  function roman(lang, s) {
    return ENGINES[lang].roman(s);
  }
  function norm(lang, s) {
    return ENGINES[lang].norm(s);
  }

  function shuffle(a, rnd = Math.random) {
    const x = a.slice();
    for (let i = x.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [x[i], x[j]] = [x[j], x[i]];
    }
    return x;
  }

  /** Plausible wrong answers built by switching individual rules off. */
  function distractors(lang, entry, slots, n = 3) {
    const good = derive(lang, entry, slots);
    const correct = good.form;
    const flagsets = [
      { flipHarmony: 1 }, { noAssim: 1 }, { noBuffer: 1 }, { noAlt: 1 },
      { flipHarmony: 1, noAssim: 1 }, { flipHarmony: 1, noBuffer: 1 },
      { noAlt: 1, noAssim: 1 }, { noBuffer: 1, noAssim: 1 }, { flipHarmony: 1, noAlt: 1 },
    ];
    const out = new Set();
    for (const f of shuffle(flagsets)) {
      const x = derive(lang, entry, slots, f).form;
      if (x && x !== correct) out.add(x);
    }
    // Fallback: swap one vowel inside the suffix area
    const swap = ENGINES[lang].vowelSwap;
    const stemLen = good.segs[0].text.length;
    for (let k = correct.length - 1; k >= stemLen && out.size < n + 2; k--) {
      const ch = correct[k];
      if (swap[ch]) out.add(correct.slice(0, k) + swap[ch] + correct.slice(k + 1));
    }
    return shuffle([...out]).slice(0, n);
  }

  /* ───────────────────────── ANALYZER (reverse) ──────────────────────
   * Analysis by synthesis: every candidate stem is run through all 84
   * slot combinations and the generated form is compared with the input,
   * so the analyzer reuses every generation rule instead of re-encoding
   * them backwards. Stages, in priority order:
   *   1. known stems (lexicon / current Builder entry), exact match
   *   2. known stems, match only with one rule switched off → diagnosis
   *   3. guessed stems (prefixes of the input, with alternations undone)
   */
  const ALL_SLOTS = [];
  for (const number of SLOTS.number)
    for (const poss of SLOTS.poss) for (const kase of SLOTS.case) ALL_SLOTS.push({ number, poss, case: kase });
  const VSET = { tr: 'aeıioöuü', kk: 'аәеоөұүыіэяюиё', uz: ['a', 'e', 'i', 'o', 'u', "o'"] };
  const isVow = (lang, t) => VSET[lang].includes(t);
  const segsOf = (lang, s) => (lang === 'uz' ? UZ.toks(s) : [...s]);
  const suffixCount = (s) => (s.number === 'PL') + (s.poss !== 'NONE') + (s.case !== 'NOM');

  // Undo final-consonant softening: kitab- → kitap, кітаб- → кітап, yurag- → yurak, toq- → tog'
  function unsoften(lang, p) {
    const c = lastCh(p);
    const out = [];
    const swap = (to, flags) => out.push({ word: p.slice(0, -1) + to, ...flags });
    if (lang === 'tr') {
      const m = { b: 'p', c: 'ç', ğ: 'k', d: 't' }[c];
      if (m) swap(m, { voicing: true });
      else if (c === 'g' && p[p.length - 2] === 'n') swap('k', { voicing: true });
    } else if (lang === 'kk') {
      const m = { б: 'п', г: 'к', ғ: 'қ' }[c];
      if (m) swap(m, { voicing: true });
    } else {
      if (p.endsWith("g'")) out.push({ word: p.slice(0, -2) + 'q', voicing: true });
      else if (c === 'g') swap('k', { voicing: true });
      else if (c === 'q') swap("g'", {});
    }
    return out;
  }

  // Undo vowel drop: ağz- → ağız, ауз- → ауыз, og'z- → og'iz
  function unsyncope(lang, segs) {
    const n = segs.length;
    if (n < 3 || isVow(lang, segs[n - 1]) || isVow(lang, segs[n - 2])) return null;
    const head = segs.slice(0, -1).join('');
    const t = traits(lang, { word: head });
    if (!t.lastVowel) return null;
    const hv = lang === 'tr' ? (t.backness === 'back' ? (t.round ? 'u' : 'ı') : t.round ? 'ü' : 'i') : lang === 'kk' ? (t.backness === 'back' ? 'ы' : 'і') : 'i';
    return { word: head + hv + segs[n - 1], syncope: true };
  }

  function guessStems(lang, w) {
    const S = segsOf(lang, w);
    const out = [];
    for (let i = 2; i <= S.length; i++) {
      const part = S.slice(0, i);
      if (!part.some((t) => isVow(lang, t))) continue;
      const p = part.join('');
      out.push({ word: p });
      out.push(...unsoften(lang, p));
      const sy = unsyncope(lang, part);
      if (sy) out.push(sy);
    }
    return out;
  }

  // Walk number → possessor → case, pruning branches whose partial form cannot
  // lead to the target (the last 2 letters may still change: kitap → kitab-ım).
  function* combos(lang, entry, target) {
    const ok = (f) => !target || entry.syncope || target.startsWith(f.slice(0, -2));
    for (const number of SLOTS.number) {
      if (!ok(derive(lang, entry, { number, poss: 'NONE', case: 'NOM' }).form)) continue;
      for (const poss of SLOTS.poss) {
        if (poss !== 'NONE' && !ok(derive(lang, entry, { number, poss, case: 'NOM' }).form)) continue;
        for (const kase of SLOTS.case) yield { number, poss, case: kase };
      }
    }
  }

  function exactMatches(lang, w, cands, seen, out) {
    for (const c of cands) {
      for (const slots of combos(lang, c.entry, w)) {
        const d = derive(lang, c.entry, slots);
        if (d.form !== w) continue;
        const key = [lang, c.known, norm(lang, c.entry.word), slots.number, slots.poss, slots.case].join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ lang, entry: c.entry, ref: c.ref, known: c.known, slots, n: suffixCount(slots), d });
      }
    }
  }

  // Compare the typed word with a correct form: ≤ 2 substitutions or 1 missing/extra letter.
  function nearMiss(w, f) {
    if (w.length === f.length) {
      const pos = [];
      for (let i = 0; i < f.length; i++) if (w[i] !== f[i]) pos.push(i);
      return pos.length && pos.length <= 2 && f.length >= 4 ? { dist: pos.length, subs: pos.map((i) => [i, w[i], f[i]]), indel: null } : null;
    }
    if (Math.abs(w.length - f.length) !== 1 || f.length < 3) return null;
    const [a, b] = w.length > f.length ? [w, f] : [f, w];
    let i = 0;
    while (i < b.length && a[i] === b[i]) i++;
    if (a.slice(i + 1) !== b.slice(i)) return null;
    return { dist: 1, subs: [], indel: { i, extra: w.length > f.length, ch: a[i] } };
  }

  // Which rule does a wrong letter point to? Decided by the segment it falls in.
  function classify(lang, d, m) {
    const at = (i) => {
      let k = 0;
      for (const s of d.segs) {
        if (i < k + s.text.length) return s;
        k += s.text.length;
      }
      return d.segs[d.segs.length - 1];
    };
    const kinds = new Set();
    for (const [i, typed, right] of m.subs) {
      const s = at(i);
      if (s.kind === 'stem') {
        if (!s.altered) return null; // a different stem, not a suffix error
        kinds.add('stem');
      } else if (s.kind === 'buffer') kinds.add('buffer');
      else if (isVow(lang, typed) && isVow(lang, right)) kinds.add(lang === 'uz' ? 'uzinv' : 'harmony');
      else if (!isVow(lang, typed) && !isVow(lang, right)) kinds.add('assim');
      else kinds.add('spelling');
    }
    if (m.indel) {
      const s = at(Math.min(m.indel.i, d.form.length - 1));
      if (s.kind === 'stem' && m.indel.i < d.segs[0].text.length - 1) {
        if (!s.altered) return null;
        kinds.add('stem');
      } else kinds.add('buffer');
    }
    return [...kinds];
  }

  function nearMatches(lang, w, cands, out) {
    for (const c of cands) {
      for (const slots of ALL_SLOTS) {
        const d = derive(lang, c.entry, slots);
        const m = nearMiss(w, d.form);
        if (!m) continue;
        const kinds = classify(lang, d, m);
        if (!kinds) continue;
        out.push({ lang, entry: c.entry, ref: c.ref, known: true, slots, n: suffixCount(slots), d, diag: { kinds, dist: m.dist, typed: w, subs: m.subs, indel: m.indel } });
      }
    }
  }

  function guessLangs(input) {
    const s = String(input || '').toLowerCase();
    if (/[а-яёәғқңөұүһі]/.test(s)) return { all: ['kk'], guess: ['kk'] };
    if (/[çğıöşü]/.test(s)) return { all: ['tr'], guess: ['tr'] };
    if (/['ʻʼ’‘`]|[qx]/.test(s)) return { all: ['uz', 'kk'], guess: ['uz'] };
    return { all: ['tr', 'uz', 'kk'], guess: ['tr', 'uz'] };
  }

  /**
   * @param input  the word to analyse (any language, any script)
   * @param known  { tr: [{entry, ref}], kk: [...], uz: [...] } stems treated as real words
   * @returns { mode: 'known' | 'diag' | 'guess' | 'none', results: [...] }
   */
  function analyze(input, known = {}) {
    const langs = guessLangs(input);
    const words = {};
    for (const l of langs.all) words[l] = norm(l, input);
    const seen = new Set();
    const knownCands = (l) => {
      const w = words[l];
      return (known[l] || [])
        .filter((k) => {
          const s = norm(l, k.entry.word);
          return s && w.startsWith(s.slice(0, 2));
        })
        .map((k) => ({ ...k, known: true }));
    };

    // 1. known stems, exact
    let res = [];
    for (const l of langs.all) if (words[l]) exactMatches(l, words[l], knownCands(l), seen, res);
    if (res.length) return { mode: 'known', results: res.sort((a, b) => a.n - b.n) };

    // 2. known stems, near miss → diagnose the broken rule
    for (const l of langs.all) if (words[l]) nearMatches(l, words[l], knownCands(l), res);
    if (res.length) {
      const best = Math.min(...res.map((x) => x.diag.dist));
      return {
        mode: 'diag',
        results: res.filter((x) => x.diag.dist === best).sort((a, b) => (a.diag.indel ? 1 : 0) - (b.diag.indel ? 1 : 0) || b.n - a.n),
      };
    }

    // 3. guessed stems (only languages the spelling points to); keep the fullest splits
    for (const l of langs.guess) {
      const w = words[l];
      if (!w) continue;
      const exact = [];
      exactMatches(l, w, guessStems(l, w).map((entry) => ({ entry, known: false })), seen, exact);
      const best = exact.reduce((m, x) => Math.max(m, x.n), 0);
      if (best > 0) res.push(...exact.filter((x) => x.n === best));
    }
    return { mode: res.length ? 'guess' : 'none', results: res };
  }

  const Engine = { SLOTS, LANGS, derive, traits, roman, norm, distractors, shuffle, analyze, latToCyr: KK.latToCyr, kkClass: KK.cls };
  root.TurkicEngine = Engine;
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
