import { useCallback, useMemo, useState } from 'react';
import { Topbar } from '../components/Topbar';
import { Icon } from '../components/Icon';
import { Score } from '../verovio/Score';
import { findMeasureNumber, paintHeatmap, paintSelection, type HeatSection } from '../verovio/heatmap';
import { INSTRUMENTS, PIECES } from '../data/sounddata';
import { ABC_BY_PIECE } from '../data/scores';
import { emphasize } from '../lib/text';
import type { Piece, Section } from '../data/schemas';

interface Props {
  pieceId: string;
  onBack: () => void;
  onStartSession: (id: string) => void;
}

const SCORE_OPTS = {
  inputFrom: 'abc' as const,
  scale: 38,
  adjustPageHeight: true,
  header: 'none' as const,
  footer: 'none' as const,
  breaks: 'auto' as const,
  pageMarginLeft: 60,
  pageMarginRight: 60,
  pageMarginTop: 40,
  pageMarginBottom: 40,
};

export function PieceView({ pieceId, onBack, onStartSession }: Props) {
  const piece = PIECES.find((p) => p.id === pieceId);

  const [pinnedSectionId, setPinnedSectionId] = useState<string | null>(
    piece?.sections.find((s) => s.active)?.id ?? piece?.sections[0]?.id ?? null,
  );
  const [selection, setSelection] = useState<[number, number] | null>(null);
  const [showHeat, setShowHeat] = useState(true);

  if (!piece) {
    return (
      <div>
        <Topbar crumbs={['Library', 'unknown']} />
        <div className="stub"><div className="label">— missing</div><div>Piece not found.</div></div>
      </div>
    );
  }

  const ins = INSTRUMENTS.find((i) => i.id === piece.instrument);
  const abc = ABC_BY_PIECE[piece.id];

  const heatSections: HeatSection[] = useMemo(
    () =>
      showHeat
        ? piece.sections.map((s) => ({
            id: s.id,
            range: s.range,
            heat: s.heat,
            active: s.id === pinnedSectionId,
          }))
        : [],
    [piece.sections, pinnedSectionId, showHeat],
  );

  const handleSvgReady = useCallback(
    (svg: SVGSVGElement) => {
      paintHeatmap(svg, heatSections);
      paintSelection(svg, selection);
    },
    [heatSections, selection],
  );

  const handleElementClick = useCallback(
    (id: string, _kind: string) => {
      // Use the SVG via closure — we need a query path; resolve via document.
      const svg = document.querySelector('.score-big svg') as SVGSVGElement | null;
      if (!svg) return;
      const m = findMeasureNumber(svg, id);
      if (m === null) return;
      setSelection((curr) => {
        if (curr && curr[0] === m && curr[1] === m) return null;
        return [m, m];
      });
    },
    [],
  );

  const onPinSection = (s: Section) => {
    setPinnedSectionId(s.id);
    const m = s.range.match(/(\d+)\D+(\d+)/);
    if (m) setSelection([Number(m[1]), Number(m[2])]);
  };

  const pinnedSection = piece.sections.find((s) => s.id === pinnedSectionId);
  const maxHistMins = Math.max(...piece.history.map((h) => h.mins), 60);

  return (
    <div>
      <Topbar crumbs={['Library', ins?.name ?? '', piece.title]} />
      <div style={{ marginTop: -20, marginBottom: 18 }}>
        <button className="btn btn-ghost" onClick={onBack} style={{ padding: '6px 14px' }}>
          ← back to library
        </button>
      </div>

      <PieceHeader piece={piece} ins={ins?.name ?? ''} onStartSession={onStartSession} />

      <div className="piece-layout">
        <div>
          <div className="score-toolbar">
            <div className="eyebrow">— score · opening</div>
            <div className="spacer" />
            <button
              className={`tog-chip ${showHeat ? 'on' : ''}`}
              onClick={() => setShowHeat((v) => !v)}
            >
              <span className="tog-dot" /> Heat overlay
            </button>
            {selection && (
              <button
                className="btn btn-ghost"
                onClick={() => setSelection(null)}
                style={{ padding: '6px 12px' }}
              >
                Clear selection
              </button>
            )}
          </div>

          <div className="score-big">
            {abc ? (
              <Score
                data={abc}
                options={SCORE_OPTS}
                onSvgReady={handleSvgReady}
                onElementClick={handleElementClick}
                ariaLabel={`${piece.title} — engraved score`}
              />
            ) : (
              <div className="loading">no score data</div>
            )}
          </div>

          {selection && (
            <div className="sel-strip">
              <span className="dot deep" /> selected: mm. {selection[0]}
              {selection[0] !== selection[1] ? `–${selection[1]}` : ''}
              <span className="meta">
                {selection[1] - selection[0] + 1}{' '}
                {selection[1] - selection[0] + 1 === 1 ? 'measure' : 'measures'}
              </span>
              <div className="spacer" />
              <button className="btn btn-primary" onClick={() => onStartSession(piece.id)}>
                Loop this →
              </button>
            </div>
          )}

          <div style={{ marginTop: 36 }}>
            <div className="sect-head">
              <span className="eyebrow">— sections · pinned cues</span>
              <span className="title">Sounded depths</span>
              <span className="right">click a section to jump</span>
            </div>
            <div className="cue-list">
              {piece.sections.length === 0 && (
                <div style={{
                  padding: '24px 0',
                  fontFamily: 'var(--font-body)',
                  fontStyle: 'italic',
                  color: 'var(--shoal)',
                }}>
                  No sections sounded yet.
                </div>
              )}
              {piece.sections.map((s, i) => (
                <SectionRow
                  key={s.id}
                  s={s}
                  idx={i}
                  active={pinnedSectionId === s.id}
                  onPick={() => onPinSection(s)}
                />
              ))}
            </div>
          </div>
        </div>

        <aside className="piece-rail">
          {pinnedSection && (
            <div className="pinned-section-card">
              <div className="eyebrow">— now pinned · {pinnedSection.range}</div>
              <div className="title">{pinnedSection.label}</div>
              <div className="sub">{pinnedSection.subtitle}</div>
              <div className="row-stats">
                <span>conf <b>{pinnedSection.conf}/5</b></span>
                <span>tempo <b>{pinnedSection.tempo}</b></span>
                <span>reps <b>{pinnedSection.reps}</b></span>
              </div>
              <div className="acts">
                <button className="btn btn-primary" onClick={() => onStartSession(piece.id)}>
                  Loop this →
                </button>
              </div>
            </div>
          )}

          {piece.plan.length > 0 && (
            <div className="card">
              <div className="head">
                <h3>How we're hunting this piece</h3>
                <span className="eyebrow">— plan</span>
              </div>
              {piece.plan.map((step, i) => (
                <div key={i} className={`step ${step.done ? 'done' : ''} ${step.active ? 'active' : ''}`}>
                  <span className="n">{step.done ? '✓' : String(i + 1).padStart(2, '0')}</span>
                  <span>{step.text}</span>
                </div>
              ))}
            </div>
          )}

          {piece.history.length > 0 && (
            <div className="card">
              <div className="head">
                <h3>Recent practice</h3>
                <span className="eyebrow">— last 30d</span>
              </div>
              {piece.history.map((h, i) => (
                <div key={i} className="history-row">
                  <span className="date">{h.date}</span>
                  <span className="bar-wrap">
                    <span className="fill" style={{ width: `${(h.mins / maxHistMins) * 100}%` }} />
                  </span>
                  <span className="min">{h.mins}m</span>
                </div>
              ))}
              <div className="history-foot">
                <span>{piece.sessions} sessions</span>
                <span>
                  avg {Math.round(piece.minutesTotal / Math.max(1, piece.sessions))}m
                </span>
              </div>
            </div>
          )}

          {piece.notes.length > 0 && (
            <div className="card">
              <div className="head">
                <h3>Field notes</h3>
                <span className="eyebrow">— margin</span>
              </div>
              {piece.notes.slice(0, 4).map((n, i) => (
                <div key={i} className="note-entry">
                  <span className="when">{n.when}</span>
                  <div
                    className="body"
                    dangerouslySetInnerHTML={{
                      __html: emphasize(n.body),
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

interface HeaderProps {
  piece: Piece;
  ins: string;
  onStartSession: (id: string) => void;
}

function PieceHeader({ piece, ins, onStartSession }: HeaderProps) {
  return (
    <div className="specimen-head">
      <div>
        <div className="eyebrow">
          <span className="rule" /> {ins.toUpperCase()} · {piece.depthLabel} · {piece.tags.join(' · ')}
        </div>
        <h1>
          {piece.title}
          {piece.subtitle && <em>{piece.subtitle}</em>}
        </h1>
        <div className="composer">{piece.composer} · {piece.year}</div>

        <div className="coord-row">
          <span>Key <span className="v">{piece.key}</span></span>
          <span>Meter <span className="v">{piece.meter}</span></span>
          <span>Tempo <span className="v">{piece.tempo.mark}, ♩={piece.tempo.bpm}</span></span>
          <span>Duration <span className="v">{piece.duration}</span></span>
          <span>Measures <span className="v">{piece.measures}</span></span>
        </div>

        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => onStartSession(piece.id)}>
            <Icon name="play" size={12} /> Begin session
          </button>
          <button className="btn btn-ghost">Loop tough sections</button>
        </div>
      </div>

      <div className="stats-col">
        <div className="stat"><span>Progress</span><span className="v lumen">{Math.round(piece.progressPct * 100)}<span className="unit-sm">%</span></span></div>
        <div className="stat"><span>Sessions</span><span className="v">{piece.sessions}</span></div>
        <div className="stat"><span>Time invested</span><span className="v">{Math.floor(piece.minutesTotal / 60)}<span className="unit-sm">h</span> {piece.minutesTotal % 60}<span className="unit-sm">m</span></span></div>
        <div className="stat"><span>Streak on piece</span><span className="v">{piece.streakDays}<span className="unit-sm">d</span></span></div>
      </div>
    </div>
  );
}

interface SectionRowProps {
  s: Section;
  idx: number;
  active: boolean;
  onPick: () => void;
}

function SectionRow({ s, idx, active, onPick }: SectionRowProps) {
  const heatClass = s.heat > 0.65 ? 'good' : s.heat > 0.32 ? 'warn' : 'bad';
  return (
    <div className={`cue-row ${active ? 'active' : ''}`} onClick={onPick}>
      <div className="pin-num">
        <span className={`marker ${heatClass}`} />
        {String.fromCharCode(65 + idx)}
      </div>
      <div className="measures">{s.range}</div>
      <div className="label">
        {s.label}
        <span className="sub">{s.subtitle}</span>
      </div>
      <div className="tempo">{s.tempo}</div>
      <div className="conf">
        <div className="pips">
          {[1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className={`pip ${i <= s.conf ? heatClass : ''}`}
            />
          ))}
        </div>
      </div>
      <div className="reps">{s.reps} reps</div>
      <div className="more"><Icon name="arrow-right" size={12} /></div>
    </div>
  );
}
