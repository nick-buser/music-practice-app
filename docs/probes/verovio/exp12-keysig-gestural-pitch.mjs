// EXP12: what MIDI pitch Verovio assigns when a note's written accidental is implied by the key signature, by a prior accidental in the bar, or by accid.ges — i.e. which MEI attributes toMei() must emit for ScoreDoc's absolute `alter` to round-trip into assessment.
// Run: node exp12-keysig-gestural-pitch.mjs
import { makeTk, mei, report } from './lib.mjs';

const tk = await makeTk();
// Key of G major (1 sharp). Notes: f4 bare; f4 accid="n"; f4 accid.ges="s"; f4 accid="s"; then a bar with f# then plain f (carry-over rule); then next bar plain f (reset).
const body = `
<measure xml:id="m1" n="1"><staff n="1"><layer n="1">
  <note xml:id="k1" pname="f" oct="4" dur="4"/>
  <note xml:id="k2" pname="f" oct="4" dur="4" accid="n"/>
  <note xml:id="k3" pname="f" oct="4" dur="4" accid.ges="s"/>
  <note xml:id="k4" pname="f" oct="4" dur="4" accid="s"/>
</layer></staff><staff n="2"><layer n="1"><mRest/></layer></staff></measure>
<measure xml:id="m2" n="2"><staff n="1"><layer n="1">
  <note xml:id="k5" pname="c" oct="5" dur="4" accid="s"/>
  <note xml:id="k6" pname="c" oct="5" dur="4"/>
  <note xml:id="k7" pname="c" oct="4" dur="4"/>
  <note xml:id="k8" pname="c" oct="5" dur="4" accid.ges="n"/>
</layer></staff><staff n="2"><layer n="1"><mRest/></layer></staff></measure>
<measure xml:id="m3" n="3"><staff n="1"><layer n="1">
  <note xml:id="k9" pname="c" oct="5" dur="2"/>
  <note xml:id="k10" pname="f" oct="4" dur="2" accid="f"/>
</layer></staff><staff n="2"><layer n="1"><mRest/></layer></staff></measure>`;
const doc = mei(body).replace(/keysig="0"/g, 'keysig="1s"');
console.log('loadData', tk.loadData(doc));
tk.renderToSVG(1);
report('EXP12 G major: MIDI pitch per note (F#=66 F=65; C#=73 C=72; Fb=64)', ['k1','k2','k3','k4','k5','k6','k7','k8','k9','k10'].map((id) => ({ id, attr: tk.getElementAttr(id), pitch: tk.getMIDIValuesForElement(id).pitch })));
// getElementAttr: does it report accid.ges? does it report the *resolved* accidental?
