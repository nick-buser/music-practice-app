// EXP08: duplicate xml:id in the input — load result, SVG, timemap, API resolution.
// Run: node exp08-duplicate-ids.mjs
import { makeTk, mei, idIndex, report } from './lib.mjs';

const tk = await makeTk();
const body = `<measure xml:id="m1" n="1">
  <staff n="1"><layer n="1">
    <note xml:id="dup" pname="c" oct="4" dur="4"/>
    <note xml:id="dup" pname="e" oct="4" dur="4"/>
    <note xml:id="n3" pname="g" oct="4" dur="2"/>
  </layer></staff>
  <staff n="2"><layer n="1"><note xml:id="dup" pname="c" oct="3" dur="1"/></layer></staff>
</measure>
<measure xml:id="m1" n="2">
  <staff n="1"><layer n="1"><note xml:id="n4" pname="c" oct="5" dur="1"/></layer></staff>
  <staff n="2"><layer n="1"><mRest/></layer></staff>
</measure>`;
const ok = tk.loadData(mei(body));
console.log('loadData', ok);
const svg = tk.renderToSVG(1);
const idx = idIndex(svg);
report('EXP08 svg occurrences', [{ dup: (idx.get('dup') || []).map((h) => h.class), m1: (idx.get('m1') || []).map((h) => h.class) }]);
report('EXP08 API on dup', [{ attr: tk.getElementAttr('dup'), ms: tk.getTimeForElement('dup'), midi: tk.getMIDIValuesForElement('dup'), page: tk.getPageWithElement('dup') }]);
report('EXP08 timemap', tk.renderToTimemap({ includeMeasures: true }));
const out = tk.getMEI({});
report('EXP08 getMEI xml:id="dup" count / m1 count', [{ dup: (out.match(/xml:id="dup"/g) || []).length, m1: (out.match(/xml:id="m1"/g) || []).length }]);
report('EXP08 getLog', [tk.getLog()]);
