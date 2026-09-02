// EXP05: foreign inputs (ABC, MusicXML, id-less MEI) — are Verovio-minted ids stable across loads? Across toolkit instances? With xmlIdSeed / xmlIdChecksum?
// Run: node exp05-foreign-determinism.mjs
import { makeTk, mei, idIndex, report } from './lib.mjs';

const tk = await makeTk();
const opts = tk.getOptions();
const avail = tk.getAvailableOptions();
const allNames = Object.values(avail.groups).flatMap((g) => Object.keys(g.options));
report('EXP05 option names matching id/svg', allNames.filter((n) => /xmlId|svg|Ids?$|remove|checksum|seed/i.test(n)).map((n) => {
  const g = Object.values(avail.groups).find((g) => g.options[n]);
  return { n, ...g.options[n] };
}));

const abc = `X:1\nT:t\nM:4/4\nL:1/4\nK:C\nC D E F | G A B c |]`;
const musicxml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1"><part-list><score-part id="P1"><part-name>P</part-name></score-part></part-list>
<part id="P1"><measure number="1"><attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
<note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
<note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><type>half</type></note>
</measure></part></score-partwise>`;
const meiNoIds = mei(`<measure n="1"><staff n="1"><layer n="1"><note pname="c" oct="4" dur="4"/><note pname="d" oct="4" dur="4"/><rest dur="2"/></layer></staff><staff n="2"><layer n="1"><mRest/></layer></staff></measure>`);

function noteIds(tkx, data, extra = {}) {
  tkx.setOptions(extra);
  tkx.loadData(data);
  const svg = tkx.renderToSVG(1);
  const idx = idIndex(svg);
  return [...idx.entries()].filter(([, h]) => h.some((x) => x.class === 'note' || x.class === 'measure' || x.class === 'rest')).map(([id, h]) => `${h[0].class}:${id}`);
}

for (const [label, data] of [['ABC', abc], ['MusicXML', musicxml], ['MEI(no ids)', meiNoIds]]) {
  const a = noteIds(tk, data);
  const b = noteIds(tk, data);
  report(`EXP05 ${label} — same toolkit, two loads`, [{ first: a }, { second: b }, { identical: JSON.stringify(a) === JSON.stringify(b) }]);
  const tk2 = await makeTk();
  const c = noteIds(tk2, data);
  report(`EXP05 ${label} — fresh toolkit instance`, [{ third: c }, { identicalToFirst: JSON.stringify(a) === JSON.stringify(c) }]);
}

// xmlIdSeed: same seed → same ids across loads / instances?
for (const [label, data] of [['ABC', abc], ['MusicXML', musicxml], ['MEI(no ids)', meiNoIds]]) {
  const s1 = noteIds(tk, data, { xmlIdSeed: 42 });
  const s2 = noteIds(tk, data, { xmlIdSeed: 42 });
  const tk3 = await makeTk({ xmlIdSeed: 42 });
  const s3 = noteIds(tk3, data);
  const s4 = noteIds(tk, data, { xmlIdSeed: 43 });
  report(`EXP05 ${label} — xmlIdSeed=42 twice, fresh instance seed 42, seed 43`, [{ s1 }, { s2 }, { s3 }, { s4 }, { s1_eq_s2: JSON.stringify(s1) === JSON.stringify(s2), s1_eq_s3: JSON.stringify(s1) === JSON.stringify(s3), s1_eq_s4: JSON.stringify(s1) === JSON.stringify(s4) }]);
  // does re-setting the seed to 42 after other loads restore the sequence?
  const s5 = noteIds(tk, data, { xmlIdSeed: 42 });
  report(`EXP05 ${label} — seed 42 re-set after seed 43 load`, [{ s5 }, { s5_eq_s1: JSON.stringify(s5) === JSON.stringify(s1) }]);
}

// xmlIdChecksum
for (const [label, data] of [['ABC', abc], ['MusicXML', musicxml], ['MEI(no ids)', meiNoIds]]) {
  tk.setOptions({ xmlIdSeed: 0 });
  const c1 = noteIds(tk, data, { xmlIdChecksum: true });
  const c2 = noteIds(tk, data, { xmlIdChecksum: true });
  const tk4 = await makeTk({ xmlIdChecksum: true });
  const c3 = noteIds(tk4, data);
  // does a one-character change in the input change every id?
  const c4 = noteIds(tk, data.replace('oct="4" dur="4"/>', 'oct="5" dur="4"/>').replace('C D E F', 'C D E G').replace('<step>D</step>', '<step>F</step>'), { xmlIdChecksum: true });
  report(`EXP05 ${label} — xmlIdChecksum`, [{ c1 }, { c2 }, { c3 }, { c4 }, { c1_eq_c2: JSON.stringify(c1) === JSON.stringify(c2), c1_eq_c3: JSON.stringify(c1) === JSON.stringify(c3), c1_eq_c4_afterEdit: JSON.stringify(c1) === JSON.stringify(c4) }]);
  tk.setOptions({ xmlIdChecksum: false });
}
