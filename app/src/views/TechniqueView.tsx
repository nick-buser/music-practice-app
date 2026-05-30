import { useMemo, useState } from 'react';
import { Topbar } from '../components/Topbar';
import { Score } from '../verovio/Score';
import {
  ARP_FAMILY_BY_QUALITY,
  ArpeggioQuality,
  ARPEGGIO_QUALITIES,
  DAILY_ROUTINE_IDS,
  MINOR_FAMILY_BY_VARIANT,
  MINOR_VARIANTS,
  MinorVariant,
  SCALES,
} from '../data/scales';
import { relTime } from '../lib/time';
import type { Scale } from '../data/schemas';

interface Props {
  onStartSession: (id: string) => void;
}

/** Top-level category — these are the visible tabs. */
type Category = 'major' | 'minor' | 'arpeggio';

const TABS: Array<{ id: Category; label: string }> = [
  { id: 'major',    label: 'Major scales' },
  { id: 'minor',    label: 'Minor scales' },
  { id: 'arpeggio', label: 'Arpeggios' },
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

function comfortClass(c: number): string {
  if (c > 0.8) return 'deep';
  if (c > 0.55) return 'shallow';
  if (c > 0.3) return 'warm';
  return 'struggle';
}

export function TechniqueView({ onStartSession }: Props) {
  const [category, setCategory] = useState<Category>('major');
  const [minorVariant, setMinorVariant] = useState<MinorVariant>('natural');
  const [arpQuality, setArpQuality] = useState<ArpeggioQuality>('major');

  const visible = useMemo(() => {
    if (category === 'major') return SCALES.filter((s) => s.family === 'major');
    if (category === 'minor') {
      const fam = MINOR_FAMILY_BY_VARIANT[minorVariant];
      return SCALES.filter((s) => s.family === fam);
    }
    const fam = ARP_FAMILY_BY_QUALITY[arpQuality];
    return SCALES.filter((s) => s.family === fam);
  }, [category, minorVariant, arpQuality]);

  const routine = useMemo(() => {
    const byId = new Map(SCALES.map((s) => [s.id, s]));
    return DAILY_ROUTINE_IDS.map((id) => byId.get(id)).filter((s): s is Scale => Boolean(s));
  }, []);

  const stats = useMemo(() => {
    const total = SCALES.length;
    const fluent = SCALES.filter((s) => s.comfort > 0.8).length;
    const avg = SCALES.reduce((a, s) => a + s.comfort, 0) / Math.max(1, total);
    const reps = SCALES.reduce((a, s) => a + s.reps, 0);
    return { total, fluent, avg, reps };
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
          <div>Average comfort <span className="v">{Math.round(stats.avg * 100)}%</span></div>
          <div>Reps logged <span className="v">{stats.reps.toLocaleString()}</span></div>
          <div>Last warmup <span className="v">today · 06:18</span></div>
        </div>
      </div>

      <div className="tech-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tech-tab ${category === t.id ? 'active' : ''}`}
            onClick={() => setCategory(t.id)}
            aria-current={category === t.id ? 'page' : undefined}
          >
            {t.label}
          </button>
        ))}
      </div>

      {category === 'minor' && (
        <SubToggle
          options={MINOR_VARIANTS}
          value={minorVariant}
          onChange={setMinorVariant}
          labelFor={(v) => `${v[0].toUpperCase()}${v.slice(1)} minor`}
        />
      )}
      {category === 'arpeggio' && (
        <SubToggle
          options={ARPEGGIO_QUALITIES}
          value={arpQuality}
          onChange={setArpQuality}
          labelFor={(q) => `${q[0].toUpperCase()}${q.slice(1)} arpeggios`}
        />
      )}

      <div className="tech-layout">
        <div>
          <div className="tech-grid">
            {visible.map((s) => (
              <ScaleCard key={s.id} scale={s} onStartSession={onStartSession} />
            ))}
          </div>
        </div>

        <aside className="tech-rail">
          <div className="today-panel">
            <div className="head">
              <span className="l">— today's routine</span>
              <span className="date">{routine.length} items · ~{Math.round(routine.length * 2.5)} min</span>
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
              {visible.map((s) => (
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
    </div>
  );
}

interface SubToggleProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labelFor: (v: T) => string;
}

function SubToggle<T extends string>({ options, value, onChange, labelFor }: SubToggleProps<T>) {
  return (
    <div className="tech-sub-toggle">
      {options.map((opt) => (
        <button
          key={opt}
          className={`sub-chip ${opt === value ? 'active' : ''}`}
          onClick={() => onChange(opt)}
          aria-pressed={opt === value}
        >
          {labelFor(opt)}
        </button>
      ))}
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
  const subtitle = subtitleFor(scale);
  return (
    <article className="scale-card" data-comfort={comfortClass(scale.comfort)}>
      <header>
        <div className="tonic">{scale.tonic}</div>
        <div className="name">
          <div className="n">{scale.name}</div>
          <div className="s">{subtitle}</div>
        </div>
        <span className={`dot ${comfortClass(scale.comfort)}`} />
      </header>

      <div className="engraving">
        <Score
          data={scale.abc}
          options={SCALE_THUMB_OPTS}
          ariaLabel={`${scale.name}, one octave`}
        />
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

function subtitleFor(scale: Scale): string {
  switch (scale.family) {
    case 'major':
      return 'major scale · one octave';
    case 'natural-minor':
      return 'natural minor · one octave';
    case 'harmonic-minor':
      return 'harmonic minor · raised 7th';
    case 'melodic-minor':
      return 'melodic ascending · raised 6 + 7';
    case 'major-arpeggio':
      return 'major arpeggio · 1 · 3 · 5 · 8';
    case 'minor-arpeggio':
      return 'minor arpeggio · 1 · ♭3 · 5 · 8';
  }
}
