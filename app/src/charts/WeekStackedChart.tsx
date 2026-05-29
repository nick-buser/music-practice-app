import { scaleBand, scaleLinear } from 'd3-scale';
import { stack } from 'd3-shape';
import { max } from 'd3-array';
import { useMeasure } from './useMeasure';
import type { WeekDay } from '../data/sounddata';

interface Props {
  data: WeekDay[];
}

const HEIGHT = 200;
const AXIS = 28; // bottom space for day labels
const KEYS = ['piano', 'guitar', 'compose'] as const;
const SEG_CLASS: Record<(typeof KEYS)[number], string> = {
  piano: 'piano',
  guitar: 'guitar',
  compose: 'compose',
};

/**
 * Minutes per day this week, stacked by instrument. d3.stack computes the
 * segment offsets, scaleBand positions the columns, scaleLinear maps minutes to
 * height. Gridlines are drawn at the y-scale's ticks.
 */
export function WeekStackedChart({ data }: Props) {
  const [ref, width] = useMeasure<HTMLDivElement>();

  const plotH = HEIGHT - AXIS;
  const x = scaleBand<number>()
    .domain(data.map((_, i) => i))
    .range([0, width])
    .paddingInner(0.42)
    .paddingOuter(0.2);

  const yMax = max(data, (d) => d.piano + d.guitar + d.compose) ?? 1;
  const y = scaleLinear().domain([0, yMax]).range([plotH, 0]).nice();

  const series = stack<WeekDay, (typeof KEYS)[number]>().keys(KEYS)(data);
  const barW = Math.min(36, x.bandwidth());

  return (
    <div ref={ref} className="week-stacked">
      {width > 0 && (
        <svg viewBox={`0 0 ${width} ${HEIGHT}`} width={width} height={HEIGHT} role="img" aria-label="Minutes per day this week by instrument">
          {y.ticks(4).map((t) => (
            <g key={t}>
              <line x1={0} x2={width} y1={y(t)} y2={y(t)} className="gridline" />
              <text x={0} y={y(t) - 4} className="ytick">{t}</text>
            </g>
          ))}
          {series.map((layer) => (
            <g key={layer.key}>
              {layer.map((seg, i) => {
                const cx = (x(i) ?? 0) + (x.bandwidth() - barW) / 2;
                const h = y(seg[0]) - y(seg[1]);
                if (h <= 0) return null;
                return (
                  <rect
                    key={i}
                    x={cx}
                    y={y(seg[1])}
                    width={barW}
                    height={h}
                    className={`seg ${SEG_CLASS[layer.key]}`}
                  />
                );
              })}
            </g>
          ))}
          {data.map((d, i) => {
            const cx = (x(i) ?? 0) + x.bandwidth() / 2;
            return (
              <g key={i} className={d.today ? 'day today' : 'day'}>
                <text x={cx} y={HEIGHT - 11} className="day-name">{d.day}</text>
                <text x={cx} y={HEIGHT} className="day-date">{d.date}</text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
