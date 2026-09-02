// EXP17: tempo encoding forms (tempo@mm + mm.unit + mm.dots, scoreDef@midi.bpm, text-only tempo), dotted durations in qstamp, and whether an all-mRest measure still gets a measureOn entry (cursor needs measure boundaries).
// Run: node exp17-tempo-units-silent-measures.mjs
import { makeTk, mei, report } from './lib.mjs';

const tk = await makeTk();
const twoBars = (tempoXml, extraDef = '') => mei(`
<measure xml:id="m1" n="1"><staff n="1"><layer n="1"><note xml:id="a1" pname="c" oct="4" dur="4" dots="2"/><note xml:id="a2" pname="d" oct="4" dur="16"/><note xml:id="a3" pname="e" oct="4" dur="2"/></layer></staff><staff n="2"><layer n="1"><mRest xml:id="mr1"/></layer></staff>${tempoXml}</measure>
<measure xml:id="m2" n="2"><staff n="1"><layer n="1"><mRest xml:id="mr2"/></layer></staff><staff n="2"><layer n="1"><mRest xml:id="mr3"/></layer></staff></measure>
<measure xml:id="m3" n="3"><staff n="1"><layer n="1"><note xml:id="a4" pname="c" oct="5" dur="1"/></layer></staff><staff n="2"><layer n="1"><mRest xml:id="mr4"/></layer></staff></measure>`, { scoreDefAttrs: extraDef });

const cases = {
  'tempo mm=60 mm.unit=4': twoBars('<tempo xml:id="tp" staff="1" tstamp="1" mm="60" mm.unit="4"/>'),
  'tempo mm=60 mm.unit=8 (should be 30 qpm)': twoBars('<tempo xml:id="tp" staff="1" tstamp="1" mm="60" mm.unit="8"/>'),
  'tempo mm=60 mm.unit=4 mm.dots=1 (dotted quarter = 60 → 90 qpm)': twoBars('<tempo xml:id="tp" staff="1" tstamp="1" mm="60" mm.unit="4" mm.dots="1"/>'),
  'tempo mm=60 mm.unit=2 (half=60 → 120 qpm)': twoBars('<tempo xml:id="tp" staff="1" tstamp="1" mm="60" mm.unit="2"/>'),
  'tempo text only "Adagio"': twoBars('<tempo xml:id="tp" staff="1" tstamp="1">Adagio</tempo>'),
  'scoreDef midi.bpm=72, no tempo element': twoBars('', 'midi.bpm="72"'),
  'scoreDef midi.bpm=72 AND tempo mm=100': twoBars('<tempo xml:id="tp" staff="1" tstamp="1" mm="100" mm.unit="4"/>', 'midi.bpm="72"'),
  'no tempo at all': twoBars(''),
};
for (const [name, doc] of Object.entries(cases)) {
  tk.loadData(doc);
  tk.renderToSVG(1);
  const tm = tk.renderToTimemap({ includeMeasures: true, includeRests: true });
  report(`EXP17 ${name}`, tm.map((e) => `q=${e.qstamp} t=${e.tstamp}${e.tempo !== undefined ? ' tempo=' + e.tempo : ''}${e.measureOn ? ' measureOn=' + e.measureOn : ''} on=${(e.on || []).join(',')} rests=${(e.restsOn || []).join(',')}`));
}
