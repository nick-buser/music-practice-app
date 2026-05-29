import { useMemo } from 'react';
import { scaleQuantize } from 'd3-scale';
import { max } from 'd3-array';
import type { HeatDay } from '../data/sounddata';

interface Props {
  data: HeatDay[];
}

const CELL = 11;
const GAP = 3;
const STEP = CELL + GAP;
const ROWS = 7;
const TOP = 18; // room for month labels

// Five-bucket lumen ramp matching the design's heat levels.
const RAMP = [
  'color-mix(in oklch, var(--lumen) 16%, transparent)',
  'color-mix(in oklch, var(--lumen) 32%, transparent)',
  'color-mix(in oklch, var(--lumen) 55%, transparent)',
  'var(--lumen)',
];
const EMPTY = 'color-mix(in oklch, var(--foam) 6%, transparent)';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * GitHub-style practice calendar. D3's scaleQuantize buckets daily minutes into
 * the lumen ramp; column = week, row = weekday. Month labels are placed at the
 * first column whose Sunday falls in a new month.
 */
export function YearHeatmap({ data }: Props) {
  const cols = Math.ceil(data.length / ROWS);
  const width = cols * STEP;
  const height = TOP + ROWS * STEP;

  const color = useMemo(() => {
    const maxMin = max(data, (d) => d.minutes ?? 0) ?? 120;
    return scaleQuantize<string>().domain([1, maxMin]).range(RAMP);
  }, [data]);

  const monthLabels = useMemo(() => {
    const labels: Array<{ col: number; text: string }> = [];
    let lastMonth = -1;
    for (let col = 0; col < cols; col++) {
      const cell = data[col * ROWS];
      if (!cell) continue;
      const m = new Date(cell.date).getMonth();
      if (m !== lastMonth) {
        labels.push({ col, text: MONTHS[m] });
        lastMonth = m;
      }
    }
    return labels;
  }, [data, cols]);

  return (
    <svg
      className="year-heatmap"
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Daily practice minutes over the last year"
    >
      {monthLabels.map(({ col, text }) => (
        <text key={`${col}-${text}`} x={col * STEP} y={11} className="month-label">
          {text}
        </text>
      ))}
      {data.map((d, i) => {
        const col = Math.floor(i / ROWS);
        const row = i % ROWS;
        const minutes = d.minutes;
        const fill = minutes === null ? 'transparent' : minutes <= 0 ? EMPTY : color(minutes);
        const glow = minutes !== null && minutes > 60;
        return (
          <rect
            key={d.date}
            x={col * STEP}
            y={TOP + row * STEP}
            width={CELL}
            height={CELL}
            rx={2}
            fill={fill}
            style={glow ? { filter: 'drop-shadow(0 0 4px var(--lumen-core))' } : undefined}
          >
            {minutes !== null && (
              <title>{`${d.date} · ${minutes}m`}</title>
            )}
          </rect>
        );
      })}
    </svg>
  );
}
