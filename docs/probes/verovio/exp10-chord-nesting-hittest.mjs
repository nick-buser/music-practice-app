// EXP10: SVG nesting of chord/note and what Score.tsx's `closest('[id]')` resolves to when the click lands on a notehead, stem, flag, dot, accidental, beam, articulation.
// Run: node exp10-chord-nesting-hittest.mjs
import { makeTk, mei, parseGroups, closestId, report } from './lib.mjs';

const tk = await makeTk();
const body = `<measure xml:id="m1" n="1">
  <staff n="1"><layer xml:id="v1" n="1">
    <chord xml:id="c1" dur="8" dots="1"><note xml:id="n1" pname="c" oct="4" accid="s"/><note xml:id="n2" pname="e" oct="4"/></chord>
    <note xml:id="n3" pname="g" oct="4" dur="16" artic="stacc"/>
    <beam xml:id="b1"><note xml:id="n4" pname="a" oct="4" dur="8"/><note xml:id="n5" pname="b" oct="4" dur="8"/></beam>
    <note xml:id="n6" pname="c" oct="5" dur="4"/>
  </layer></staff>
  <staff n="2"><layer n="1"><rest xml:id="r1" dur="2"/><mRest xml:id="mr1"/></layer></staff>
</measure>`;
console.log('loadData', tk.loadData(mei(body)));
const svg = tk.renderToSVG(1);
const gs = parseGroups(svg);

// Full subtree print for the chord and for n3, showing id/class per depth.
function subtree(rootId) {
  const root = gs.find((g) => g.id === rootId);
  const rows = [];
  for (const g of gs) {
    let p = g; let inside = false;
    while (p) { if (p === root) { inside = true; break; } p = p.parent; }
    if (inside) rows.push(`${'  '.repeat(g.depth - root.depth)}<${g.name}${g.id ? ` id=${g.id}` : ''}${g.class ? ` class=${g.class}` : ''}>`);
  }
  return rows;
}
report('EXP10 subtree of chord c1', subtree('c1'));
report('EXP10 subtree of note n3 (dotted? no — 16th with staccato)', subtree('n3'));
report('EXP10 subtree of beam b1', subtree('b1'));
report('EXP10 subtree of rest r1 / mRest mr1', [...subtree('r1'), '--', ...subtree('mr1')]);

// What would closest('[id]') return for a click on each leaf glyph (<use>) / <rect> / <path>?
const leafHits = [];
const tagRe = /<(use|rect|path|polygon|text|tspan)\b([^>]*)\/?>/g;
// re-walk with parents: parseGroups only kept g/svg/id'd nodes; do a second pass to record leaf → nearest g.
const stack = []; const re = /<(\/)?([A-Za-z][\w:-]*)([^>]*?)(\/)?>/g; let m;
while ((m = re.exec(svg))) {
  const [, close, name, attrs, selfClose] = m;
  if (name.startsWith('?')) continue;
  if (close) { stack.pop(); continue; }
  const id = (attrs.match(/\sid="([^"]*)"/) || [])[1];
  const cls = (attrs.match(/\sclass="([^"]*)"/) || [])[1];
  const node = { name, id, class: cls, parent: stack[stack.length - 1] || null };
  if (['use', 'rect', 'path', 'polygon', 'text'].includes(name)) {
    const c = closestId(node);
    const g = node.parent;
    leafHits.push(`${name}${attrs.match(/href="([^"]*)"/) ? '[' + attrs.match(/href="([^"]*)"/)[1] + ']' : ''} in <g class=${g?.class}> → closest('[id]') = ${c?.id} (${c?.class})`);
  }
  if (!selfClose) stack.push(node);
}
report('EXP10 leaf glyph → closest("[id]") (dedup)', [...new Set(leafHits)]);
