// EXP15: foreign-tier id stability — does Verovio keep MusicXML 3.1 `id` attributes on <note>/<measure>? Does a foreign MEI keep its xml:ids? (The doc offers "render-level element ids" as foreign anchors.)
// Run: node exp15-musicxml-ids.mjs
import { makeTk, idIndex, report } from './lib.mjs';

const tk = await makeTk();
const musicxml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1"><part-list><score-part id="P1"><part-name>P</part-name></score-part></part-list>
<part id="P1"><measure number="1" id="mx-m1"><attributes><divisions>2</divisions><key><fifths>1</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
<note id="mx-n1"><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>
<note id="mx-n2"><pitch><step>F</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>
<note id="mx-n3"><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>eighth</type><beam number="1">begin</beam></note>
<note id="mx-n4"><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>eighth</type><beam number="1">end</beam></note>
<note id="mx-r1"><rest/><duration>2</duration><type>quarter</type></note>
</measure></part></score-partwise>`;
console.log('load', tk.loadData(musicxml));
let svg = tk.renderToSVG(1);
let idx = idIndex(svg);
report('EXP15 MusicXML id attrs kept?', ['mx-m1','mx-n1','mx-n2','mx-n3','mx-n4','mx-r1'].map((id) => ({ id, inSvg: idx.has(id) })));
report('EXP15 MusicXML: note/measure ids Verovio produced', [[...idx.entries()].filter(([, h]) => ['note','measure','rest','beam'].includes(h[0].class)).map(([id, h]) => `${h[0].class}:${id}`)]);
report('EXP15 MusicXML F4 in G major → pitch (MusicXML has no explicit alter here)', [{ pitch: tk.getMIDIValuesForElement([...idx.entries()].filter(([, h]) => h[0].class === 'note')[1][0]).pitch }]);
// getMEI of the converted MusicXML — this is what SC8's importer would consume if it goes MusicXML→MEI→ScoreDoc via Verovio.
const out = tk.getMEI({});
report('EXP15 MusicXML → getMEI (note lines)', out.split('\n').filter((l) => /<(note|beam|rest|measure|staffDef|keySig)/.test(l)).map((l) => l.trim().slice(0, 160)));
