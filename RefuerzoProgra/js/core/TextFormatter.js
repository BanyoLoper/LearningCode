/**
 * TextFormatter — Converts lightweight markdown-like syntax to safe HTML.
 * Apply to question text, instructions, and preambles (NOT to explanations
 * that already contain HTML).
 *
 * Supported syntax:
 *   `inline code`   → <code>inline code</code>
 *   **bold text**   → <strong>bold text</strong>
 */
export function formatText(text) {
  if (!text) return '';
  return text
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
}
