import { describe, expect, it } from 'vitest';
import { emphasize, escapeHtml } from './text';

describe('escapeHtml', () => {
  it('escapes the HTML special characters', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
  });

  it('escapes ampersands and apostrophes', () => {
    expect(escapeHtml("R&D's plan")).toBe('R&amp;D&#39;s plan');
  });

  it('leaves plain text alone', () => {
    expect(escapeHtml('a quiet bar')).toBe('a quiet bar');
  });
});

describe('emphasize', () => {
  it('wraps *asterisked* spans in <em>', () => {
    expect(emphasize('a *quiet* bar')).toBe('a <em>quiet</em> bar');
  });

  it('escapes HTML in the surrounding text', () => {
    expect(emphasize('<b>not *italic*</b>')).toBe('&lt;b&gt;not <em>italic</em>&lt;/b&gt;');
  });

  it('handles multiple emphasis spans', () => {
    expect(emphasize('*one* and *two*')).toBe('<em>one</em> and <em>two</em>');
  });

  it('leaves text with no asterisks intact (but still escaped)', () => {
    expect(emphasize('plain & simple')).toBe('plain &amp; simple');
  });

  it('does not allow injected HTML inside an emphasis span', () => {
    // The emphasis wraps the literal content, including the now-escaped tag.
    expect(emphasize('*<img>*')).toBe('<em>&lt;img&gt;</em>');
  });
});
