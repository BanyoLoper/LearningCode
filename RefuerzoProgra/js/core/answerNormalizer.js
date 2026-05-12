/**
 * Answer normalization for fuzzy matching of open-ended (identification) answers.
 * Handles: accents, casing, whitespace, common Spanish stop-words, and
 * lenient containment (so "es una clase abstracta" matches accepted "abstracta").
 *
 * This is the cheap first pass — if it fails, the engine falls back to the LLM grader.
 */

const STOP_WORDS = new Set([
  'el', 'la', 'los', 'las', 'lo', 'un', 'una', 'unos', 'unas',
  'es', 'son', 'esta', 'estan', 'ser', 'estar', 'sea', 'sean',
  'de', 'del', 'al', 'a', 'en',
  'que', 'con', 'por', 'para', 'sin',
  'se', 'le', 'les', 'me', 'te', 'nos',
  'y', 'o', 'pero', 'si',
  'mi', 'tu', 'su', 'sus',
]);

/** Lowercase, strip accents (NFD), collapse whitespace, trim. */
export function normalize(text) {
  return String(text)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Splits a normalized string into tokens, drops stop-words and empties. */
function tokenize(text) {
  return normalize(text)
    .split(/\W+/)
    .filter(t => t && !STOP_WORDS.has(t));
}

/**
 * Returns true if the student answer matches the accepted one via lenient rules:
 *   1. Identical after normalization.
 *   2. The student's tokens contain all of the accepted answer's content tokens.
 *      Example: accepted="clase abstracta" matches student="es una clase abstracta".
 *
 * Returns false when the accepted answer has no content tokens after stop-word
 * removal (e.g. accepted="No") so the caller can fall back to strict equality.
 */
export function fuzzyMatch(student, accepted) {
  const s = normalize(student);
  const a = normalize(accepted);
  if (!s || !a) return false;
  if (s === a) return true;

  const acceptedTokens = tokenize(accepted);
  if (acceptedTokens.length === 0) return false;

  const studentTokens = new Set(tokenize(student));
  return acceptedTokens.every(t => studentTokens.has(t));
}
