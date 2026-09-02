// EXP20: is the SVG byte-identical across loads / toolkit instances for a fully-id'd ScoreDoc-style MEI? Without xmlIdSeed, with xmlIdSeed, and what still differs (glyph <symbol> suffixes?).
// Run: node exp20-svg-snapshot-determinism.mjs
import { makeTk, mei, report } from './lib.mjs';

// Every semantic element carries an id, like toMei() would emit; stems/flags/dots/accid/staff/system do not (they can't — the model has no such objects).
const doc = mei(`<measure xml:id="m1" n="1"><staff xml:id="m1s1" n="1"><layer xml:id="m1s1v1" n="1"><note xml:id="n1" pname="c" oct="4" dur="8" dots="1" accid="s"/><note xml:id="n2" pname="d" oct="4" dur="16"/><chord xml:id="c1" dur="4"><note xml:id="n3" pname="e" oct="4"/><note xml:id="n4" pname="g" oct="4"/></chord><rest xml:id="r1" dur="2"/></layer></staff><staff xml:id="m1s2" n="2"><layer xml:id="m1s2v1" n="1"><mRest xml:id="mr1"/></layer></staff><slur xml:id="sl1" startid="#n1" endid="#n2"/></measure>`);

function diffLines(a, b) {
  const A = a.split('\n'), B = b.split('\n');
  const out = [];
  for (let i = 0; i < Math.max(A.length, B.length); i++) if (A[i] !== B[i]) out.push({ i, a: (A[i] || '').trim().slice(0, 90), b: (B[i] || '').trim().slice(0, 90) });
  return out;
}

const tk = await makeTk();
tk.loadData(doc); const s1 = tk.renderToSVG(1);
tk.loadData(doc); const s2 = tk.renderToSVG(1);
const d12 = diffLines(s1, s2);
report('EXP20 no seed, same instance, two loads', [{ identical: s1 === s2, differingLines: d12.length }, ...d12.slice(0, 6)]);

const tkA = await makeTk({ xmlIdSeed: 7 }); tkA.loadData(doc); const a1 = tkA.renderToSVG(1);
const tkB = await makeTk({ xmlIdSeed: 7 }); tkB.loadData(doc); const b1 = tkB.renderToSVG(1);
const dab = diffLines(a1, b1);
report('EXP20 xmlIdSeed=7, two fresh instances', [{ identical: a1 === b1, differingLines: dab.length }, ...dab.slice(0, 6)]);
tkA.loadData(doc); const a2 = tkA.renderToSVG(1);
const daa = diffLines(a1, a2);
report('EXP20 xmlIdSeed=7, same instance, second load', [{ identical: a1 === a2, differingLines: daa.length }, ...daa.slice(0, 6)]);

// xmlIdChecksum on a fully-id'd doc: are remaining minted ids stable?
const tkC = await makeTk({ xmlIdChecksum: true }); tkC.loadData(doc); const c1 = tkC.renderToSVG(1);
const tkD = await makeTk({ xmlIdChecksum: true }); tkD.loadData(doc); const d1 = tkD.renderToSVG(1);
report('EXP20 xmlIdChecksum, two fresh instances', [{ identical: c1 === d1, differingLines: diffLines(c1, d1).length }, ...diffLines(c1, d1).slice(0, 4)]);

// measureRange: by position or by @n? Number measures 10..17 and select '2-3'.
let body = '';
for (let i = 10; i <= 17; i++) body += `<measure xml:id="mm${i}" n="${i}"><staff n="1"><layer n="1"><note xml:id="q${i}" pname="c" oct="4" dur="1"/></layer></staff><staff n="2"><layer n="1"><mRest/></layer></staff></measure>`;
tk.loadData(mei(body));
tk.select({ measureRange: '2-3' }); tk.redoLayout();
const sel = tk.renderToSVG(1);
report('EXP20 measureRange "2-3" on measures n=10..17 → rendered measure ids', [[...sel.matchAll(/<g id="(mm\d+)" class="measure"/g)].map((m) => m[1])]);
tk.loadData(mei(body));
tk.select({ measureRange: '11-12' }); tk.redoLayout();
report('EXP20 measureRange "11-12" → rendered measure ids', [[...tk.renderToSVG(1).matchAll(/<g id="(mm\d+)" class="measure"/g)].map((m) => m[1])]);
// pickup measure n=0
tk.loadData(mei(`<measure xml:id="pickup" n="0" metcon="false"><staff n="1"><layer n="1"><note xml:id="pu" pname="g" oct="4" dur="4"/></layer></staff><staff n="2"><layer n="1"><rest dur="4"/></layer></staff></measure>` + body.replace(/mm1(\d)/g, 'mx1$1').replace(/n="1(\d)"/g, 'n="$1"')));
tk.select({ measureRange: '1-2' }); tk.redoLayout();
report('EXP20 pickup n=0 then n=0..7, measureRange "1-2" → rendered', [[...tk.renderToSVG(1).matchAll(/<g id="([^"]+)" class="measure"/g)].map((m) => m[1])]);
