// EXP03: the element-addressed toolkit API — what each call returns for chord vs note vs rest vs measure ids.
// Run: node exp03-element-api.mjs
import { makeTk, mei, report } from './lib.mjs';

const tk = await makeTk();
const body = `
<measure xml:id="m1" n="1">
  <staff n="1"><layer xml:id="v1" n="1">
    <note xml:id="n1" pname="c" oct="4" dur="4"/>
    <chord xml:id="c1" dur="4"><note xml:id="n2" pname="c" oct="4"/><note xml:id="n3" pname="e" oct="4"/></chord>
    <rest xml:id="r1" dur="4"/>
    <tuplet xml:id="t1" num="3" numbase="2"><note xml:id="n4" pname="g" oct="4" dur="8"/><note xml:id="n5" pname="a" oct="4" dur="8"/><note xml:id="n6" pname="b" oct="4" dur="8"/></tuplet>
  </layer></staff>
  <staff n="2"><layer n="1"><note xml:id="n7" pname="c" oct="3" dur="1"/></layer></staff>
  <slur xml:id="sl1" startid="#n1" endid="#n2"/>
  <dynam xml:id="d1" staff="1" tstamp="1">p</dynam>
</measure>
<measure xml:id="m2" n="2">
  <staff n="1"><layer n="1"><note xml:id="n8" pname="c" oct="5" dur="1"/></layer></staff>
  <staff n="2"><layer n="1"><mRest xml:id="mr1"/></layer></staff>
</measure>`;
console.log('loadData', tk.loadData(mei(body)));
tk.renderToSVG(1);

const ids = ['n1','c1','n2','r1','t1','n4','n7','sl1','d1','m1','v1','mr1','n8','nope'];
report('EXP03 getElementAttr', ids.map((id) => ({ id, attr: tk.getElementAttr(id) })));
report('EXP03 getTimeForElement', ids.map((id) => ({ id, ms: tk.getTimeForElement(id) })));
report('EXP03 getMIDIValuesForElement', ids.map((id) => ({ id, v: tk.getMIDIValuesForElement(id) })));
report('EXP03 getPageWithElement', ids.map((id) => ({ id, page: tk.getPageWithElement(id) })));
report('EXP03 getNotatedIdForElement', ids.map((id) => ({ id, notated: tk.getNotatedIdForElement(id) })));
report('EXP03 getExpansionIdsForElement', ids.map((id) => ({ id, exp: tk.getExpansionIdsForElement(id) })));
report('EXP03 getElementsAtTime', [0, 250, 500, 1000, 1200, 1500, 2000, 2100, 3500].map((ms) => ({ ms, r: tk.getElementsAtTime(ms) })));
report('EXP03 getTimesForElement', ['n1','c1','n2','r1'].map((id) => { try { return { id, t: tk.getTimesForElement(id) }; } catch (e) { return { id, err: String(e) }; } }));
report('EXP03 getDescriptiveFeatures', [(() => { try { return tk.getDescriptiveFeatures({}); } catch (e) { return String(e); } })()]);
