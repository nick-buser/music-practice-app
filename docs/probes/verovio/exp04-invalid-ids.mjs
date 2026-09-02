// EXP04: non-NCName xml:id values — ULID (starts with a digit), UUID, prefixed. Kept? rewritten? in SVG? addressable via the API?
// Run: node exp04-invalid-ids.mjs
import { makeTk, mei, idIndex, report } from './lib.mjs';

const tk = await makeTk();
const ULID = '01J8X4G2ZQ7Y3N9M0P5K6R8T2V';
const ULID2 = '01J8X4G2ZQ7Y3N9M0P5K6R8T2W';
const UUID = '3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b';
const PREFIXED = 'n_01J8X4G2ZQ7Y3N9M0P5K6R8T2X';
const DOTTED = 'n.1:2';       // NCName forbids ':'; '.' is allowed
const SPACED = 'n 1';         // illegal everywhere
const MEASURE_ULID = '01J8X4G2ZQ7Y3N9M0P5K6R8T2M';

const body = `
<measure xml:id="${MEASURE_ULID}" n="1">
  <staff n="1"><layer xml:id="${ULID2}" n="1">
    <note xml:id="${ULID}" pname="c" oct="4" dur="4"/>
    <note xml:id="${UUID}" pname="d" oct="4" dur="4"/>
    <note xml:id="${PREFIXED}" pname="e" oct="4" dur="4"/>
    <note xml:id="${DOTTED}" pname="f" oct="4" dur="4"/>
  </layer></staff>
  <staff n="2"><layer n="1"><note xml:id="${SPACED}" pname="c" oct="3" dur="1"/></layer></staff>
</measure>`;

const ok = tk.loadData(mei(body));
console.log('loadData', ok);
const svg = tk.renderToSVG(1);
const idx = idIndex(svg);
const ids = [MEASURE_ULID, ULID2, ULID, UUID, PREFIXED, DOTTED, SPACED];
report('EXP04 in SVG?', ids.map((id) => ({ id, hits: (idx.get(id) || []).map((h) => h.class) })));
report('EXP04 getElementAttr / getTimeForElement / getMIDIValuesForElement', ids.map((id) => ({ id, attr: tk.getElementAttr(id), ms: tk.getTimeForElement(id), midi: tk.getMIDIValuesForElement(id) })));
const tm = tk.renderToTimemap({ includeMeasures: true, includeRests: true });
report('EXP04 timemap', tm);
const out = tk.getMEI({});
report('EXP04 getMEI re-emits?', ids.map((id) => ({ id, inMei: out.includes(`xml:id="${id}"`) })));
// Show the raw <g> lines for the ULID note to see the exact attribute serialization.
const line = svg.split('\n').find((l) => l.includes(ULID));
report('EXP04 raw svg line for ULID', [line]);
// Also: what does an xml:id with a leading digit look like in getMEI output (any rewrite?)
report('EXP04 getMEI note lines', out.split('\n').filter((l) => /<note /.test(l)).map((l) => l.trim()));
