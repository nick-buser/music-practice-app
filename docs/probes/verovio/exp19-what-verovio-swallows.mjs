// EXP19: what does loadData accept silently? Overfull voice (5 quarters in 4/4), underfull voice, a measure missing staff 2, a note with no dur, unknown element, dur on chord-notes disagreeing with chord, two layers with the same n. The zod schema must catch whatever Verovio does not.
// Run: node exp19-what-verovio-swallows.mjs
import { makeTk, mei, parseGroups, report } from './lib.mjs';

const tk = await makeTk();
const cases = {
  overfull5q: `<measure xml:id="m1" n="1"><staff n="1"><layer n="1"><note xml:id="o1" pname="c" oct="4" dur="4"/><note xml:id="o2" pname="d" oct="4" dur="4"/><note xml:id="o3" pname="e" oct="4" dur="4"/><note xml:id="o4" pname="f" oct="4" dur="4"/><note xml:id="o5" pname="g" oct="4" dur="4"/></layer></staff><staff n="2"><layer n="1"><note xml:id="o6" pname="c" oct="3" dur="1"/></layer></staff></measure><measure xml:id="m2" n="2"><staff n="1"><layer n="1"><note xml:id="o7" pname="c" oct="5" dur="1"/></layer></staff><staff n="2"><layer n="1"><note xml:id="o8" pname="c" oct="3" dur="1"/></layer></staff></measure>`,
  underfull2q: `<measure xml:id="m1" n="1"><staff n="1"><layer n="1"><note xml:id="u1" pname="c" oct="4" dur="4"/><note xml:id="u2" pname="d" oct="4" dur="4"/></layer></staff><staff n="2"><layer n="1"><note xml:id="u3" pname="c" oct="3" dur="1"/></layer></staff></measure><measure xml:id="m2" n="2"><staff n="1"><layer n="1"><note xml:id="u4" pname="c" oct="5" dur="1"/></layer></staff><staff n="2"><layer n="1"><note xml:id="u5" pname="c" oct="3" dur="1"/></layer></staff></measure>`,
  missingStaff2: `<measure xml:id="m1" n="1"><staff n="1"><layer n="1"><note xml:id="s1" pname="c" oct="4" dur="1"/></layer></staff></measure><measure xml:id="m2" n="2"><staff n="1"><layer n="1"><note xml:id="s2" pname="c" oct="5" dur="1"/></layer></staff><staff n="2"><layer n="1"><note xml:id="s3" pname="c" oct="3" dur="1"/></layer></staff></measure>`,
  noDur: `<measure xml:id="m1" n="1"><staff n="1"><layer n="1"><note xml:id="d1" pname="c" oct="4"/><note xml:id="d2" pname="d" oct="4" dur="2"/></layer></staff><staff n="2"><layer n="1"><mRest/></layer></staff></measure>`,
  unknownElement: `<measure xml:id="m1" n="1"><staff n="1"><layer n="1"><note xml:id="x1" pname="c" oct="4" dur="2"/><banana xml:id="x2"/><note xml:id="x3" pname="d" oct="4" dur="2"/></layer></staff><staff n="2"><layer n="1"><mRest/></layer></staff></measure>`,
  chordNoteDurMismatch: `<measure xml:id="m1" n="1"><staff n="1"><layer n="1"><chord xml:id="ch1" dur="2"><note xml:id="y1" pname="c" oct="4" dur="8"/><note xml:id="y2" pname="e" oct="4"/></chord><rest dur="2"/></layer></staff><staff n="2"><layer n="1"><mRest/></layer></staff></measure>`,
  duplicateLayerN: `<measure xml:id="m1" n="1"><staff n="1"><layer xml:id="la" n="1"><note xml:id="z1" pname="c" oct="4" dur="1"/></layer><layer xml:id="lb" n="1"><note xml:id="z2" pname="e" oct="4" dur="1"/></layer></staff><staff n="2"><layer n="1"><mRest/></layer></staff></measure>`,
  badPname: `<measure xml:id="m1" n="1"><staff n="1"><layer n="1"><note xml:id="p1" pname="h" oct="4" dur="1"/></layer></staff><staff n="2"><layer n="1"><mRest/></layer></staff></measure>`,
  tupletNoNum: `<measure xml:id="m1" n="1"><staff n="1"><layer n="1"><tuplet xml:id="tq"><note xml:id="q1" pname="c" oct="4" dur="8"/><note xml:id="q2" pname="d" oct="4" dur="8"/><note xml:id="q3" pname="e" oct="4" dur="8"/></tuplet><rest dur="2"/><rest dur="4"/></layer></staff><staff n="2"><layer n="1"><mRest/></layer></staff></measure>`,
  noMeiHead: null,
};
for (const [name, body] of Object.entries(cases)) {
  const doc = body === null
    ? `<mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="5.0"><music><body><mdiv><score><scoreDef><staffGrp><staffDef n="1" lines="5" clef.shape="G" clef.line="2"/></staffGrp></scoreDef><section><measure n="1"><staff n="1"><layer n="1"><note xml:id="h1" pname="c" oct="4" dur="1"/></layer></staff></measure></section></score></mdiv></body></music></mei>`
    : mei(body);
  const ok = tk.loadData(doc);
  let svgInfo = null, tm = null;
  try {
    const svg = tk.renderToSVG(1);
    const gs = parseGroups(svg);
    svgInfo = { notes: gs.filter((g) => g.class === 'note').map((g) => g.id), staves: gs.filter((g) => g.class === 'staff').length, measures: gs.filter((g) => g.class === 'measure').length };
    tm = tk.renderToTimemap({ includeMeasures: true }).map((e) => `${e.qstamp}/${e.tstamp}:${(e.on || []).join('+')}${e.measureOn ? ' [' + e.measureOn + ']' : ''}`);
  } catch (e) { svgInfo = String(e); }
  report(`EXP19 ${name}`, [{ loadData: ok, log: tk.getLog().trim().slice(0, 300) }, svgInfo, tm]);
}
