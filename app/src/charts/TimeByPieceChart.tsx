import { scaleLinear } from 'd3-scale';
import { max } from 'd3-array';
import type { TimeByPiece } from '../data/sounddata';

interface Props {
  data: TimeByPiece[];
}

function fmt(mins: number): string {
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/**
 * Horizontal bars of time invested per piece. D3 scaleLinear maps minutes to a
 * 0–100% width; composition pieces get the warm krill ramp. Rendered as HTML so
 * the type stays crisp and the layout reflows naturally.
 */
export function TimeByPieceChart({ data }: Props) {
  const x = scaleLinear()
    .domain([0, max(data, (d) => d.mins) ?? 1])
    .range([0, 100]);

  return (
    <div className="bars">
      {data.map((d) => (
        <div key={d.name} className="row">
          <div className="lbl">
            <span className="name">{d.name}</span>
            <span className="who">{d.who}</span>
          </div>
          <div className="v">{fmt(d.mins)}</div>
          <div className="bar-wrap">
            <div
              className={`bar ${d.who === 'compose' ? 'compose' : ''}`}
              style={{ transform: `scaleX(${x(d.mins) / 100})` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
