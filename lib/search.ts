/**
 * Name matching for Indian place names.
 *
 * Plain substring matching fails constantly here because the same name has many
 * romanisations: someone types "yesvan" for Yeshwantpur, "vivek nagar" for
 * Vivekananda, "krishnarajapura" for "Krishna Raja Pura". Normalising the
 * common transliteration variants before comparing makes those match.
 */

/**
 * Collapses the spelling variants that differ between romanisations of the same
 * Kannada/Sanskrit sound. Order matters: digraphs are folded before the single
 * letters they contain.
 */
export function normalizeName(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // strip accents
    .replace(/[^a-z0-9]/g, '')          // punctuation and spaces carry no signal
    // The conjunct jna is romanised both ways: Jnanabharathi / Gnanabharathi.
    .replace(/jn/g, 'gn')
    // Aspirated consonants are written with or without the h.
    .replace(/kh/g, 'k')
    .replace(/gh/g, 'g')
    .replace(/ch/g, 'c')
    .replace(/jh/g, 'j')
    .replace(/th/g, 't')
    .replace(/dh/g, 'd')
    .replace(/ph/g, 'f')
    .replace(/bh/g, 'b')
    .replace(/sh/g, 's')
    // v and w are used interchangeably: Yeshwantpur / Yesvantpur.
    .replace(/w/g, 'v')
    // Long vowels are doubled inconsistently: Naagarbhaavi / Nagarbhavi.
    .replace(/aa/g, 'a')
    .replace(/ee/g, 'i')
    .replace(/ii/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/uu/g, 'u')
    .replace(/y$/g, 'i')
    // Any remaining doubled letter is a spelling choice, not a distinction.
    .replace(/(.)\1+/g, '$1');
}

export interface Named { name: string }

/**
 * Ranked name search. Prefix matches beat interior matches, and shorter names
 * beat longer ones, so "indira" surfaces Indiranagar above
 * "Indiranagar Police Station".
 */
export function matchByName<T extends Named>(items: T[], query: string, limit = 8): T[] {
  const q = normalizeName(query);
  if (q.length < 2) return [];

  const scored: Array<{ item: T; rank: number; at: number }> = [];
  for (const item of items) {
    const n = normalizeName(item.name);
    const at = n.indexOf(q);
    if (at < 0) continue;
    scored.push({ item, rank: at === 0 ? 0 : 1, at });
  }

  return scored
    .sort((a, b) =>
      a.rank - b.rank ||
      a.at - b.at ||
      a.item.name.length - b.item.name.length ||
      a.item.name.localeCompare(b.item.name))
    .slice(0, limit)
    .map((s) => s.item);
}
