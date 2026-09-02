// EXP16: region anchors are "normalized to the measure's bounding box". Measure the <g class="measure"> extent (min/max y of every drawn coordinate inside it) with and without a dynamic / low bass note / fingering — does the bbox move?
// Run: node exp16-measure-bbox-drift.mjs
import { makeTk, mei, report } from './lib.mjs';

const tk = await makeTk();

function measureExtent(svg, measureId) {
  // Slice the measure subtree textually (Verovio closes the measure <g> before the next measure or system end).
  const start = svg.indexOf(`id="${measureId}"`);
  if (start < 0) return null;
  // Walk forward balancing <g …> and </g>.
  let depth = 0, i = svg.lastIndexOf('<g', start), end = -1;
  const re = /<g\b|<\/g>/g; re.lastIndex = i;
  let m;
  while ((m = re.exec(svg))) { if (m[0] === '<g') depth++; else { depth--; if (depth === 0) { end = m.index; break; } } }
  const sub = svg.slice(i, end);
  const ys = [], xs = [];
  for (const mm of sub.matchAll(/\sy="(-?\d+(?:\.\d+)?)"/g)) ys.push(+mm[1]);
  for (const mm of sub.matchAll(/\sx="(-?\d+(?:\.\d+)?)"/g)) xs.push(+mm[1]);
  for (const mm of sub.matchAll(/[ML]\s?(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g)) { xs.push(+mm[1]); ys.push(+mm[2]); }
  for (const mm of sub.matchAll(/y1="(-?\d+)"|y2="(-?\d+)"/g)) ys.push(+(mm[1] ?? mm[2]));
  return { minY: Math.min(...ys), maxY: Math.max(...ys), minX: Math.min(...xs), maxX: Math.max(...xs), tspans: (sub.match(/<tspan/g) || []).length };
}

const base = (extras = '', bass = '<note xml:id="b1" pname="c" oct="3" dur="1"/>') => mei(`<measure xml:id="m1" n="1"><staff n="1"><layer n="1"><note xml:id="n1" pname="c" oct="5" dur="4"/><note xml:id="n2" pname="d" oct="5" dur="4"/><note xml:id="n3" pname="e" oct="5" dur="2"/></layer></staff><staff n="2"><layer n="1">${bass}</layer></staff>${extras}</measure><measure xml:id="m2" n="2"><staff n="1"><layer n="1"><note pname="c" oct="5" dur="1"/></layer></staff><staff n="2"><layer n="1"><mRest/></layer></staff></measure>`);

const variants = {
  plain: base(),
  withDynam: base('<dynam staff="1" tstamp="1" place="below">ff</dynam>'),
  withTempo: base('<tempo staff="1" tstamp="1" place="above" mm="120">Allegro con brio</tempo>'),
  withFing: base('<fing staff="1" startid="#n1" place="above">5</fing>'),
  lowBass: base('', '<note xml:id="b1" pname="c" oct="1" dur="1"/>'),
  highTreble: base().replace('pname="e" oct="5" dur="2"', 'pname="c" oct="7" dur="2"'),
};
const rows = [];
for (const [name, doc] of Object.entries(variants)) {
  tk.loadData(doc);
  const svg = tk.renderToSVG(1);
  rows.push({ name, m1: measureExtent(svg, 'm1'), m2: measureExtent(svg, 'm2') });
}
report('EXP16 measure <g> extents (SVG units) — y drift under content-only changes', rows);
