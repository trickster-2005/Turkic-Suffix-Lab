// Golden-form tests for the morphology engine. Run: node tests/engine.test.js
'use strict';
const E = require('../js/engine.js');
const LEX = require('../js/data.js');

const lex = Object.fromEntries(LEX.map((c) => [c.id, c]));
let pass = 0;
let fail = 0;

// [lang, concept, number, poss, case, expected]
const CASES = [
  // ── Turkish ──
  ['tr', 'cart', 'PL', 'NONE', 'NOM', 'arabalar'],
  ['tr', 'cart', 'SG', '1SG', 'NOM', 'arabam'],
  ['tr', 'cart', 'SG', 'NONE', 'LOC', 'arabada'],
  ['tr', 'cart', 'SG', 'NONE', 'ABL', 'arabadan'],
  ['tr', 'cart', 'SG', 'NONE', 'ACC', 'arabayı'],
  ['tr', 'cart', 'SG', 'NONE', 'DAT', 'arabaya'],
  ['tr', 'cart', 'SG', 'NONE', 'GEN', 'arabanın'],
  ['tr', 'cart', 'SG', '3SG', 'NOM', 'arabası'],
  ['tr', 'cart', 'SG', '3SG', 'LOC', 'arabasında'],
  ['tr', 'cart', 'SG', '3SG', 'DAT', 'arabasına'],
  ['tr', 'cart', 'SG', '3SG', 'GEN', 'arabasının'],
  ['tr', 'cart', 'PL', '1SG', 'LOC', 'arabalarımda'],
  ['tr', 'house', 'PL', '1SG', 'LOC', 'evlerimde'],
  ['tr', 'house', 'SG', '1PL', 'ABL', 'evimizden'],
  ['tr', 'house', 'SG', '3PL', 'NOM', 'evleri'],
  ['tr', 'house', 'PL', '3PL', 'NOM', 'evleri'],
  ['tr', 'house', 'SG', '3SG', 'ACC', 'evini'],
  ['tr', 'house', 'SG', '2PL', 'NOM', 'eviniz'],
  ['tr', 'road', 'SG', '1SG', 'NOM', 'yolum'],
  ['tr', 'road', 'SG', 'NONE', 'ABL', 'yoldan'],
  ['tr', 'eye', 'SG', '1SG', 'NOM', 'gözüm'],
  ['tr', 'eye', 'PL', 'NONE', 'LOC', 'gözlerde'],
  ['tr', 'head', 'SG', 'NONE', 'LOC', 'başta'],
  ['tr', 'head', 'SG', 'NONE', 'ABL', 'baştan'],
  ['tr', 'book', 'SG', '1SG', 'NOM', 'kitabım'],
  ['tr', 'book', 'SG', 'NONE', 'DAT', 'kitaba'],
  ['tr', 'book', 'SG', 'NONE', 'LOC', 'kitapta'],
  ['tr', 'heart', 'SG', '1SG', 'NOM', 'yüreğim'],
  ['tr', 'child', 'SG', '3SG', 'NOM', 'çocuğu'],
  ['tr', 'tree', 'SG', '1SG', 'NOM', 'ağacım'],
  ['tr', 'tree', 'SG', 'NONE', 'ABL', 'ağaçtan'],
  ['tr', 'horse', 'SG', '1SG', 'NOM', 'atım'],
  ['tr', 'village', 'SG', '1SG', 'NOM', 'köyüm'],
  ['tr', 'village', 'SG', 'NONE', 'DAT', 'köye'],
  ['tr', 'mountain', 'SG', 'NONE', 'DAT', 'dağa'],
  ['tr', 'mouth', 'SG', '1SG', 'NOM', 'ağzım'],
  ['tr', 'mouth', 'SG', 'NONE', 'DAT', 'ağza'],
  ['tr', 'mouth', 'PL', 'NONE', 'NOM', 'ağızlar'],
  ['tr', 'hour', 'PL', 'NONE', 'NOM', 'saatler'],
  ['tr', 'hour', 'SG', '1SG', 'NOM', 'saatim'],
  ['tr', 'hour', 'SG', 'NONE', 'LOC', 'saatte'],
  ['tr', 'mother', 'SG', '3SG', 'NOM', 'annesi'],
  ['tr', 'mother', 'SG', 'NONE', 'DAT', 'anneye'],
  // ── Kazakh ──
  ['kk', 'cart', 'PL', 'NONE', 'NOM', 'арбалар'],
  ['kk', 'house', 'PL', 'NONE', 'NOM', 'үйлер'],
  ['kk', 'road', 'PL', 'NONE', 'NOM', 'жолдар'],
  ['kk', 'eye', 'PL', 'NONE', 'NOM', 'көздер'],
  ['kk', 'book', 'PL', 'NONE', 'NOM', 'кітаптар'],
  ['kk', 'day', 'PL', 'NONE', 'NOM', 'күндер'],
  ['kk', 'house', 'SG', '1SG', 'NOM', 'үйім'],
  ['kk', 'cart', 'SG', '1SG', 'NOM', 'арбам'],
  ['kk', 'road', 'SG', '1SG', 'NOM', 'жолым'],
  ['kk', 'eye', 'SG', '1SG', 'NOM', 'көзім'],
  ['kk', 'book', 'SG', '1SG', 'NOM', 'кітабым'],
  ['kk', 'heart', 'SG', '3SG', 'NOM', 'жүрегі'],
  ['kk', 'child', 'SG', '3SG', 'NOM', 'баласы'],
  ['kk', 'child', 'SG', 'NONE', 'GEN', 'баланың'],
  ['kk', 'house', 'SG', 'NONE', 'GEN', 'үйдің'],
  ['kk', 'bread', 'SG', 'NONE', 'GEN', 'нанның'],
  ['kk', 'book', 'SG', 'NONE', 'GEN', 'кітаптың'],
  ['kk', 'child', 'SG', 'NONE', 'ACC', 'баланы'],
  ['kk', 'bread', 'SG', 'NONE', 'ACC', 'нанды'],
  ['kk', 'book', 'SG', 'NONE', 'ACC', 'кітапты'],
  ['kk', 'child', 'SG', 'NONE', 'DAT', 'балаға'],
  ['kk', 'house', 'SG', 'NONE', 'DAT', 'үйге'],
  ['kk', 'book', 'SG', 'NONE', 'DAT', 'кітапқа'],
  ['kk', 'heart', 'SG', 'NONE', 'DAT', 'жүрекке'],
  ['kk', 'house', 'SG', 'NONE', 'LOC', 'үйде'],
  ['kk', 'book', 'SG', 'NONE', 'LOC', 'кітапта'],
  ['kk', 'house', 'SG', 'NONE', 'ABL', 'үйден'],
  ['kk', 'bread', 'SG', 'NONE', 'ABL', 'наннан'],
  ['kk', 'day', 'SG', 'NONE', 'ABL', 'күннен'],
  ['kk', 'head', 'SG', 'NONE', 'ABL', 'бастан'],
  ['kk', 'house', 'SG', '1SG', 'DAT', 'үйіме'],
  ['kk', 'house', 'SG', '2SG', 'DAT', 'үйіңе'],
  ['kk', 'house', 'SG', '1SG', 'ABL', 'үйімнен'],
  ['kk', 'house', 'SG', '1SG', 'GEN', 'үйімнің'],
  ['kk', 'house', 'SG', '1SG', 'ACC', 'үйімді'],
  ['kk', 'house', 'SG', '1PL', 'DAT', 'үйімізге'],
  ['kk', 'house', 'SG', '3SG', 'ACC', 'үйін'],
  ['kk', 'house', 'SG', '3SG', 'DAT', 'үйіне'],
  ['kk', 'house', 'SG', '3SG', 'LOC', 'үйінде'],
  ['kk', 'house', 'SG', '3SG', 'ABL', 'үйінен'],
  ['kk', 'house', 'SG', '3SG', 'GEN', 'үйінің'],
  ['kk', 'cart', 'SG', '3SG', 'LOC', 'арбасында'],
  ['kk', 'cart', 'PL', '1SG', 'LOC', 'арбаларымда'],
  ['kk', 'house', 'PL', '1SG', 'LOC', 'үйлерімде'],
  ['kk', 'cart', 'PL', 'NONE', 'DAT', 'арбаларға'],
  ['kk', 'mountain', 'PL', 'NONE', 'NOM', 'таулар'],
  ['kk', 'mountain', 'SG', 'NONE', 'GEN', 'таудың'],
  ['kk', 'village', 'PL', 'NONE', 'NOM', 'ауылдар'],
  ['kk', 'mouth', 'SG', '1SG', 'NOM', 'аузым'],
  ['kk', 'mouth', 'PL', 'NONE', 'NOM', 'ауыздар'],
  ['kk', 'hour', 'PL', 'NONE', 'NOM', 'сағаттар'],
  ['kk', 'mother', 'SG', '2PL', 'NOM', 'анаңыз'],
  // ── Uzbek ──
  ['uz', 'house', 'PL', 'NONE', 'NOM', 'uylar'],
  ['uz', 'eye', 'PL', 'NONE', 'NOM', "ko'zlar"],
  ['uz', 'house', 'SG', '1SG', 'NOM', 'uyim'],
  ['uz', 'mother', 'SG', '1SG', 'NOM', 'onam'],
  ['uz', 'child', 'SG', '3SG', 'NOM', 'bolasi'],
  ['uz', 'house', 'SG', '3SG', 'LOC', 'uyida'],
  ['uz', 'house', 'SG', '3SG', 'DAT', 'uyiga'],
  ['uz', 'house', 'SG', '3PL', 'NOM', 'uylari'],
  ['uz', 'book', 'PL', '3PL', 'NOM', 'kitoblari'],
  ['uz', 'book', 'SG', 'NONE', 'LOC', 'kitobda'],
  ['uz', 'heart', 'SG', '1SG', 'NOM', 'yuragim'],
  ['uz', 'heart', 'SG', 'NONE', 'DAT', 'yurakka'],
  ['uz', 'village', 'SG', '1SG', 'NOM', "qishlog'im"],
  ['uz', 'village', 'SG', 'NONE', 'DAT', 'qishloqqa'],
  ['uz', 'mountain', 'SG', 'NONE', 'DAT', 'toqqa'],
  ['uz', 'mountain', 'SG', '1SG', 'NOM', "tog'im"],
  ['uz', 'mouth', 'SG', '1SG', 'NOM', "og'zim"],
  ['uz', 'mouth', 'SG', 'NONE', 'DAT', "og'izga"],
  ['uz', 'house', 'SG', '2PL', 'NOM', 'uyingiz'],
  ['uz', 'house', 'PL', '1SG', 'ABL', 'uylarimdan'],
  ['uz', 'house', 'SG', 'NONE', 'GEN', 'uyning'],
  ['uz', 'horse', 'SG', 'NONE', 'ACC', 'otni'],
];

for (const [lang, id, number, poss, kase, want] of CASES) {
  const got = E.derive(lang, lex[id][lang], { number, poss, case: kase }).form;
  if (got === want) pass++;
  else {
    fail++;
    console.log(`FAIL ${lang} ${id} ${number}/${poss}/${kase}: got ${got}, want ${want}`);
  }
}

// Every distractor must differ from the correct answer
for (const c of LEX) {
  for (const lang of E.LANGS) {
    const slots = { number: 'PL', poss: '1SG', case: 'LOC' };
    const good = E.derive(lang, c[lang], slots).form;
    const ds = E.distractors(lang, c[lang], slots, 3);
    if (ds.includes(good) || ds.length < 2) {
      fail++;
      console.log(`FAIL distractors ${lang} ${c.id}: ${ds.join(', ')}`);
    } else pass++;
  }
}

// Latin input for Kazakh is converted to Cyrillic
const latin = E.derive('kk', { word: 'qala' }, { number: 'PL', poss: 'NONE', case: 'NOM' }).form;
if (latin === 'қалалар') pass++;
else {
  fail++;
  console.log('FAIL kk latin input: ' + latin);
}

// ── Analyzer (reverse) ──
const known = {};
for (const l of E.LANGS) known[l] = LEX.map((c) => ({ entry: c[l], ref: c.id }));
const sig = (x) => `${x.lang}:${x.entry.word}:${x.slots.number}/${x.slots.poss}/${x.slots.case}`;
// [input, expected mode, a signature that must be among the results, (diag) expected kind]
const ANALYZE = [
  ['evlerimde', 'known', 'tr:ev:PL/1SG/LOC'],
  ['kitabımdan', 'known', 'tr:kitap:SG/1SG/ABL'],
  ['ağzım', 'known', 'tr:ağız:SG/1SG/NOM'],
  ['saatler', 'known', 'tr:saat:PL/NONE/NOM'],
  ['кітабымнан', 'known', 'kk:кітап:SG/1SG/ABL'],
  ['үйіне', 'known', 'kk:үй:SG/3SG/DAT'],
  ['uylarimda', 'known', 'uz:uy:PL/1SG/LOC'],
  ['toqqa', 'known', "uz:tog':SG/NONE/DAT"],
  ["qishlog'imdan", 'known', 'uz:qishloq:SG/1SG/ABL'],
  ['evleri', 'known', 'tr:ev:PL/NONE/ACC'],
  ['evlarimde', 'diag', 'tr:ev:PL/1SG/LOC', 'harmony'],
  ['kitapım', 'diag', 'tr:kitap:SG/1SG/NOM', 'stem'],
  ['arabaım', 'diag', 'tr:araba:SG/1SG/NOM', 'buffer'],
  ['evte', 'diag', 'tr:ev:SG/NONE/LOC', 'assim'],
  ['үйлар', 'diag', 'kk:үй:PL/NONE/NOM', 'harmony'],
  ['uylerda', 'diag', 'uz:uy:PL/NONE/LOC', 'uzinv'],
  ['okullarda', 'guess', 'tr:okul:PL/NONE/LOC'],
];
for (const [input, mode, want, kind] of ANALYZE) {
  const r = E.analyze(input, known);
  const hit = r.results.find((x) => sig(x) === want);
  const ok = r.mode === mode && hit && (!kind || hit.diag.kinds.includes(kind));
  if (ok) pass++;
  else {
    fail++;
    console.log(`FAIL analyze ${input}: mode ${r.mode}, got ${r.results.map(sig).join(', ')}${hit && hit.diag ? ' kinds ' + hit.diag.kinds : ''}`);
  }
}
// evleri is ambiguous: 4 readings
if (E.analyze('evleri', known).results.length === 4) pass++;
else {
  fail++;
  console.log('FAIL analyze evleri: expected 4 readings');
}
// Every lexicon form round-trips: generate → analyze → the original reading is found
let rt = 0;
for (const c of LEX)
  for (const l of E.LANGS)
    for (const slots of [{ number: 'PL', poss: '1SG', case: 'LOC' }, { number: 'SG', poss: '3SG', case: 'ACC' }, { number: 'SG', poss: 'NONE', case: 'DAT' }]) {
      const f = E.derive(l, c[l], slots).form;
      const r = E.analyze(f, known);
      if (r.mode === 'known' && r.results.some((x) => x.entry === c[l] && x.slots.number === slots.number && x.slots.poss === slots.poss && x.slots.case === slots.case)) rt++;
      else {
        fail++;
        console.log(`FAIL round-trip ${l} ${f}: ${r.mode} ${r.results.map(sig).join(', ')}`);
      }
    }
pass += rt;

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
