/**
 * Admin-dashboard-only display helper.
 * Masks known bad words with * for list/detail UI. Does not change API data.
 */

const BAD_WORDS = [
  'sex',
  'sexy',
  'fuck',
  'fucker',
  'fucking',
  'fck',
  'fuk',
  'fuc',
  'shit',
  'bitch',
  'asshole',
  'arsehole',
  'porn',
  'porno',
  'xxx',
  'nude',
  'nudes',
  'nsfw',
  'dick',
  'cock',
  'pussy',
  'cunt',
  'slut',
  'whore',
  'bastard',
  'motherfucker',
  'mfucker',
  'boob',
  'boobs',
  'vagina',
  'penis',
  'horny',
  'orgasm',
  'cumshot',
  'blowjob',
  'handjob',
];

// Longest first so "fucking" masks before "fuck".
const BAD_SORTED = [...BAD_WORDS].sort((a, b) => b.length - a.length);

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * @param {string|null|undefined} name
 * @returns {{ display: string, original: string|null, hasBadWord: boolean }}
 */
export function maskBadWords(name) {
  const original = name == null ? null : String(name);
  if (!original) {
    return { display: '', original, hasBadWord: false };
  }

  let display = original;
  let hasBadWord = false;

  for (const word of BAD_SORTED) {
    const re = new RegExp(escapeRegExp(word), 'gi');
    if (!re.test(display)) continue;
    hasBadWord = true;
    display = display.replace(re, (match) => '*'.repeat(match.length));
  }

  return { display, original, hasBadWord };
}
