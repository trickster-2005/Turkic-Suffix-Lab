/**
 * Turkic suffix selector — condensed TypeScript reference.
 *
 * Pipeline (a tiny finite-state machine):
 *   STEM ──PL──▶ S1 ──POSS──▶ S2 ──CASE──▶ S3
 * Each transition reads the current State, picks ONE allomorph, and
 * returns a new State. Stem alternations (kitap → kitab-ı, ağız → ağz-ı)
 * are left out here for clarity; see js/engine.js for the full engine.
 */

type Lang = 'tr' | 'kk' | 'uz';
type Poss = '1SG' | '2SG' | '3SG' | '1PL' | '2PL' | '3PL';
type Case = 'GEN' | 'ACC' | 'DAT' | 'LOC' | 'ABL';

interface State {
  form: string;
  plural: boolean;
  poss?: Poss;
}

const last = (s: string) => s.charAt(s.length - 1);
const lastOf = (s: string, set: string) => [...s].reverse().find((c) => set.includes(c));
const is3 = (p?: Poss) => p === '3SG' || p === '3PL';

/* ── Turkish (Oghuz): 2-way A, 4-way I, D/T assimilation, buffers y/n/s ── */
const TR = { V: 'aeıioöuü', BACK: 'aıou', ROUND: 'oöuü', VOICELESS: 'fstkçşhp' };

function trHarmony(form: string) {
  const v = lastOf(form, TR.V) ?? 'a';
  return { back: TR.BACK.includes(v), round: TR.ROUND.includes(v) };
}
const trA = (f: string) => (trHarmony(f).back ? 'a' : 'e');
const trI = (f: string) => {
  const h = trHarmony(f);
  return h.back ? (h.round ? 'u' : 'ı') : h.round ? 'ü' : 'i';
};
const trD = (f: string) => (TR.VOICELESS.includes(last(f)) ? 't' : 'd');
const trEndsV = (f: string) => TR.V.includes(last(f));

const TR_POSS: Record<Poss, (s: State) => string> = {
  '1SG': ({ form }) => (trEndsV(form) ? '' : trI(form)) + 'm',
  '2SG': ({ form }) => (trEndsV(form) ? '' : trI(form)) + 'n',
  '3SG': ({ form }) => (trEndsV(form) ? 's' : '') + trI(form),
  '1PL': ({ form }) => (trEndsV(form) ? '' : trI(form)) + 'm' + trI(form) + 'z',
  '2PL': ({ form }) => (trEndsV(form) ? '' : trI(form)) + 'n' + trI(form) + 'z',
  '3PL': ({ form, plural }) => (plural ? trI(form) : 'l' + trA(form) + 'r' + (trA(form) === 'a' ? 'ı' : 'i')),
};

const TR_CASE: Record<Case, (s: State) => string> = {
  GEN: ({ form }) => (trEndsV(form) ? 'n' : '') + trI(form) + 'n',
  ACC: ({ form, poss }) => (trEndsV(form) ? (is3(poss) ? 'n' : 'y') : '') + trI(form),
  DAT: ({ form, poss }) => (trEndsV(form) ? (is3(poss) ? 'n' : 'y') : '') + trA(form),
  LOC: ({ form, poss }) => (is3(poss) ? 'nd' : trD(form)) + trA(form),
  ABL: ({ form, poss }) => (is3(poss) ? 'nd' : trD(form)) + trA(form) + 'n',
};

/* ── Kazakh (Kipchak): 2-way harmony + six-class consonant table ── */
type KkClass = 'V' | 'R' | 'G' | 'Z' | 'N' | 'T';
const KK_VOWELS = 'аәеоөұүыіэяюи';
const KK_BACK = 'аоұыя';
const KK_FRONT = 'әеөүіэ';

const kkClass = (c: string): KkClass =>
  KK_VOWELS.includes(c) ? 'V'
  : c === 'р' ? 'R'
  : 'йу'.includes(c) ? 'G'
  : 'лжз'.includes(c) ? 'Z'
  : 'мнң'.includes(c) ? 'N'
  : 'T';

//                        vowel  р    й/у  л/ж/з  м/н/ң  voiceless
const KK_INITIAL = {
  PL:  { V: 'л', R: 'л', G: 'л', Z: 'д', N: 'д', T: 'т' },
  GEN: { V: 'н', R: 'д', G: 'д', Z: 'д', N: 'н', T: 'т' },
  ACC: { V: 'н', R: 'д', G: 'д', Z: 'д', N: 'д', T: 'т' },
  LOC: { V: 'д', R: 'д', G: 'д', Z: 'д', N: 'д', T: 'т' },
  ABL: { V: 'д', R: 'д', G: 'д', Z: 'д', N: 'н', T: 'т' },
} as const;

const kkBack = (f: string) => KK_BACK.includes(lastOf(f, KK_BACK + KK_FRONT) ?? 'а');
const kkA = (f: string) => (kkBack(f) ? 'а' : 'е');
const kkI = (f: string) => (kkBack(f) ? 'ы' : 'і');

const KK_CASE: Record<Case, (s: State) => string> = {
  GEN: ({ form }) => KK_INITIAL.GEN[kkClass(last(form))] + kkI(form) + 'ң',
  ACC: ({ form, poss }) => (is3(poss) ? 'н' : KK_INITIAL.ACC[kkClass(last(form))] + kkI(form)),
  DAT: ({ form, poss }) => {
    if (is3(poss)) return 'н' + kkA(form);
    if (poss === '1SG' || poss === '2SG') return kkA(form);
    const voiceless = kkClass(last(form)) === 'T';
    return (kkBack(form) ? (voiceless ? 'қ' : 'ғ') : voiceless ? 'к' : 'г') + kkA(form);
  },
  LOC: ({ form, poss }) => (is3(poss) ? 'нд' : KK_INITIAL.LOC[kkClass(last(form))]) + kkA(form),
  ABL: ({ form, poss }) => (is3(poss) ? 'н' : KK_INITIAL.ABL[kkClass(last(form))]) + kkA(form) + 'н',
};

/* ── Uzbek (Karluk): harmony lost → invariant suffixes ── */
const UZ_CASE: Record<Case, (s: State) => string> = {
  GEN: () => 'ning',
  ACC: () => 'ni',
  DAT: ({ form }) => (/k$/.test(form) ? 'ka' : /q$/.test(form) ? 'qa' : 'ga'),
  LOC: () => 'da',
  ABL: () => 'dan',
};

/* ── FSM driver (Turkish shown; Kazakh/Uzbek plug in their own tables) ── */
export function declineTurkish(stem: string, opts: { plural?: boolean; poss?: Poss; kase?: Case }): string {
  let s: State = { form: stem, plural: false };
  if (opts.plural) s = { ...s, form: s.form + 'l' + trA(s.form) + 'r', plural: true };
  if (opts.poss) s = { ...s, form: s.form + TR_POSS[opts.poss](s), poss: opts.poss };
  if (opts.kase) s = { ...s, form: s.form + TR_CASE[opts.kase](s) };
  return s.form;
}

// declineTurkish('ev', { plural: true, poss: '1SG', kase: 'LOC' })  → 'evlerimde'
// KK_CASE.ABL({ form: 'нан', plural: false })                       → 'нан'  (наннан)
// UZ_CASE.DAT({ form: 'yurak', plural: false })                     → 'ka'   (yurakka)
export { TR_POSS, TR_CASE, KK_CASE, UZ_CASE, kkClass };
