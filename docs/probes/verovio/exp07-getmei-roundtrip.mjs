// EXP07: getMEI round trip — attribute ordering, ids re-emitted untouched, what Verovio adds, determinism of added ids.
// Run: node exp07-getmei-roundtrip.mjs
import { makeTk, mei, report } from './lib.mjs';

const tk = await makeTk();
// Deliberately odd attribute order: oct before pname, dur first, xml:id last.
const body = `<measure n="1" xml:id="m1">
  <staff n="1"><layer n="1" xml:id="v1">
    <note dur="4" oct="4" pname="c" xml:id="n1" tie="i" artic="stacc"/>
    <note dur="4" oct="4" pname="c" xml:id="n2" tie="t"/>
    <chord dur="2" xml:id="c1"><note oct="4" pname="e" xml:id="n3"/><note oct="4" pname="g"/></chord>
  </layer></staff>
  <staff n="2"><layer n="1"><rest dur="1"/></layer></staff>
  <slur startid="#n1" endid="#n3"/>
</measure>`;
const doc = mei(body);
console.log('loadData', tk.loadData(doc));
tk.renderToSVG(1);
const out1 = tk.getMEI({});
console.log(out1);
report('EXP07 getMEI options tried', [
  { basic: (() => { try { return tk.getMEI({ basic: true }).length; } catch (e) { return String(e); } })() },
  { removeIds: (() => { try { const s = tk.getMEI({ removeIds: true }); return { len: s.length, hasN1: s.includes('xml:id="n1"'), anyIds: (s.match(/xml:id=/g) || []).length }; } catch (e) { return String(e); } })() },
  { scoreBasedFalse: (() => { try { return tk.getMEI({ scoreBased: false }).length; } catch (e) { return String(e); } })() },
]);
// Determinism of Verovio-added ids across loads (the unlabeled note/rest/slur)
console.log('reload', tk.loadData(doc));
const out2 = tk.getMEI({});
report('EXP07 getMEI byte-identical across two loads of the same input?', [{ identical: out1 === out2 }]);
if (out1 !== out2) {
  const a = out1.split('\n'), b = out2.split('\n');
  report('EXP07 differing lines', a.map((l, i) => (l !== b[i] ? { i, a: l.trim(), b: (b[i] || '').trim() } : null)).filter(Boolean).slice(0, 12));
}
