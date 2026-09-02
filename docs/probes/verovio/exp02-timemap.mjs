// EXP02: what the timemap actually contains — notes, chords, rests, ties, grace, tuplets, measures, tempo.
// Run: node exp02-timemap.mjs
import { makeTk, mei, report } from './lib.mjs';

const tk = await makeTk();

const body = `
<measure xml:id="m1" n="1">
  <staff n="1"><layer n="1">
    <note xml:id="g1" pname="b" oct="3" dur="8" grace="acc"/>
    <note xml:id="n1" pname="c" oct="4" dur="4" tie="i"/>
    <note xml:id="n2" pname="c" oct="4" dur="4" tie="t"/>
    <chord xml:id="c1" dur="4"><note xml:id="n3" pname="c" oct="4"/><note xml:id="n4" pname="e" oct="4"/></chord>
    <tuplet xml:id="t1" num="3" numbase="2"><note xml:id="n5" pname="g" oct="4" dur="8"/><note xml:id="n6" pname="a" oct="4" dur="8"/><note xml:id="n7" pname="b" oct="4" dur="8"/></tuplet>
  </layer></staff>
  <staff n="2"><layer n="1"><mRest xml:id="mr1"/></layer></staff>
  <tempo xml:id="tp1" staff="1" tstamp="1" mm="90" mm.unit="4"/>
</measure>
<measure xml:id="m2" n="2">
  <staff n="1"><layer n="1">
    <note xml:id="n8" pname="d" oct="4" dur="2" tie="i"/>
    <note xml:id="n9" pname="d" oct="4" dur="2" tie="t"/>
  </layer></staff>
  <staff n="2"><layer n="1"><rest xml:id="r1" dur="2"/><space xml:id="sp1" dur="2"/></layer></staff>
  <tempo xml:id="tp2" staff="1" tstamp="3" mm="60" mm.unit="4"/>
</measure>
<measure xml:id="m3" n="3">
  <staff n="1"><layer n="1"><note xml:id="n10" pname="e" oct="4" dur="1"/></layer></staff>
  <staff n="2"><layer n="1"><note xml:id="n11" pname="c" oct="3" dur="1"/></layer></staff>
</measure>`;

console.log('loadData', tk.loadData(mei(body)));
tk.renderToSVG(1);
const tmAll = tk.renderToTimemap({ includeMeasures: true, includeRests: true });
report('EXP02 timemap includeMeasures+includeRests', tmAll);
const tmApp = tk.renderToTimemap({ includeMeasures: true, includeRests: false });
report('EXP02 timemap as app calls it (includeRests:false) — keys used', [[...new Set(tmApp.flatMap((e) => Object.keys(e)))]]);

// Does any entry mention the chord id, the tuplet id, the grace id, the tie-second-note id?
const mentions = (id) => tmAll.filter((e) => JSON.stringify(e).includes(`"${id}"`)).map((e) => e.qstamp);
report('EXP02 which qstamps mention each id', ['c1','t1','g1','n1','n2','n8','n9','mr1','r1','sp1','tp1','tp2','m1','m2','m3'].map((id) => ({ id, at: mentions(id) })));

// Per-element times for the tied pair and the chord.
report('EXP02 getTimeForElement', ['g1','n1','n2','c1','n3','n8','n9','t1','r1','mr1','sp1','m2','tp2'].map((id) => ({ id, ms: tk.getTimeForElement(id) })));
report('EXP02 getMIDIValuesForElement', ['g1','n1','n2','c1','n3','n8','n9','r1','m2'].map((id) => ({ id, v: tk.getMIDIValuesForElement(id) })));
