/** Escape HTML special characters so user-supplied text is safe to inject. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' :
    c === '<' ? '&lt;' :
    c === '>' ? '&gt;' :
    c === '"' ? '&quot;' : '&#39;',
  );
}

/**
 * Convert `*emphasis*` markers in `text` to `<em>` tags. The non-emphasis
 * portions are HTML-escaped so the result is safe to feed to dangerouslySetInnerHTML.
 */
export function emphasize(text: string): string {
  return escapeHtml(text).replace(/\*(.+?)\*/g, '<em>$1</em>');
}
