// Shared helpers for the empirical Verovio 4.5.1 probes. Runs from ANY cwd.
import createVerovioModule from '../../../app/node_modules/verovio/dist/verovio-module.mjs';
import { VerovioToolkit } from '../../../app/node_modules/verovio/dist/verovio.mjs';

export async function makeTk(opts = {}) {
  const mod = await createVerovioModule();
  const tk = new VerovioToolkit(mod);
  // Mirror app/src/verovio/toolkit.ts DEFAULTS exactly.
  tk.setOptions({
    scale: 40, adjustPageHeight: true, header: 'none', footer: 'none', breaks: 'none',
    pageMarginLeft: 0, pageMarginRight: 0, pageMarginTop: 0, pageMarginBottom: 0,
    ...opts,
  });
  return tk;
}

/** Wrap measure XML in a grand-staff MEI 5 document (mirrors what toMei() would emit). */
export function mei(measuresXml, { scoreDefAttrs = '', staff1 = '', staff2 = '', head = '' } = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="5.0">
<meiHead><fileDesc><titleStmt><title>probe</title></titleStmt><pubStmt/></fileDesc>${head}</meiHead>
<music><body><mdiv><score>
<scoreDef ${scoreDefAttrs}><staffGrp xml:id="sg1" symbol="brace" bar.thru="true">
  <staffDef xml:id="sd1" n="1" lines="5" clef.shape="G" clef.line="2" meter.count="4" meter.unit="4" keysig="0" ${staff1}/>
  <staffDef xml:id="sd2" n="2" lines="5" clef.shape="F" clef.line="4" meter.count="4" meter.unit="4" keysig="0" ${staff2}/>
</staffGrp></scoreDef>
<section xml:id="sec1">
${measuresXml}
</section></score></mdiv></body></music></mei>`;
}

/** Parse every `<g ...>` in an SVG string into {id, class, depth, parentId, parentClass}. Tiny tag tokenizer; enough for Verovio's output. */
export function parseGroups(svg) {
  const tagRe = /<(\/)?([A-Za-z][\w:-]*)([^>]*?)(\/)?>/g;
  const stack = [];
  const out = [];
  let m;
  while ((m = tagRe.exec(svg))) {
    const [, close, name, attrs, selfClose] = m;
    if (name.startsWith('?') || name === '!DOCTYPE') continue;
    if (close) { stack.pop(); continue; }
    const id = (attrs.match(/\sid="([^"]*)"/) || [])[1];
    const cls = (attrs.match(/\sclass="([^"]*)"/) || [])[1];
    const node = { name, id, class: cls, depth: stack.length, parent: stack[stack.length - 1] || null, attrs: attrs.trim() };
    if (name === 'g' || name === 'svg' || id) out.push(node);
    if (!selfClose) stack.push(node);
  }
  return out;
}

export function idIndex(svg) {
  const map = new Map();
  for (const n of parseGroups(svg)) {
    if (n.id) {
      if (!map.has(n.id)) map.set(n.id, []);
      map.get(n.id).push(n);
    }
  }
  return map;
}

/** Nearest ancestor (inclusive) with an id — what `closest('[id]')` returns in Score.tsx. */
export function closestId(node) {
  let n = node;
  while (n && !n.id) n = n.parent;
  return n;
}

export function report(title, rows) {
  console.log(`\n=== ${title}`);
  for (const r of rows) console.log('  ' + (typeof r === 'string' ? r : JSON.stringify(r)));
}
