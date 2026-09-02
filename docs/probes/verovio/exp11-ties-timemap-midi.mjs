// EXP11: ties — @tie attribute vs <tie> control event; across barline; into a chord. Does the timemap merge tied onsets? Does the MIDI file? Do the two agree?
// Run: node exp11-ties-timemap-midi.mjs
import { makeTk, mei, idIndex, report } from './lib.mjs';

const tk = await makeTk();

// Minimal SMF parser: count note-on (velocity>0) events per track and list their delta times.
function midiNoteOns(b64) {
  const buf = Buffer.from(b64, 'base64');
  let p = 0;
  const u32 = () => (buf[p++] << 24 | buf[p++] << 16 | buf[p++] << 8 | buf[p++]) >>> 0;
  const u16 = () => (buf[p++] << 8 | buf[p++]);
  const vlq = () => { let v = 0, c; do { c = buf[p++]; v = (v << 7) | (c & 0x7f); } while (c & 0x80); return v; };
  if (buf.toString('latin1', 0, 4) !== 'MThd') return 'not MThd';
  p = 8; u16(); const ntrks = u16(); const div = u16();
  const out = { division: div, tracks: [] };
  for (let t = 0; t < ntrks; t++) {
    if (buf.toString('latin1', p, p + 4) !== 'MTrk') return 'bad MTrk';
    p += 4; const len = u32(); const end = p + len; let tick = 0, status = 0; const ons = [], offs = [];
    while (p < end) {
      tick += vlq();
      let b = buf[p];
      if (b & 0x80) { status = b; p++; } // else running status
      const type = status & 0xf0;
      if (status === 0xff) { p++; const l = vlq(); p += l; }
      else if (status === 0xf0 || status === 0xf7) { const l = vlq(); p += l; }
      else if (type === 0x90) { const n = buf[p++], v = buf[p++]; (v > 0 ? ons : offs).push(`${tick}:${n}`); }
      else if (type === 0x80) { const n = buf[p++]; p++; offs.push(`${tick}:${n}`); }
      else if (type === 0xc0 || type === 0xd0) { p++; }
      else { p += 2; }
    }
    out.tracks.push({ ons, offs });
  }
  return out;
}

const cases = {
  attrTie: `<measure xml:id="m1" n="1"><staff n="1"><layer n="1"><note xml:id="a1" pname="c" oct="4" dur="2" tie="i"/><note xml:id="a2" pname="c" oct="4" dur="2" tie="t"/></layer></staff><staff n="2"><layer n="1"><mRest/></layer></staff></measure>`,
  elemTie: `<measure xml:id="m1" n="1"><staff n="1"><layer n="1"><note xml:id="b1" pname="c" oct="4" dur="2"/><note xml:id="b2" pname="c" oct="4" dur="2"/></layer></staff><staff n="2"><layer n="1"><mRest/></layer></staff><tie xml:id="tie1" startid="#b1" endid="#b2"/></measure>`,
  acrossBar: `<measure xml:id="m1" n="1"><staff n="1"><layer n="1"><rest dur="2"/><note xml:id="c1" pname="c" oct="4" dur="2"/></layer></staff><staff n="2"><layer n="1"><mRest/></layer></staff><tie xml:id="tie2" startid="#c1" endid="#c2"/></measure><measure xml:id="m2" n="2"><staff n="1"><layer n="1"><note xml:id="c2" pname="c" oct="4" dur="4"/><rest dur="4"/><rest dur="2"/></layer></staff><staff n="2"><layer n="1"><mRest/></layer></staff></measure>`,
  intoChord: `<measure xml:id="m1" n="1"><staff n="1"><layer n="1"><note xml:id="d1" pname="e" oct="4" dur="2"/><chord xml:id="ch1" dur="2"><note xml:id="d2" pname="c" oct="4"/><note xml:id="d3" pname="e" oct="4"/></chord></layer></staff><staff n="2"><layer n="1"><mRest/></layer></staff><tie xml:id="tie3" startid="#d1" endid="#d3"/></measure>`,
  chainThree: `<measure xml:id="m1" n="1"><staff n="1"><layer n="1"><note xml:id="e1" pname="g" oct="4" dur="4" tie="i"/><note xml:id="e2" pname="g" oct="4" dur="4" tie="m"/><note xml:id="e3" pname="g" oct="4" dur="2" tie="t"/></layer></staff><staff n="2"><layer n="1"><mRest/></layer></staff></measure>`,
};
for (const [name, body] of Object.entries(cases)) {
  console.log('\n#### case', name, 'load', tk.loadData(mei(body)));
  const svg = tk.renderToSVG(1);
  const idx = idIndex(svg);
  report(`EXP11 ${name} tie <g> ids in SVG`, [[...idx.entries()].filter(([, h]) => h[0].class === 'tie').map(([id]) => id)]);
  report(`EXP11 ${name} timemap`, tk.renderToTimemap({ includeMeasures: true, includeRests: true }));
  const midi = midiNoteOns(tk.renderToMIDI());
  report(`EXP11 ${name} MIDI note-ons/offs (tick:pitch)`, [midi]);
  const notes = [...idx.entries()].filter(([, h]) => h[0].class === 'note').map(([id]) => id);
  report(`EXP11 ${name} getMIDIValuesForElement / getTimesForElement`, notes.map((id) => ({ id, midi: tk.getMIDIValuesForElement(id), times: tk.getTimesForElement(id) })));
}
