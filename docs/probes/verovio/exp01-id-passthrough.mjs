// EXP01: xml:id passthrough into SVG for every element kind in the doc's v1 scope.
// Run: node exp01-id-passthrough.mjs
import { makeTk, mei, idIndex, report } from './lib.mjs';

const tk = await makeTk();
console.log('verovio', tk.getVersion());

const body = `
<measure xml:id="m1" n="1">
  <staff xml:id="st1_1" n="1">
    <layer xml:id="v1_1" n="1">
      <beam xml:id="b1"><note xml:id="n1" pname="c" oct="4" dur="8" tie="i"/><note xml:id="n2" pname="c" oct="4" dur="8" tie="t"/></beam>
      <note xml:id="n3" pname="e" oct="4" dur="8" dots="1"><artic xml:id="a1" artic="stacc"/></note>
      <note xml:id="n4" pname="f" oct="4" dur="16" accid="s"/>
      <tuplet xml:id="t1" num="3" numbase="2"><note xml:id="n5" pname="g" oct="4" dur="8"/><rest xml:id="r1" dur="8"/><note xml:id="n6" pname="a" oct="4" dur="8"/></tuplet>
      <chord xml:id="c1" dur="4"><note xml:id="n7" pname="c" oct="4"/><note xml:id="n8" pname="e" oct="4"/><note xml:id="n9" pname="g" oct="4"/></chord>
    </layer>
    <layer xml:id="v1_2" n="2">
      <space xml:id="sp1" dur="2"/>
      <note xml:id="n10" pname="a" oct="3" dur="2" artic="ten"/>
    </layer>
  </staff>
  <staff xml:id="st1_2" n="2">
    <layer xml:id="v2_1" n="1"><mRest xml:id="mr1"/></layer>
  </staff>
  <slur xml:id="sl1" startid="#n3" endid="#n5"/>
  <tie xml:id="ti1" startid="#n9" endid="#n12"/>
  <dynam xml:id="d1" staff="1" tstamp="1">mf</dynam>
  <tempo xml:id="tp1" staff="1" tstamp="1" mm="96" mm.unit="4">Andante</tempo>
  <fing xml:id="f1" staff="1" startid="#n1">1</fing>
  <hairpin xml:id="h1" staff="1" tstamp="1" tstamp2="0m+4" form="cres"/>
  <dir xml:id="dir1" staff="1" tstamp="3">rit.</dir>
  <fermata xml:id="fe1" staff="1" startid="#n10"/>
</measure>
<scoreDef xml:id="sdef2"><staffGrp><staffDef n="1" keysig="2s" meter.count="3" meter.unit="4"/><staffDef n="2" keysig="2s" meter.count="3" meter.unit="4"/></staffGrp></scoreDef>
<measure xml:id="m2" n="2">
  <staff n="1"><layer n="1">
    <clef xml:id="cl1" shape="F" line="4"/>
    <note xml:id="n11" pname="c" oct="3" dur="2"/>
    <note xml:id="n12" pname="g" oct="4" dur="4"/>
  </layer></staff>
  <staff n="2"><layer n="1">
    <keySig xml:id="ks1" sig="1f"/><meterSig xml:id="ms1" count="3" unit="4"/>
    <note xml:id="n13" pname="c" oct="3" dur="2" dots="1"/>
  </layer></staff>
</measure>`;

const doc = mei(body);
const ok = tk.loadData(doc);
console.log('loadData', ok);
const svg = tk.renderToSVG(1);
const idx = idIndex(svg);

const wanted = ['sg1','sd1','sd2','sec1','m1','st1_1','v1_1','b1','n1','n2','n3','a1','n4','t1','n5','r1','n6','c1','n7','n8','n9','v1_2','sp1','n10','st1_2','v2_1','mr1','sl1','ti1','d1','tp1','f1','h1','dir1','fe1','sdef2','m2','cl1','n11','n12','n13','ks1','ms1'];
const rows = wanted.map((id) => {
  const hits = idx.get(id) || [];
  return { id, inSvg: hits.length, tag: hits.map((h) => h.name).join(','), class: hits.map((h) => h.class).join(',') , parent: hits.map((h) => `${h.parent?.id ?? '-'}:${h.parent?.class ?? h.parent?.name}`).join(',') };
});
report('EXP01 id passthrough (in SVG? tag/class/parent)', rows);

// Which ids in the SVG did WE NOT supply (Verovio-minted) and what classes are they?
const ours = new Set(wanted);
const minted = [...idx.entries()].filter(([id]) => !ours.has(id)).map(([id, hits]) => `${id} → ${hits.map((h)=>`${h.name}.${h.class}`).join(',')}`);
report('EXP01 Verovio-minted ids present in SVG (not ours)', minted);

// Does the measure <g> carry n or any data-* attribute we could use instead of positional indexing?
const mg = idx.get('m1')?.[0];
report('EXP01 measure g attrs', [mg?.attrs]);
