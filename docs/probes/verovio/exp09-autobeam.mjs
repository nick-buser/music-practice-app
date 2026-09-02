// EXP09: beaming — with no <beam> elements, does Verovio auto-beam eighths per meter for MEI input? Compare with ABC input.
// Run: node exp09-autobeam.mjs
import { makeTk, mei, parseGroups, report } from './lib.mjs';

const tk = await makeTk();
const eighths = Array.from({ length: 8 }, (_, i) => `<note xml:id="e${i}" pname="c" oct="4" dur="8"/>`).join('');
const sixteenths = Array.from({ length: 8 }, (_, i) => `<note xml:id="s${i}" pname="c" oct="5" dur="16"/>`).join('');
const body = `<measure xml:id="m1" n="1"><staff n="1"><layer n="1">${eighths}</layer></staff><staff n="2"><layer n="1">${sixteenths}<rest dur="2"/></layer></staff></measure>`;
console.log('loadData', tk.loadData(mei(body)));
let svg = tk.renderToSVG(1);
let gs = parseGroups(svg);
report('EXP09 MEI no <beam>: beam groups / flags', [{ beams: gs.filter((g) => g.class === 'beam').length, flags: gs.filter((g) => g.class === 'flag').length, stems: gs.filter((g) => g.class === 'stem').length }]);

// 6/8 too
const body68 = `<measure xml:id="m1" n="1"><staff n="1"><layer n="1">${Array.from({ length: 6 }, (_, i) => `<note xml:id="x${i}" pname="c" oct="4" dur="8"/>`).join('')}</layer></staff><staff n="2"><layer n="1"><mRest/></layer></staff></measure>`;
console.log('loadData 6/8', tk.loadData(mei(body68, { staff1: '', staff2: '' }).replace(/meter.count="4" meter.unit="4"/g, 'meter.count="6" meter.unit="8"')));
svg = tk.renderToSVG(1);
gs = parseGroups(svg);
report('EXP09 MEI 6/8 no <beam>', [{ beams: gs.filter((g) => g.class === 'beam').length, flags: gs.filter((g) => g.class === 'flag').length }]);

// Explicit <beam> works, and <beam> with @xml:id passes through (from EXP01). Also: beam inside tuplet vs tuplet inside beam.
const bodyBeamTuplet = `<measure xml:id="m1" n="1"><staff n="1"><layer n="1">
  <tuplet xml:id="t1" num="3" numbase="2"><beam xml:id="b1"><note xml:id="a1" pname="c" oct="4" dur="8"/><note xml:id="a2" pname="d" oct="4" dur="8"/><note xml:id="a3" pname="e" oct="4" dur="8"/></beam></tuplet>
  <beam xml:id="b2"><tuplet xml:id="t2" num="3" numbase="2"><note xml:id="a4" pname="c" oct="4" dur="8"/><note xml:id="a5" pname="d" oct="4" dur="8"/><note xml:id="a6" pname="e" oct="4" dur="8"/></tuplet></beam>
  <beam xml:id="b3"><note xml:id="a7" pname="c" oct="4" dur="8"/><note xml:id="a8" pname="d" oct="4" dur="8"/><note xml:id="a9" pname="e" oct="4" dur="8"/><note xml:id="a10" pname="f" oct="4" dur="8"/></beam>
</layer></staff><staff n="2"><layer n="1"><mRest/></layer></staff></measure>`;
console.log('loadData beam/tuplet', tk.loadData(mei(bodyBeamTuplet)));
svg = tk.renderToSVG(1);
gs = parseGroups(svg);
report('EXP09 explicit beams: beam ids + tuplet ids in SVG', [gs.filter((g) => ['beam', 'tuplet', 'tupletNum', 'tupletBracket'].includes(g.class)).map((g) => `${g.class}#${g.id} parent=${g.parent?.class}#${g.parent?.id}`)]);
report('EXP09 timemap qstamps under beam/tuplet nesting', [tk.renderToTimemap({}).map((e) => `${e.qstamp}:${(e.on || []).join('+')}`)]);

// ABC input for comparison: Verovio's ABC importer auto-beams.
tk.loadData('X:1\nM:4/4\nL:1/8\nK:C\nCDEF GABc|');
gs = parseGroups(tk.renderToSVG(1));
report('EXP09 ABC "CDEF GABc" beams', [{ beams: gs.filter((g) => g.class === 'beam').length }]);
tk.loadData('X:1\nM:4/4\nL:1/8\nK:C\nC D E F G A B c|');
gs = parseGroups(tk.renderToSVG(1));
report('EXP09 ABC "C D E F G A B c" (spaces) beams', [{ beams: gs.filter((g) => g.class === 'beam').length }]);
