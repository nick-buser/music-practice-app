import { useMemo, useState } from 'react';
import { Topbar } from '../components/Topbar';
import { Score } from '../verovio/Score';
import { DAILY_ROUTINE_IDS, SCALES } from '../data/scales';
import { relTime } from '../lib/time';
import type { Scale, TechniqueFamily } from '../data/schemas';

interface Props {
  onStartSession: (id: string) => void;
}

type Tab = TechniqueFamily;

const TABS: Array<{ id: Tab; label: string; ready: boolean }> = [
  { id: 'major',     label: 'Major scales', ready: true },
  { id: 'minor',     label: 'Minor scales', ready: false },
  { id: 'arpeggio',  label: 'Arpeggios',    ready: false },
];

const SCALE_THUMB_OPTS = {
  inputFrom: 'abc' as const,
  scale: 32,
  adjustPageHeight: true,
  header: 'none' as const,
  footer: 'none' as const,
  breaks: 'none' as const,
  pageMarginLeft: 20,
  pageMarginRight: 20,
  pageMarginTop: 10,
  pageMarginBottom: 0,
};

/**
 * Comfort bands match the depth-strip / heatmap gradient so a glance at the
 * grid reads the same way as the rest of the app.
 */
function comfortClass(c: number): string {
  if (c > 0.8) return 'deep';
  if (c > 0.55) return 'shallow';
  if (c > 0.3) return 'warm';
  return 'struggle';
}

export function TechniqueView({ onStartSession }: Props) {
  const [tab, setTab] = useState<Tab>('major');

  const scales = useMemo(() => SCALES.filter((s) => s.family === tab), [tab]);

  const routine = useMemo(() => {
    const byId = new Map(SCALES.map((s) => [s.id, s]));
    return DAILY_ROUTINE_IDS.map((id) => byId.get(id)).filter((s): s is Scale => Boolean(s));
  }, []);

  const stats = useMemo(() => {
    const all = SCALES.filter((s) => s.family === 'major');
    const avgComfort = all.reduce((a, s) => a + s.comfort, 0) / Math.max(1, all.length);
    const fluent = all.filter((s) => s.comfort > 0.8).length;
    const totalReps = all.reduce((a, s) => a + s.reps, 0);
    return { avgComfort, fluent, totalReps, total: all.length };
  }, []);

  return (
    <div>
      <Topbar crumbs={['Soundings', 'Technique']} />

      <div className="page-hero">
        <div>
          <div className="eyebrow"><span className="rule" /> Technique · daily warmup</div>
          <h1>Sound every key, <em>every day</em>.</h1>
          <div className="lede">
            Scales and arpeggios — the slow rotation of all twelve keys.
            What you hold steady at <span className="lumen">target tempo</span>,
            and where the fingers still need to find the path.
          </div>
        </div>
        <div className="meta-col">
          <div>Fluent at target <span className="v">{stats.fluent} / {stats.total}</span></div>
          <div>Average comfort <span className="v">{Math.round(stats.avgComfort * 100)}%</span></div>
          <div>Reps logged <span className="v">{stats.totalReps.toLocaleString()}</span></div>
          <div>Last warmup <span className="v">today · 06:18</span></div>
        </div>
      </div>

      <div className="tech-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tech-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => t.ready && setTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
            disabled={!t.ready}
          >
            {t.label}
            {!t.ready && <span className="soon">soon</span>}
          </button>
        ))}
      </div>

      {!TABS.find((t) => t.id === tab)?.ready ? (
        <ComingSoon family={tab} />
      ) : (
        <div className="tech-layout">
          <div>
            <div className="tech-grid">
              {scales.map((s) => (
                <ScaleCard key={s.id} scale={s} onStartSession={onStartSession} />
              ))}
            </div>
          </div>

          <aside className="tech-rail">
            <div className="today-panel">
              <div className="head">
                <span className="l">— today's routine</span>
                <span className="date">5 scales · ~12 min</span>
              </div>
              <div className="routine-list">
                {routine.map((s, i) => (
                  <div key={s.id} className="routine-item" onClick={() => onStartSession(s.id)}>
                    <div className="ord">{String(i + 1).padStart(2, '0')}</div>
                    <div className="what">
                      <div className="t">{s.name}</div>
                      <div className="s">
                        target ♩ = {s.bpmTarget} · working ♩ = {s.bpmCurrent}
                      </div>
                    </div>
                    <span className={`dot ${comfortClass(s.comfort)}`} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button className="btn btn-primary" onClick={() => onStartSession(routine[0].id)}>
                  Begin warmup <span className="arrow">→</span>
                </button>
                <button className="btn btn-ghost">Shuffle</button>
              </div>
            </div>

            <div className="card">
              <div className="head">
                <h3>Comfort across the circle</h3>
                <span className="eyebrow">— mastery</span>
              </div>
              <div className="depth-strip">
                {scales.map((s) => (
                  <div key={s.id} className="row">
                    <div className="name">{s.tonic}</div>
                    <div className="bar">
                      <span className="pin" style={{ left: `${Math.round(s.comfort * 100)}%` }} />
                    </div>
                    <div className="num">{Math.round(s.comfort * 100)}%</div>
                  </div>
                ))}
              </div>
              <div style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', color: 'var(--shoal)', fontSize: 13, marginTop: 14, lineHeight: 1.5 }}>
                The sharps after E and the flats past E♭ are where the line
                <span className="lumen"> goes deep</span>. Slow them down before
                the metronome edges up.
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

interface CardProps {
  scale: Scale;
  onStartSession: (id: string) => void;
}

function ScaleCard({ scale, onStartSession }: CardProps) {
  const last = scale.lastTouched ? relTime(scale.lastTouched) : 'never';
  const atTarget = scale.bpmCurrent >= scale.bpmTarget;
  return (
    <article className="scale-card" data-comfort={comfortClass(scale.comfort)}>
      <header>
        <div className="tonic">{scale.tonic}</div>
        <div className="name">
          <div className="n">{scale.name}</div>
          <div className="s">major scale · one octave</div>
        </div>
        <span className={`dot ${comfortClass(scale.comfort)}`} />
      </header>

      <div className="engraving">
        <Score data={scale.abc} options={SCALE_THUMB_OPTS} ariaLabel={`${scale.name} scale, one octave ascending`} />
      </div>

      <div className="meta">
        <span>target <b>♩ = {scale.bpmTarget}</b></span>
        <span>
          working{' '}
          <b style={{ color: atTarget ? 'var(--lumen)' : 'var(--krill)' }}>
            ♩ = {scale.bpmCurrent}
          </b>
        </span>
        <span>{scale.reps} reps</span>
        <span>last <span style={{ color: 'var(--foam)' }}>{last}</span></span>
      </div>

      <footer>
        <button className="btn btn-ghost" onClick={() => onStartSession(scale.id)}>
          Run it →
        </button>
      </footer>
    </article>
  );
}

function ComingSoon({ family }: { family: TechniqueFamily }) {
  const label = family === 'minor' ? 'Minor scales' : 'Arpeggios';
  return (
    <div className="tech-soon">
      <div className="label">— {label.toLowerCase()} · coming soon</div>
      <div>
        Next pass: the twelve {family === 'arpeggio' ? 'major and minor arpeggios' : 'natural / harmonic / melodic minors'},
        engraved in the same way, with shared comfort tracking.
      </div>
    </div>
  );
}
