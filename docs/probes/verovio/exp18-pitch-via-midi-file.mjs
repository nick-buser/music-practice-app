// EXP18: double-confirm EXP12 through renderToMIDI (the file Verovio would hand a synth), and test keySig-as-element vs keysig-attr, accid + accid.ges together, and the bass staff.
// Run: node exp18-pitch-via-midi-file.mjs
import { makeTk, mei, report } from './lib.mjs';

const tk = await makeTk();
function midiPitches(b64) {
  const buf = Buffer.from(b64, 'base64'); let p = 14; const out = [];
  const u32 = () => (buf[p++] << 24 | buf[p++] << 16 | buf[p++] << 8 | buf[p++]) >>> 0;
  const vlq = () => { let v = 0, c; do { c = buf[p++]; v = (v << 7) | (c & 0x7f); } while (c & 0x80); return v; };
  while (p < buf.length) {
    if (buf.toString('latin1', p, p + 4) !== 'MTrk') break;
    p += 4; const len = u32(); const end = p + len; let status = 0, tick = 0;
    while (p < end) {
      tick += vlq(); const b = buf[p]; if (b & 0x80) { status = b; p++; }
      const t = status & 0xf0;
      if (status === 0xff) { p++; const l = vlq(); p += l; }
      else if (status === 0xf0 || status === 0xf7) { const l = vlq(); p += l; }
      else if (t === 0x90) { const n = buf[p++], v = buf[p++]; if (v > 0) out.push(`${tick}:${n}`); }
      else if (t === 0x80) { p += 2; }
      else if (t === 0xc0 || t === 0xd0) { p++; } else { p += 2; }
    }
  }
  return out;
}

const bodyAttrKey = `<measure xml:id="m1" n="1"><staff n="1"><layer n="1">
  <note xml:id="k1" pname="f" oct="4" dur="4"/>
  <note xml:id="k2" pname="f" oct="4" dur="4" accid="s"/>
  <note xml:id="k3" pname="f" oct="4" dur="4"/>
  <note xml:id="k4" pname="f" oct="4" dur="4" accid="n" accid.ges="s"/>
</layer></staff><staff n="2"><layer n="1"><note xml:id="k5" pname="f" oct="2" dur="1"/></layer></staff></measure>`;
tk.loadData(mei(bodyAttrKey).replace(/keysig="0"/g, 'keysig="1s"'));
tk.renderToSVG(1);
report('EXP18 keysig="1s" attr — getMIDIValuesForElement pitches', ['k1','k2','k3','k4','k5'].map((id) => `${id}=${tk.getMIDIValuesForElement(id).pitch}`));
report('EXP18 keysig="1s" attr — renderToMIDI note-ons (tick:pitch)', [midiPitches(tk.renderToMIDI())]);

// keySig as child element of staffDef (MEI 5 preferred form)
const docElemKey = mei(bodyAttrKey).replace(/keysig="0" \/>/g, '><keySig sig="1s"/></staffDef>');
console.log('load elemKey', tk.loadData(docElemKey));
tk.renderToSVG(1);
report('EXP18 <keySig sig="1s"/> element — pitches', ['k1','k2','k3','k4','k5'].map((id) => `${id}=${tk.getMIDIValuesForElement(id).pitch}`));
report('EXP18 <keySig> element — renderToMIDI', [midiPitches(tk.renderToMIDI())]);
report('EXP18 timemap note order same staff-time', [tk.renderToTimemap({}).map((e) => `${e.qstamp}:${(e.on||[]).join('+')}`)]);
