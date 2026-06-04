/**
 * Custom SVG renderer for the raga notation model. No first-class library
 * engraves sargam/swara notation, so we draw it ourselves — inline SVG on a
 * fixed matra grid, which is resolution-independent, themeable via CSS, and
 * (unlike the WASM/canvas instrument libs) fully introspectable in jsdom tests.
 *
 * Two views:
 *   • <PhraseLine>  — a flowing row of swaras (aroha / avaroha / pakad).
 *   • <CompositionScore> — a section laid on its tala grid, with sam/tali/khali
 *     (or laghu/drutam) markers, vibhag dividers, optional lyrics, and an
 *     optional active-matra highlight for the playback cursor.
 */

import {
  scriptNumeral,
  swaraGlyph,
  swaraSyllable,
  swarasthana,
  type MusicSystem,
  type Swara,
  type SwaraScript,
} from '../../data/raga/swara';
import {
  sectionStarts,
  talaMatras,
  type Tala,
} from '../../data/raga/tala';
import type { Cell, CompositionSection } from '../../data/raga/composition';

const CELL_W = 36;
const PAD_X = 10;
const MARKER_H = 18; // top band: tala markers
const SWARA_TOP = MARKER_H;
const LETTER_Y = MARKER_H + 22;
const SWARA_H = 40; // band: octave dots + letter + komal line
const LYRIC_Y = MARKER_H + SWARA_H + 13;

/** Renders the swaras that sit inside one matra column centred on `cx`. */
function CellGlyphs({
  cell,
  cx,
  script,
  system,
}: {
  cell: Cell;
  cx: number;
  script: SwaraScript;
  system: MusicSystem;
}) {
  if (cell.kind === 'sustain') {
    return (
      <text className="raga-sustain" x={cx} y={LETTER_Y} textAnchor="middle">
        –
      </text>
    );
  }
  if (cell.kind === 'rest') {
    return (
      <text className="raga-rest" x={cx} y={LETTER_Y} textAnchor="middle">
        ·
      </text>
    );
  }
  const n = cell.swaras.length;
  // Spread a subdivided matra evenly across the cell, at a smaller size.
  const span = CELL_W - 8;
  return (
    <>
      {cell.swaras.map((swara, i) => {
        const x = n === 1 ? cx : cx - span / 2 + (span * (i + 0.5)) / n;
        return <SwaraMark key={i} swara={swara} cx={x} small={n > 1} script={script} system={system} />;
      })}
    </>
  );
}

/**
 * A single swara. Hindustani spells inflections as komal/tivra marks; Carnatic
 * names the finer swarasthana and prints it as a subscript index instead — so
 * the tradition picks the labelling style. Octave dots are shared by both.
 */
function SwaraMark({
  swara,
  cx,
  small,
  script,
  system,
}: {
  swara: Swara;
  cx: number;
  small?: boolean;
  script: SwaraScript;
  system: MusicSystem;
}) {
  const g = swaraGlyph(swara);
  const half = small ? 5 : 8;
  const carnatic = system === 'carnatic';
  const sthana = carnatic ? swarasthana(swara) : undefined;
  const dataSwara = carnatic
    ? `${g.letter}${sthana ?? ''}`
    : `${g.komal ? 'komal ' : ''}${g.tivra ? 'tivra ' : ''}${g.letter}`;
  return (
    <g className="raga-swara" data-swara={dataSwara}>
      <text className={`raga-letter${small ? ' small' : ''}`} x={cx} y={LETTER_Y} textAnchor="middle">
        {swaraSyllable(g.letter, script)}
      </text>
      {sthana !== undefined && (
        <text className="swarasthana-num" x={cx + half - 1} y={LETTER_Y + 4} textAnchor="start">
          {scriptNumeral(sthana, script)}
        </text>
      )}
      {!carnatic && g.komal && (
        <line className="komal-line" x1={cx - half} y1={LETTER_Y + 3} x2={cx + half} y2={LETTER_Y + 3} />
      )}
      {!carnatic && g.tivra && (
        <line className="tivra-line" x1={cx - half} y1={SWARA_TOP + 3} x2={cx + half} y2={SWARA_TOP + 3} />
      )}
      {g.register === 'taar' && <circle className="octave-dot" cx={cx} cy={SWARA_TOP + 6} r={1.6} />}
      {g.register === 'mandra' && <circle className="octave-dot" cx={cx} cy={LETTER_Y + 9} r={1.6} />}
    </g>
  );
}

export function PhraseLine({
  phrase,
  ariaLabel,
  script = 'roman',
  system = 'hindustani',
}: {
  phrase: Swara[];
  ariaLabel?: string;
  script?: SwaraScript;
  system?: MusicSystem;
}) {
  const width = PAD_X * 2 + phrase.length * CELL_W;
  return (
    <svg
      className={`raga-score phrase${script === 'devanagari' ? ' deva' : ''}`}
      width={width}
      height={MARKER_H + SWARA_H}
      viewBox={`0 0 ${width} ${MARKER_H + SWARA_H}`}
      role="img"
      aria-label={ariaLabel}
    >
      {phrase.map((swara, i) => (
        <SwaraMark
          key={i}
          swara={swara}
          cx={PAD_X + i * CELL_W + CELL_W / 2}
          script={script}
          system={system}
        />
      ))}
    </svg>
  );
}

/** The marker symbol shown above each section start (sam / tali / khali / anga). */
function markerSymbols(tala: Tala, script: SwaraScript): Array<{ matra: number; symbol: string }> {
  const starts = sectionStarts(tala);
  let taliNum = 1; // the sam is the first clap
  return tala.sections.map((sec, i) => {
    const matra = starts[i];
    let symbol: string;
    if (matra === 0) {
      symbol = '×'; // sam
    } else if (tala.system === 'hindustani') {
      if (sec.marker === 'khali') {
        symbol = '○';
      } else {
        taliNum += 1;
        symbol = scriptNumeral(taliNum, script);
      }
    } else {
      symbol = sec.marker === 'laghu' ? '|' : sec.marker === 'drutam' ? 'O' : 'U';
    }
    return { matra, symbol };
  });
}

interface CompositionScoreProps {
  section: CompositionSection;
  tala: Tala;
  /** Index into `section.cells` to highlight (the playback cursor). */
  activeMatra?: number;
  script?: SwaraScript;
}

export function CompositionScore({ section, tala, activeMatra, script = 'roman' }: CompositionScoreProps) {
  const beats = talaMatras(tala);
  const markers = markerSymbols(tala, script);
  const starts = sectionStarts(tala);
  const hasLyrics = !!section.lyrics?.length;
  const rowH = MARKER_H + SWARA_H + (hasLyrics ? 18 : 0);
  const width = PAD_X * 2 + beats * CELL_W;
  const rows = Math.ceil(section.cells.length / beats);

  return (
    <div className="raga-composition-section">
      <div className="raga-section-label">{section.label}</div>
      {Array.from({ length: rows }, (_, row) => {
        const base = row * beats;
        return (
          <svg
            key={row}
            className={`raga-score grid${script === 'devanagari' ? ' deva' : ''}`}
            width={width}
            height={rowH}
            viewBox={`0 0 ${width} ${rowH}`}
            role="img"
            aria-label={`${section.label}, ${tala.name}, cycle ${row + 1}`}
          >
            {/* vibhag dividers (skip the leading edge) */}
            {starts.slice(1).map((m) => (
              <line
                key={`div-${m}`}
                className="vibhag-divider"
                x1={PAD_X + m * CELL_W}
                y1={MARKER_H}
                x2={PAD_X + m * CELL_W}
                y2={MARKER_H + SWARA_H}
              />
            ))}
            {/* tala markers */}
            {markers.map(({ matra, symbol }) => (
              <text
                key={`mk-${matra}`}
                className="tala-marker"
                x={PAD_X + matra * CELL_W + CELL_W / 2}
                y={MARKER_H - 5}
                textAnchor="middle"
              >
                {symbol}
              </text>
            ))}
            {/* cells for this cycle */}
            {Array.from({ length: beats }, (_, col) => {
              const idx = base + col;
              const cell = section.cells[idx];
              if (!cell) return null;
              const cx = PAD_X + col * CELL_W + CELL_W / 2;
              return (
                <g key={col}>
                  {idx === activeMatra && (
                    <rect
                      className="matra-cursor"
                      x={PAD_X + col * CELL_W}
                      y={MARKER_H}
                      width={CELL_W}
                      height={SWARA_H}
                    />
                  )}
                  <CellGlyphs cell={cell} cx={cx} script={script} system={tala.system} />
                  {hasLyrics && section.lyrics?.[idx] && (
                    <text className="raga-lyric" x={cx} y={LYRIC_Y} textAnchor="middle">
                      {section.lyrics[idx]}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        );
      })}
    </div>
  );
}
