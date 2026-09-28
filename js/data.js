/*
 * Lexicon: one concept → one stem per language.
 * Per-language flags:
 *   syncope: true      unstressed last vowel drops before a vowel-initial suffix (ağız → ağzı)
 *   voicing: bool      force final-consonant softening on/off (default: automatic heuristic)
 *   harmony: 'front'   lexical exception, suffixes are front despite a back vowel (Turkish saat)
 */
(function (root) {
  'use strict';
  const L = (id, group, en, enPl, zh, tr, kk, uz) => ({
    id,
    group,
    en,
    enPl,
    zh,
    tr: typeof tr === 'string' ? { word: tr } : tr,
    kk: typeof kk === 'string' ? { word: kk } : kk,
    uz: typeof uz === 'string' ? { word: uz } : uz,
  });

  const LEXICON = [
    // Harmony profiles
    L('cart', 'core', 'cart / car', 'carts', '車', 'araba', 'арба', 'arava'),
    L('house', 'core', 'house', 'houses', '房子', 'ev', 'үй', 'uy'),
    L('road', 'core', 'road', 'roads', '路', 'yol', 'жол', "yo'l"),
    L('eye', 'core', 'eye', 'eyes', '眼睛', 'göz', 'көз', "ko'z"),
    L('head', 'core', 'head', 'heads', '頭', 'baş', 'бас', 'bosh'),
    L('hand', 'core', 'hand', 'hands', '手', 'el', 'қол', "qo'l"),
    L('day', 'core', 'day', 'days', '日子', 'gün', 'күн', 'kun'),
    L('lake', 'core', 'lake', 'lakes', '湖', 'göl', 'көл', "ko'l"),
    // Consonant behaviour
    L('book', 'alt', 'book', 'books', '書', 'kitap', 'кітап', 'kitob'),
    L('heart', 'alt', 'heart', 'hearts', '心', 'yürek', 'жүрек', 'yurak'),
    L('child', 'alt', 'child', 'children', '孩子', 'çocuk', 'бала', 'bola'),
    L('tree', 'alt', 'tree', 'trees', '樹', 'ağaç', 'ағаш', 'daraxt'),
    L('bread', 'alt', 'bread', 'loaves', '麵包', 'ekmek', 'нан', 'non'),
    L('horse', 'alt', 'horse', 'horses', '馬', 'at', 'ат', 'ot'),
    L('village', 'alt', 'village', 'villages', '村莊', 'köy', 'ауыл', 'qishloq'),
    L('mountain', 'alt', 'mountain', 'mountains', '山', 'dağ', 'тау', "tog'"),
    // Special cases
    L('mouth', 'special', 'mouth', 'mouths', '嘴', { word: 'ağız', syncope: true }, { word: 'ауыз', syncope: true }, { word: "og'iz", syncope: true }),
    L('hour', 'special', 'hour / clock', 'hours', '小時／時鐘', { word: 'saat', harmony: 'front', voicing: false }, 'сағат', 'soat'),
    L('mother', 'special', 'mother', 'mothers', '母親', 'anne', 'ана', 'ona'),
    L('word', 'special', 'word', 'words', '話語', 'söz', 'сөз', "so'z"),
  ];

  root.TurkicLexicon = LEXICON;
  if (typeof module !== 'undefined' && module.exports) module.exports = LEXICON;
})(typeof window !== 'undefined' ? window : globalThis);
