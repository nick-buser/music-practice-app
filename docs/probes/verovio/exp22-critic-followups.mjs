// Follow-up probes from the F1 critic pass (2026-09-02). Each section pins one
// claim the amended docs cite as `exp22`. Runs from any cwd: node exp22-critic-followups.mjs
import { makeTk } from './lib.mjs';

const doc = (measures, { keysig = '0', scoreDefExtra = '', sectionPrefix = '' } = {}) => `<?xml version="1.0" encoding="UTF-8"?>
<mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="5.0">
<meiHead><fileDesc><titleStmt><title>exp22</title></titleStmt><pubStmt/></fileDesc></meiHead>
<music><body><mdiv><score>
<scoreDef ${scoreDefExtra}><staffGrp xml:id="sg" symbol="brace" bar.thru="true">
  <staffDef xml:id="sd1" n="1" lines="5" clef.shape="G" clef.line="2" meter.count="4" meter.unit="4" keysig="${keysig}"/>
  <staffDef xml:id="sd2" n="2" lines="5" clef.shape="F" clef.line="4" meter.count="4" meter.unit="4" keysig="${keysig}"/>
</staffGrp></scoreDef>
<section xml:id="sec">${sectionPrefix}${measures}</section></score></mdiv></body></music></mei>`;

const bar = (i, rh, lh = '<mRest/>', attrs = '') =>
  `<measure xml:id="m${i}" n="${i}" ${attrs}><staff n="1"><layer n="1">${rh}</layer></staff><staff n="2"><layer n="1">${lh}</layer></staff></measure>`;
const eightBars = Array.from({ length: 8 }, (_, k) => bar(k + 1,
  `<note xml:id="n${k + 1}a" pname="c" oct="4" dur="4"/><note xml:id="n${k + 1}b" pname="d" oct="4" dur="4"/><note xml:id="n${k + 1}c" pname="e" oct="4" dur="2"/>`)).join('');
const measuresIn = (svg) => [...svg.matchAll(/<g id="([^"]+)" class="measure"/g)].map((m) => m[1]);
const count = (s, re) => (s.match(re) || []).length;

// A — windowed timemap when select() runs BEFORE any full-document timemap
{
  const tk = await makeTk();
  tk.loadData(doc(eightBars)); tk.select({ measureRange: '5-8' }); tk.redoLayout(); tk.renderToSVG(1);
  const tm = tk.renderToTimemap({ includeMeasures: true });
  console.log('\n=== EXP22-A select-first: measureRange 5-8 first entry / getTimeForElement n5a');
  console.log(' ', JSON.stringify(tm[0]), tk.getTimeForElement('n5a'));
  tk.loadData(doc(eightBars)); tk.select({ start: 'm5', end: 'm8' }); tk.redoLayout(); tk.renderToSVG(1);
  console.log('  {start:m5,end:m8} first entry', JSON.stringify(tk.renderToTimemap({ includeMeasures: true })[0]));
  tk.loadData(doc(eightBars)); tk.renderToTimemap({ includeMeasures: true }); tk.select({ measureRange: '5-8' }); tk.redoLayout(); tk.renderToSVG(1);
  console.log('  full-timemap-first then select: first entry', JSON.stringify(tk.renderToTimemap({ includeMeasures: true })[0]));
}

// B — cautionary accidental forms (G major, F#): which draws parentheses, which warns
{
  const tk = await makeTk();
  const variants = {
    childCautionOnly: `<note xml:id="b1" pname="f" oct="4" dur="4"><accid xml:id="b1acc" accid="s" func="caution"/></note>`,
    childCautionParen: `<note xml:id="b1" pname="f" oct="4" dur="4"><accid xml:id="b1acc" accid="s" accid.ges="s" func="caution" enclose="paren"/></note>`,
    noteGesPlusChild: `<note xml:id="b1" pname="f" oct="4" dur="4" accid.ges="s"><accid xml:id="b1acc" accid="s" func="caution"/></note>`,
    plainWritten: `<note xml:id="b1" pname="f" oct="4" dur="4" accid="s"/>`,
  };
  console.log('\n=== EXP22-B cautionary accidental (G major, F#): paren glyphs in the whole SVG, accid groups, our accid id kept, pitch');
  for (const [name, note] of Object.entries(variants)) {
    tk.loadData(doc(bar(1, note + `<rest dur="4"/><rest dur="2"/>`), { keysig: '1s' }));
    const svg = tk.renderToSVG(1);
    console.log(' ', name, 'parenGlyphUses', count(svg, /href="#E26[AB]-/g), 'accidGroups', count(svg, /class="accid"/g), 'ourAccidId', svg.includes('id="b1acc"'), 'pitch', tk.getMIDIValuesForElement('b1').pitch);
  }
}

// C — gestural accidental vocabulary
{
  const tk = await makeTk();
  const m = bar(1,
    `<note xml:id="c1" pname="f" oct="4" dur="4" accid.ges="x"/><note xml:id="c2" pname="f" oct="4" dur="4" accid.ges="ss"/>` +
    `<note xml:id="c3" pname="f" oct="4" dur="4" accid="x"/><note xml:id="c4" pname="a" oct="4" dur="4" accid.ges="ff"/>`);
  tk.loadData(doc(m));
  console.log('\n=== EXP22-C accid.ges vocabulary → MIDI pitch (F##=67, Abb=67)');
  for (const id of ['c1', 'c2', 'c3', 'c4']) console.log(' ', id, tk.getMIDIValuesForElement(id).pitch);
}

// D — select({start,end}) failure modes
{
  const tk = await makeTk();
  console.log('\n=== EXP22-D select({start,end}) return value / rendered measures');
  for (const sel of [{ start: 'm5', end: 'm8' }, { start: 'n5a', end: 'n8c' }, { start: 'm5', end: 'zzz' }, { start: 'm9', end: 'm10' }]) {
    tk.loadData(doc(eightBars)); const r = tk.select(sel); tk.redoLayout();
    console.log(' ', JSON.stringify(sel), 'returns', r, 'renders', JSON.stringify(measuresIn(tk.renderToSVG(1))));
  }
}

// E — tempo: midi.bpm precedence on <tempo>, and whether an attribute-only <tempo> draws any text
{
  const tk = await makeTk();
  const tempoAttr = `<tempo xml:id="t1" tstamp="1" staff="1" midi.bpm="90" mm="60" mm.unit="4" mm.dots="1"/>`;
  const tempoText = `<tempo xml:id="t2" tstamp="1" staff="1" midi.bpm="90" mm="60" mm.unit="4" mm.dots="1">Andante <rend fontfam="smufl">&#xECA5;</rend> = 60</tempo>`;
  const m1 = `<measure xml:id="m1" n="1"><staff n="1"><layer n="1"><note xml:id="e1" pname="c" oct="4" dur="1"/></layer></staff><staff n="2"><layer n="1"><mRest/></layer></staff>${tempoAttr}</measure>`;
  const m2 = m1.replace(tempoAttr, tempoText).replace('m1', 'm1').replace('e1', 'e2');
  tk.loadData(doc(m1));
  const svg1 = tk.renderToSVG(1); const t1 = svg1.slice(svg1.indexOf('id="t1"'), svg1.indexOf('id="t1"') + 400);
  console.log('\n=== EXP22-E tempo: midi.bpm=90 + mm.dots → timemap tempo; attribute-only <tempo> text content');
  console.log('  timemap tempo', tk.renderToTimemap({ includeMeasures: true })[0].tempo, '| attr-only tempo <g> has tspan text?', /<tspan[^>]*>[^<]+</.test(t1), '| snippet', t1.replace(/\s+/g, ' ').slice(0, 160));
  tk.loadData(doc(m2, { scoreDefExtra: 'midi.bpm="72"' }));
  const svg2 = tk.renderToSVG(1); const t2 = svg2.slice(svg2.indexOf('id="t2"'), svg2.indexOf('id="t2"') + 600);
  console.log('  scoreDef midi.bpm=72 + tempo midi.bpm=90 → timemap tempo', tk.renderToTimemap({ includeMeasures: true })[0].tempo, '| text tempo has tspan text?', /<tspan[^>]*>[^<]+</.test(t2));
}

// F — breaks:'encoded' with and without <sb/>
{
  const tk = await makeTk({ breaks: 'encoded', pageWidth: 2100, pageHeight: 60000 });
  const withSb = Array.from({ length: 8 }, (_, k) => (k > 0 && k % 4 === 0 ? `<sb xml:id="sb${k}"/>` : '') + bar(k + 1, `<note xml:id="f${k}" pname="c" oct="4" dur="1"/>`)).join('');
  tk.loadData(doc(withSb)); let svg = tk.renderToSVG(1);
  console.log('\n=== EXP22-F breaks:encoded — systems with <sb/> every 4 bars / with no <sb/> (fallback)');
  console.log('  with sb: systems', count(svg, /class="system"/g), 'pages', tk.getPageCount(), 'sb id in svg', svg.includes('id="sb4"'));
  tk.loadData(doc(eightBars)); svg = tk.renderToSVG(1);
  console.log('  no sb:   systems', count(svg, /class="system"/g), 'pages', tk.getPageCount());
}

// G — cross-layer tie: attribute form vs element form
{
  const tk = await makeTk();
  const m = `<measure xml:id="m1" n="1"><staff n="1"><layer n="1"><note xml:id="g1" pname="e" oct="4" dur="1" tie="i"/></layer><layer n="2"><rest dur="1"/></layer></staff><staff n="2"><layer n="1"><mRest/></layer></staff></measure>` +
    `<measure xml:id="m2" n="2"><staff n="1"><layer n="1"><rest dur="1"/></layer><layer n="2"><note xml:id="g2" pname="e" oct="4" dur="1" tie="t"/></layer></staff><staff n="2"><layer n="1"><mRest/></layer></staff></measure>`;
  tk.loadData(doc(m)); const a = count(tk.renderToSVG(1), /class="tie"/g);
  const mElem = m.replace(' tie="i"', '').replace(' tie="t"', '').replace('</measure><measure xml:id="m2"', `<tie xml:id="tieX" startid="#g1" endid="#g2"/></measure><measure xml:id="m2"`);
  tk.loadData(doc(mElem)); const svg = tk.renderToSVG(1);
  console.log('\n=== EXP22-G cross-layer tie: attribute form tie groups / element form tie groups (and our id kept?)');
  console.log('  attribute form', a, '| element form', count(svg, /class="tie/g), 'id tieX present', svg.includes('id="tieX"'));
}

// H — pickup (metcon="false") timing with LH <mRest> vs LH <rest dur="4"/>
{
  const tk = await makeTk();
  const pick = (lh) => bar(0, `<note xml:id="h1" pname="c" oct="4" dur="4"/>`, lh, 'metcon="false"') + bar(1, `<note xml:id="h2" pname="d" oct="4" dur="1"/>`, '<mRest/>');
  console.log('\n=== EXP22-H pickup measure: qstamp of measure 1 with LH <mRest> vs LH <rest dur="4">');
  for (const lh of ['<mRest xml:id="hm"/>', '<rest xml:id="hr" dur="4"/>']) {
    tk.loadData(doc(pick(lh)));
    const tm = tk.renderToTimemap({ includeMeasures: true });
    console.log(' ', lh, '→ measure m1 at qstamp', tm.find((e) => e.measureOn === 'm1')?.qstamp);
  }
}

// I — a one-member <beam>
{
  const tk = await makeTk();
  tk.loadData(doc(bar(1, `<beam xml:id="i1"><note xml:id="i1n" pname="c" oct="4" dur="8"/></beam><rest dur="8"/><note pname="c" oct="4" dur="2"/><rest dur="4"/>`)));
  const svg = tk.renderToSVG(1); const seg = svg.slice(svg.indexOf('id="i1"'), svg.indexOf('id="i1"') + 900);
  console.log('\n=== EXP22-I one-member <beam>: beam polygon present / flag present inside it');
  console.log('  polygon', /<polygon/.test(seg), 'flag', /class="flag"/.test(seg));
}

// J — hairpin with identical start and end
{
  const tk = await makeTk();
  const m = `<measure xml:id="m1" n="1"><staff n="1"><layer n="1"><note xml:id="j1" pname="c" oct="4" dur="2"/><note xml:id="j2" pname="d" oct="4" dur="2"/></layer></staff><staff n="2"><layer n="1"><mRest/></layer></staff><hairpin xml:id="hp1" staff="1" form="cres" startid="#j1" endid="#j1"/><hairpin xml:id="hp2" staff="1" form="cres" startid="#j1" endid="#j2"/></measure>`;
  tk.loadData(doc(m)); const svg = tk.renderToSVG(1);
  const g = (id) => { const i = svg.indexOf(`id="${id}"`); if (i < 0) return '(absent)'; const rest = svg.slice(i); const end = rest.search(/<\/g>|\/>/); return rest.slice(0, end + 4); };
  console.log('\n=== EXP22-J hairpin startid===endid: group content vs a real hairpin');
  console.log('  hp1 same →', g('hp1').replace(/\s+/g, ' ').slice(0, 120));
  console.log('  hp2 real →', g('hp2').replace(/\s+/g, ' ').slice(0, 120));
}

// K — <mRest> ids in the timemap even with includeRests
{
  const tk = await makeTk();
  tk.loadData(doc(bar(1, `<note xml:id="k1" pname="c" oct="4" dur="1"/>`, `<mRest xml:id="kmr"/>`) + bar(2, `<mRest xml:id="kmr2"/>`, `<mRest xml:id="kmr3"/>`)));
  const tm = JSON.stringify(tk.renderToTimemap({ includeMeasures: true, includeRests: true }));
  console.log('\n=== EXP22-K <mRest> ids in timemap with includeRests:true');
  console.log('  kmr mentioned', tm.includes('kmr"'), '| kmr2', tm.includes('kmr2'), '| m2 measureOn present', tm.includes('"measureOn":"m2"'));
}
