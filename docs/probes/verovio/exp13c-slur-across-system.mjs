// EXP13c: a slur / tie / hairpin that provably crosses a system break — print which system each measure landed on, then count <g id> per spanning element and where the pieces sit.
// Run: node exp13c-slur-across-system.mjs
import { makeTk, mei, parseGroups, report } from './lib.mjs';

const tk = await makeTk();
let body = '';
for (let i = 1; i <= 6; i++) {
  body += `<measure xml:id="m${i}" n="${i}"><staff n="1"><layer n="1"><note xml:id="n${i}a" pname="c" oct="5" dur="4"/><note xml:id="n${i}b" pname="d" oct="5" dur="4"/><note xml:id="n${i}c" pname="e" oct="5" dur="4"/><note xml:id="n${i}d" pname="f" oct="5" dur="4"/></layer></staff><staff n="2"><layer n="1"><note xml:id="n${i}e" pname="c" oct="3" dur="1"/></layer></staff>`;
  if (i === 1) body += `<slur xml:id="slurLong" startid="#n1a" endid="#n6d"/><hairpin xml:id="hpLong" staff="1" tstamp="1" tstamp2="5m+4" form="cres"/><tie xml:id="tieLong" startid="#n1e" endid="#n2e"/>`;
  if (i === 2) body += `<tie xml:id="tie23" startid="#n2e" endid="#n3e"/>`;
  if (i === 3) body += `<tie xml:id="tie34" startid="#n3e" endid="#n4e"/>`;
  body += `</measure>\n`;
}
tk.setOptions({ breaks: 'auto', pageWidth: 900, pageHeight: 60000, adjustPageHeight: true });
console.log('load', tk.loadData(mei(body)));
const svg = tk.renderToSVG(1);
const gs = parseGroups(svg);
const sysOf = (g) => { let p = g; while (p && p.class !== 'system') p = p.parent; return p?.id; };
const systems = [...new Set(gs.filter((g) => g.class === 'system').map((g) => g.id))];
report('EXP13c measure → system index', gs.filter((g) => g.class === 'measure').map((g) => `${g.id} → sys${systems.indexOf(sysOf(g))}`));
for (const id of ['slurLong', 'hpLong', 'tieLong', 'tie23', 'tie34']) {
  const hits = gs.filter((g) => g.id === id);
  report(`EXP13c ${id}`, hits.map((h) => `<g id=${h.id} class="${h.class}"> in measure=${h.parent?.id} sys${systems.indexOf(sysOf(h))} attrs=${h.attrs.slice(0, 80)}`));
}
// raw lines for the slur, to see any extra class like "slur system-break" or a 2nd path in another measure
report('EXP13c raw lines containing slurLong / tie23', svg.split('\n').filter((l) => l.includes('slurLong') || l.includes('tie23')).map((l) => l.trim().slice(0, 140)));
