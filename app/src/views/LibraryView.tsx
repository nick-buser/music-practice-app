import { useMemo, useState } from 'react';
import { Topbar } from '../components/Topbar';
import { Icon } from '../components/Icon';
import { Score } from '../verovio/Score';
import { INSTRUMENTS, PIECES, TODAY_QUEUE, QUOTES } from '../data/sounddata';
import { ABC_BY_PIECE } from '../data/scores';
import type { InstrumentId, Piece } from '../data/schemas';
import sonarRings from '../assets/sonar-rings.svg';

type Filter = InstrumentId | 'all';

interface Props {
  onOpenPiece: (id: string) => void;
  onStartSession: (id: string) => void;
}

const THUMB_OPTS = {
  inputFrom: 'abc' as const,
  scale: 30,
  measureRange: '1-1',
  adjustPageHeight: true,
  header: 'none' as const,
  footer: 'none' as const,
  breaks: 'none' as const,
};

function relTime(dateStr: string): string {
  const today = new Date('2026-05-19');
  const d = new Date(dateStr);
  const diff = Math.round((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'today';
  if (diff === 1) return 'yesterday';
  if (diff < 7) return `${diff} days ago`;
  if (diff < 30) return `${Math.floor(diff / 7)} wk ago`;
  return `${Math.floor(diff / 30)} mo ago`;
}

export function LibraryView({ onOpenPiece, onStartSession }: Props) {
  const [filter, setFilter] = useState<Filter>('all');

  const grouped = useMemo(() => {
    const filtered = PIECES.filter((p) => filter === 'all' || p.instrument === filter);
    return INSTRUMENTS
      .filter((i) => i.id !== 'compose')
      .map((ins) => ({ ...ins, pieces: filtered.filter((p) => p.instrument === ins.id) }))
      .filter((g) => g.pieces.length > 0);
  }, [filter]);

  return (
    <div>
      <Topbar crumbs={['Soundings', 'Library']} />

      <div style={{ position: 'relative' }}>
        <div className="sonar-faint"><img src={sonarRings} alt="" /></div>

        <div className="page-hero">
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="eyebrow"><span className="rule" /> The library · {PIECES.length} pieces · 4 instruments</div>
            <h1>What we're <em>sounding out</em> this season.</h1>
            <div className="lede">
              Six pieces in active rotation, two in maintenance, one in the long
              slow descent of memorization.
            </div>
          </div>

          <div className="meta-col">
            <div>Total hours this year <span className="v">194h 22m</span></div>
            <div>Active streak <span className="v">28 days</span></div>
            <div>Next lesson <span className="v">Thu 22 · 17:00</span></div>
            <div>Last recital <span className="v">14 Apr · 4 mo</span></div>
          </div>
        </div>
      </div>

      <div className="lib-grid">
        <div>
          <div className="lib-filter-row">
            <button
              className={`filter-chip ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            {INSTRUMENTS.filter((i) => i.id !== 'compose').map((i) => (
              <button
                key={i.id}
                className={`filter-chip ${filter === i.id ? 'active' : ''}`}
                onClick={() => setFilter(i.id)}
              >
                {i.name}
              </button>
            ))}
            <div className="spacer" />
            <div className="sort">Sort: <b>last touched ↓</b></div>
          </div>

          {grouped.map((g) => (
            <section key={g.id} className="lib-group">
              <div className="lib-group-head">
                <span className="name">{g.name}</span>
                <span className="latin">{g.latin}</span>
                <span className="count">
                  {String(g.pieces.length).padStart(2, '0')} pieces ·{' '}
                  {Math.round(g.pieces.reduce((s, p) => s + p.minutesTotal, 0) / 60)}h logged
                </span>
              </div>
              <div>
                {g.pieces.map((p) => (
                  <PieceRow
                    key={p.id}
                    piece={p}
                    onOpen={() => onOpenPiece(p.id)}
                    onPlay={() => onStartSession(p.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        <aside className="lib-rail">
          <div className="today-panel">
            <div className="head">
              <span className="l">— Today · queued</span>
              <span className="date">19 may · 18:47</span>
            </div>
            <div className="queue-list">
              {TODAY_QUEUE.map((q, i) => (
                <div key={q.id} className="queue-item" onClick={() => onStartSession(q.pieceId)}>
                  <div className="ord">{String(i + 1).padStart(2, '0')}</div>
                  <div className="what">
                    <div className="t">{q.label}</div>
                    <div className="s">{q.sub}</div>
                  </div>
                  <div className="min">{q.mins} m</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button className="btn btn-primary" onClick={() => onStartSession(TODAY_QUEUE[0].pieceId)}>
                Begin session <span className="arrow">→</span>
              </button>
              <button className="btn btn-ghost">Edit queue</button>
            </div>
          </div>

          <div className="card">
            <div className="head">
              <h3>Depth strip</h3>
              <span className="eyebrow">— mastery</span>
            </div>
            <div className="depth-strip">
              {PIECES.filter((p) => p.depth !== 'mastered').slice(0, 6).map((p) => (
                <div key={p.id} className="row">
                  <div className="name">{p.title.split(' ')[0]}</div>
                  <div className="bar">
                    <span className="pin" style={{ left: `${Math.round(p.progressPct * 100)}%` }} />
                  </div>
                  <div className="num">{Math.round(p.progressPct * 100)}%</div>
                </div>
              ))}
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', color: 'var(--shoal)', fontSize: 13, marginTop: 14, lineHeight: 1.5 }}>
              Surface to trench: red marks the parts that fight back; mint marks
              the ones that <span className="lumen">settle</span>.
            </div>
          </div>

          <div className="today-panel">
            <div className="head">
              <span className="l">— Practice koan</span>
            </div>
            <blockquote className="quote">
              {QUOTES[0].text}
              <cite>{QUOTES[0].who}</cite>
            </blockquote>
          </div>
        </aside>
      </div>
    </div>
  );
}

interface RowProps {
  piece: Piece;
  onOpen: () => void;
  onPlay: () => void;
}

function PieceRow({ piece, onOpen, onPlay }: RowProps) {
  const abc = ABC_BY_PIECE[piece.id];
  return (
    <div className="piece-row" onClick={onOpen}>
      <button className="play" onClick={(e) => { e.stopPropagation(); onPlay(); }} aria-label={`Begin session for ${piece.title}`}>
        <Icon name="play" size={12} />
      </button>
      <div>
        <div className="title">
          {piece.title}
          {piece.subtitle ? <em>· {piece.subtitle}</em> : null}
        </div>
        <div className="composer">{piece.composer} · {piece.year} · {piece.key} · {piece.meter}</div>
      </div>
      <div
        className="score-thumb"
        onClick={(e) => e.stopPropagation()}
        title={`${piece.title} — opening bar`}
      >
        {abc ? (
          <Score data={abc} options={THUMB_OPTS} ariaLabel={`${piece.title} opening`} />
        ) : (
          <span className="loading">no score</span>
        )}
      </div>
      <div className="progress">
        <div className="bar"><div className="fill" style={{ transform: `scaleX(${piece.progressPct})` }} /></div>
        <div className="pct">{Math.round(piece.progressPct * 100)}%</div>
      </div>
      <div className="depth">
        <span className={`dot ${piece.depth}`} />
        <div style={{ marginTop: 2 }}>
          <span className="v">{piece.depthLabel}</span>
        </div>
      </div>
      <div className="last">
        <div>last <span style={{ color: 'var(--foam)' }}>{relTime(piece.lastTouched)}</span></div>
        <div>{piece.sessions} sessions · {Math.round(piece.minutesTotal / 60)}h {piece.minutesTotal % 60}m</div>
      </div>
      <div className="more">
        <Icon name="arrow-right" size={14} />
      </div>
    </div>
  );
}
