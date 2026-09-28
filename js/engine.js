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

    return { norm, traits, build, roman: (s) => s, vowelSwap: { a: 'e', e: 'a', i: 'u', u: 'i' } };
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

  const Engine = { SLOTS, LANGS, derive, traits, roman, norm, distractors, shuffle, latToCyr: KK.latToCyr, kkClass: KK.cls };
  root.TurkicEngine = Engine;
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
