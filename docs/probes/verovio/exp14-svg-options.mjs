// EXP14: SVG output options that change the id contract: svgHtml5 (data-id/data-class), svgAdditionalAttribute (measure@n as data-n), svgBoundingBoxes, svgRemoveXlink, svgViewBox. Also the glyph <symbol> id suffix stability.
// Run: node exp14-svg-options.mjs
import { makeTk, mei, report } from './lib.mjs';

const tk = await makeTk();
const body = `<measure xml:id="m1" n="1"><staff n="1"><layer n="1"><note xml:id="n1" pname="c" oct="4" dur="4"/><rest dur="4"/><note xml:id="n2" pname="e" oct="4" dur="2"/></layer></staff><staff n="2"><layer n="1"><mRest/></layer></staff></measure><measure xml:id="m2" n="2"><staff n="1"><layer n="1"><note xml:id="n3" pname="c" oct="5" dur="1"/></layer></staff><staff n="2"><layer n="1"><mRest/></layer></staff></measure>`;
const doc = mei(body);

function firstLine(svg, needle) { return svg.split('\n').find((l) => l.includes(needle))?.trim().slice(0, 200); }

console.log('load', tk.loadData(doc));
let svg = tk.renderToSVG(1);
report('EXP14 default: note/measure lines', [firstLine(svg, 'n1'), firstLine(svg, '"m1"')]);
report('EXP14 default: glyph symbol ids', [[...new Set((svg.match(/<symbol id="([^"]+)"/g) || []).map((s) => s.slice(12, -1)))].slice(0, 4)]);

tk.setOptions({ svgHtml5: true });
tk.loadData(doc); svg = tk.renderToSVG(1);
report('EXP14 svgHtml5:true — note/measure lines (id → data-id?)', [firstLine(svg, 'n1'), firstLine(svg, 'm1')]);
tk.setOptions({ svgHtml5: false });

tk.setOptions({ svgAdditionalAttribute: ['measure@n', 'note@pname', 'note@oct', 'note@dur', 'staff@n', 'layer@n'] });
tk.loadData(doc); svg = tk.renderToSVG(1);
report('EXP14 svgAdditionalAttribute — measure/note/staff lines', [firstLine(svg, '"m1"'), firstLine(svg, '"n1"'), firstLine(svg, 'class="staff"')]);
tk.setOptions({ svgAdditionalAttribute: [] });

tk.setOptions({ svgBoundingBoxes: true });
tk.loadData(doc); svg = tk.renderToSVG(1);
report('EXP14 svgBoundingBoxes — what gets emitted', [firstLine(svg, 'bounding-box'), (svg.match(/class="bounding-box"/g) || []).length + ' bbox rects']);
tk.setOptions({ svgBoundingBoxes: false });

tk.setOptions({ svgViewBox: true });
tk.loadData(doc); svg = tk.renderToSVG(1);
report('EXP14 svgViewBox — <svg> open tag', [svg.match(/<svg[^>]*>/)?.[0].slice(0, 300)]);
tk.setOptions({ svgViewBox: false });

// Does the glyph symbol suffix change across loads / toolkit instances (two scores on one page share <defs> ids)?
tk.loadData(doc); const s1 = (tk.renderToSVG(1).match(/<symbol id="([^"]+)"/) || [])[1];
const tk2 = await makeTk(); tk2.loadData(doc); const s2 = (tk2.renderToSVG(1).match(/<symbol id="([^"]+)"/) || [])[1];
report('EXP14 glyph symbol id across instances', [{ s1, s2, same: s1 === s2 }]);
