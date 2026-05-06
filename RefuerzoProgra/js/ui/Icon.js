/**
 * Icon — Returns SVG markup that references a symbol from assets/icons/sprite.svg.
 *
 * Usage in template strings:
 *   `<span class="nav-icon">${icon('gamepad')}</span>`
 *
 * Color comes from CSS `currentColor`. Glow is applied via `.icon` CSS classes
 * (see styles.css). Pass extra classes via the second arg: `icon('lock', 'icon-sm')`.
 *
 * Unknown slugs render an empty span so layout stays intact (and a warning logs once).
 */

const SPRITE_URL = 'assets/icons/sprite.svg';

const KNOWN = new Set([
  // Section / group
  'ruler', 'construction', 'gamepad', 'box', 'gear', 'graduation-cap',
  'shuffle', 'repeat', 'skip-forward', 'folder', 'clipboard', 'book-open',
  'refresh', 'dna', 'wrench', 'plug', 'git', 'pencil', 'git-branch',
  'cloud', 'burst', 'timer', 'chart-up', 'chart-bar', 'hash', 'books',
  'users', 'link', 'brain', 'diamond', 'arrows-h', 'archive', 'file-text',
  'database', 'bolt', 'help-circle', 'rocket', 'joystick', 'walk',
  'dumbbell', 'circle', 'bow', 'wave', 'arrow-right', 'satellite', 'bell',
  'lambda', 'shield-check', 'circle-1', 'sparkles', 'puzzle', 'factory',
  // UI
  'book', 'keyboard', 'bug', 'list-checks', 'target', 'medal', 'trophy',
  'heart', 'party', 'swords', 'unlock', 'lock', 'lightbulb', 'check',
  'x', 'mailbox', 'alert', 'pin', 'search',
]);

const warned = new Set();

/**
 * Returns inline SVG markup for the given icon slug.
 * @param {string} slug - icon name (must exist in sprite.svg)
 * @param {string} [extraClass] - optional extra CSS class (e.g. 'icon-sm', 'icon-lg')
 * @returns {string} HTML safe to inject via innerHTML
 */
export function icon(slug, extraClass = '') {
  if (!KNOWN.has(slug)) {
    if (!warned.has(slug)) {
      console.warn(`[Icon] Unknown icon slug: "${slug}"`);
      warned.add(slug);
    }
    return '<span class="icon icon-missing" aria-hidden="true"></span>';
  }
  const cls = extraClass ? `icon ${extraClass}` : 'icon';
  return `<svg class="${cls}" aria-hidden="true"><use href="${SPRITE_URL}#icon-${slug}"/></svg>`;
}

/** Convenience: same as icon() but with a default class hook for "active glow". */
export function iconActive(slug, extraClass = '') {
  return icon(slug, `icon-active ${extraClass}`.trim());
}
