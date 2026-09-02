// EXP14b: exact svgHtml5 output for a note and a measure — does `id` disappear (breaking every `[id="…"]` query) or is it duplicated into data-id?
// Run: node exp14b-svghtml5.mjs
import { makeTk, mei, report } from './lib.mjs';
const tk = await makeTk({ svgHtml5: true });
tk.loadData(mei(`<measure xml:id="m1" n="1"><staff n="1"><layer n="1"><note xml:id="n1" pname="c" oct="4" dur="1"/></layer></staff><staff n="2"><layer n="1"><mRest xml:id="mr1"/></layer></staff></measure>`));
const svg = tk.renderToSVG(1);
report('EXP14b svgHtml5 lines mentioning n1/m1/mr1', svg.split('\n').filter((l) => /"(n1|m1|mr1)"/.test(l)).map((l) => l.trim()));
report('EXP14b any id= attrs left on g?', [(svg.match(/<g id="/g) || []).length + ' <g id=…>', (svg.match(/data-id="/g) || []).length + ' data-id']);
