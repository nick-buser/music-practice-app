import { useMemo, useState } from 'react';
import { Topbar } from '../components/Topbar';
import { GuitarChord } from '../components/GuitarChord';
import { GuitarScale } from '../components/GuitarScale';
import { guitarSupportsChord } from '../guitar/support';
import { noteToPitchClass } from '../guitar/notes';
import { Score } from '../verovio/Score';
import {
  ARP_FAMILY_BY_QUALITY,
  CHORD_CATEGORIES,
  CHORD_TYPE_META,
  CHORD_TYPES,
  ChordType,
  DAILY_ROUTINE_IDS,
  DRILLS,
  QualitySubTab,
  QUALITY_SUBTABS,
  SCALE_CATEGORIES,
  SCALE_FAMILY_BY_SUBTAB,
  SCALE_SUBTAB_CATEGORY,
  SCALE_SUBTABS,
  ScaleSubTab,
} from '../data/drills';
import { relTime } from '../lib/time';
import {
  applyVoicing,
  CHORD_IDENTITY_BY_ID,
  encodeVoicedId,
  VOICINGS,
  type VoicingKey,
  type VoicingOption,
} from '../data/chord-catalog';
import { coreToneCount, displayName, subtitleLine, toAbc } from '../data/chord-identity';
import type { ChordIdentity } from '../data/chord-identity';
import { useSavedChords } from '../hooks/useSavedChords';
import type { Drill, TechniqueFamily } from '../data/schemas';

interface Props {
  onStartSession: (id: string) => void;
}

/** Top-level category — what the visible tabs are. */
type TopTab = 'scales' | 'arpeggios' | 'chords';

const TOP_TABS: Array<{ id: TopTab; label: string }> = [
  { id: 'scales',    label: 'Scales' },
  { id: 'arpeggios', label: 'Arpeggios' },
  { id: 'chords',    label: 'Chords' },
];

const SCALE_SUBTAB_LABEL: Record<ScaleSubTab, string> = {
  major:    'Major',
  natural:  'Natural minor',
  harmonic: 'Harmonic minor',
  melodic:  'Melodic minor',
  hirajoshi: 'Hirajōshi',
  'in-sen':  'In',
  yo:        'Yo',
  iwato:     'Iwato',
  kumoi:     'Kumoi',
  gong:      'Gōng',
  shang:     'Shāng',
  jue:       'Jué',
  zhi:       'Zhǐ',
  yu:        'Yǔ',
};

const QUALITY_LABEL: Record<QualitySubTab, string> = {
  major: 'Major',
  minor: 'Minor',
};

const DRILL_THUMB_OPTS = {
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

/** Notation the engravings render in. Guitar is far more natural on fretted instruments. */
type Notation = 'staff' | 'guitar';
const NOTATIONS = ['staff', 'guitar'] as const;
const NOTATION_LABEL: Record<Notation, string> = { staff: 'Staff', guitar: 'Guitar' };

export function DrillsView({ onStartSession }: Props) {
  const [topTab, setTopTab] = useState<TopTab>('scales');
  const [scaleSub, setScaleSub] = useState<ScaleSubTab>('major');
  const [arpSub, setArpSub] = useState<QualitySubTab>('major');
  const [chordType, setChordType] = useState<ChordType>('major');
  const [voicing, setVoicing] = useState<VoicingKey>('root');
  const [notation, setNotation] = useState<Notation>('staff');

  const activeFamily: TechniqueFamily = useMemo(() => {
    if (topTab === 'scales') return SCALE_FAMILY_BY_SUBTAB[scaleSub];
    if (topTab === 'arpeggios') return ARP_FAMILY_BY_QUALITY[arpSub];
    return CHORD_TYPE_META[chordType].family;
  }, [topTab, scaleSub, arpSub, chordType]);

  const visible = useMemo(
    () => DRILLS.filter((d) => d.family === activeFamily),
    [activeFamily],
  );

  // Which voicings apply to the current chord type (a triad has no 3rd inversion
  // / drops), and the one actually in effect (fall back to Root if the selected
  // voicing isn't available for this type).
  const availableVoicings = useMemo<VoicingOption[]>(() => {
    if (topTab !== 'chords') return [];
    const identity = visible[0] && CHORD_IDENTITY_BY_ID.get(visible[0].id);
    if (!identity) return [];
    const tones = coreToneCount(identity);
    return VOICINGS.filter((v) => v.minTones <= tones);
  }, [topTab, visible]);

  const effectiveVoicing: VoicingKey =
    availableVoicings.some((v) => v.key === voicing) ? voicing : 'root';

  // Backend-gated: saving chords is a local-build feature (no-op / hidden on
  // the public, backend-less deploy). Only fetches while the Chords tab is open.
  const saved = useSavedChords(topTab === 'chords');

  const routine = useMemo(() => {
    const byId = new Map(DRILLS.map((d) => [d.id, d]));
    return DAILY_ROUTINE_IDS.map((id) => byId.get(id)).filter((d): d is Drill => Boolean(d));
  }, []);

  const stats = useMemo(() => {
    const total = DRILLS.length;
    const fluent = DRILLS.filter((d) => d.comfort > 0.8).length;
    const avg = DRILLS.reduce((a, d) => a + d.comfort, 0) / Math.max(1, total);
    const reps = DRILLS.reduce((a, d) => a + d.reps, 0);
    return { total, fluent, avg, reps };
  }, []);

  return (
    <div>
      <Topbar crumbs={['Soundings', 'Drills']} />

      <div className="page-hero">
        <div>
          <div className="eyebrow"><span className="rule" /> Drills · daily warmup</div>
          <h1>Sound every key, <em>every day</em>.</h1>
          <div className="lede">
            Scales, arpeggios, and chords — the slow rotation of all twelve keys.
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
        {TOP_TABS.map((t) => (
          <button
            key={t.id}
            className={`tech-tab ${topTab === t.id ? 'active' : ''}`}
            onClick={() => setTopTab(t.id)}
            aria-current={topTab === t.id ? 'page' : undefined}
          >
            {t.label}
          </button>
        ))}
        <div className="notation-toggle">
          <SubToggle
            options={NOTATIONS}
            value={notation}
            onChange={setNotation}
            labelFor={(v) => NOTATION_LABEL[v]}
          />
        </div>
      </div>

      {topTab === 'scales' && (
        <ScaleTypePicker value={scaleSub} onChange={setScaleSub} />
      )}
      {topTab === 'arpeggios' && (
        <SubToggle
          options={QUALITY_SUBTABS}
          value={arpSub}
          onChange={setArpSub}
          labelFor={(v) => `${QUALITY_LABEL[v]} arpeggios`}
        />
      )}
      {topTab === 'chords' && (
        <>
          <ChordTypePicker value={chordType} onChange={setChordType} />
          <VoicingToggle options={availableVoicings} value={effectiveVoicing} onChange={setVoicing} />
        </>
      )}

      <div className="tech-layout">
        <div>
          <div className="tech-grid">
            {visible.map((d) => (
              <DrillCard
                key={d.id}
                drill={d}
                voicing={effectiveVoicing}
                notation={notation}
                onStartSession={onStartSession}
                onSave={saved.enabled ? saved.save : undefined}
              />
            ))}
          </div>
        </div>

        <aside className="tech-rail">
          {saved.enabled && topTab === 'chords' && (
            <div className="card" data-testid="saved-chords">
              <div className="head">
                <h3>Saved chords</h3>
                <span className="eyebrow">— local</span>
              </div>
              {saved.error && <div className="s" style={{ color: 'var(--krill)' }}>{saved.error}</div>}
              {saved.chords.length === 0 ? (
                <div style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', color: 'var(--shoal)', fontSize: 13 }}>
                  Save a voicing from any chord card to keep it here.
                </div>
              ) : (
                <div className="routine-list">
                  {saved.chords.map((c) => (
                    <div key={c.id} className="routine-item">
                      <div className="what"><div className="t">{c.label ?? 'Untitled'}</div></div>
                      <button className="btn btn-ghost" onClick={() => void saved.remove(c.id)}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="today-panel">
            <div className="head">
              <span className="l">— today's routine</span>
              <span className="date">{routine.length} items · ~{Math.round(routine.length * 2.5)} min</span>
            </div>
            <div className="routine-list">
              {routine.map((d, i) => (
                <div key={d.id} className="routine-item" onClick={() => onStartSession(d.id)}>
                  <div className="ord">{String(i + 1).padStart(2, '0')}</div>
                  <div className="what">
                    <div className="t">{d.name}</div>
                    <div className="s">
                      target ♩ = {d.bpmTarget} · working ♩ = {d.bpmCurrent}
                    </div>
                  </div>
                  <span className={`dot ${comfortClass(d.comfort)}`} />
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
              {visible.map((d) => (
                <div key={d.id} className="row">
                  <div className="name">{d.tonic}</div>
                  <div className="bar">
                    <span className="pin" style={{ left: `${Math.round(d.comfort * 100)}%` }} />
                  </div>
                  <div className="num">{Math.round(d.comfort * 100)}%</div>
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

/**
 * The Scales sub-toggle, grouped into labelled rows (Western · Japanese …) like
 * the chord picker, so new scale traditions slot in without crowding one row.
 */
function ScaleTypePicker({
  value,
  onChange,
}: {
  value: ScaleSubTab;
  onChange: (v: ScaleSubTab) => void;
}) {
  return (
    <div className="chord-type-picker">
      {SCALE_CATEGORIES.map((cat) => {
        const subs = SCALE_SUBTABS.filter((s) => SCALE_SUBTAB_CATEGORY[s] === cat.id);
        if (subs.length === 0) return null;
        return (
          <div key={cat.id} className="chord-type-row">
            <span className="cat-label">{cat.label}</span>
            <div className="chord-pills">
              {subs.map((s) => (
                <button
                  key={s}
                  className={`sub-chip ${s === value ? 'active' : ''}`}
                  onClick={() => onChange(s)}
                  aria-pressed={s === value}
                >
                  {SCALE_SUBTAB_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface ChordTypePickerProps {
  value: ChordType;
  onChange: (t: ChordType) => void;
}

/**
 * Two-level layout for the Chords sub-toggle: each category (Triads / 7ths)
 * is its own labelled row of pills, so new categories (9ths / 11ths / 13ths /
 * altered) drop in by extending CHORD_CATEGORIES + CHORD_TYPE_META without
 * touching the rendering.
 */
function ChordTypePicker({ value, onChange }: ChordTypePickerProps) {
  return (
    <div className="chord-type-picker">
      {CHORD_CATEGORIES.map((cat) => {
        const types = CHORD_TYPES.filter((t) => CHORD_TYPE_META[t].category === cat.id);
        if (types.length === 0) return null;
        return (
          <div key={cat.id} className="chord-type-row">
            <span className="cat-label">{cat.label}</span>
            <div className="chord-pills">
              {types.map((t) => (
                <button
                  key={t}
                  className={`sub-chip ${t === value ? 'active' : ''}`}
                  onClick={() => onChange(t)}
                  aria-pressed={t === value}
                >
                  {CHORD_TYPE_META[t].label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Voicing toggle for the Chords tab — re-voices the visible chords (inversions
 * and drop voicings). Only shown when the current chord type supports more than
 * the root voicing. Hidden for scales/arpeggios (which have no identity).
 */
function VoicingToggle({
  options,
  value,
  onChange,
}: {
  options: VoicingOption[];
  value: VoicingKey;
  onChange: (v: VoicingKey) => void;
}) {
  if (options.length <= 1) return null;
  return (
    <div className="tech-sub-toggle voicing-toggle">
      <span className="cat-label">Voicing</span>
      {options.map((o) => (
        <button
          key={o.key}
          className={`sub-chip ${o.key === value ? 'active' : ''}`}
          onClick={() => onChange(o.key)}
          aria-pressed={o.key === value}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface CardProps {
  drill: Drill;
  voicing: VoicingKey;
  notation: Notation;
  onStartSession: (id: string) => void;
  /** Provided only when the backend is enabled — saves the shown voicing. */
  onSave?: (identity: ChordIdentity, label: string) => void | Promise<void>;
}

function DrillCard({ drill, voicing, notation, onStartSession, onSave }: CardProps) {
  const last = drill.lastTouched ? relTime(drill.lastTouched) : 'never';
  const atTarget = drill.bpmCurrent >= drill.bpmTarget;

  // Chords can be re-voiced live; scales/arpeggios have no identity and render
  // their hand-written engraving unchanged.
  const identity = CHORD_IDENTITY_BY_ID.get(drill.id);
  const voiced = identity && voicing !== 'root' ? applyVoicing(identity, voicing) : null;
  const name = voiced ? displayName(voiced) : drill.name;
  const subtitle = voiced ? subtitleLine(voiced) : subtitleFor(drill);
  const abc = voiced ? toAbc(voiced, name) : drill.abc;
  const runId = voiced ? encodeVoicedId(drill.id, voicing) : drill.id;

  // Guitar view: chord grips for chords (canonical, voicing-independent), a
  // fretboard for scales/arpeggios. Unsupported chord types fall back to staff.
  const chordType = identity ? (drill.family.replace('-chord', '') as ChordType) : null;
  const showGuitarChord =
    notation === 'guitar' && chordType !== null && guitarSupportsChord(chordType);
  const showGuitarScale = notation === 'guitar' && identity === undefined;
  const showingGuitar = showGuitarChord || showGuitarScale;

  return (
    <article className="scale-card" data-comfort={comfortClass(drill.comfort)}>
      <header>
        <div className="tonic">{drill.tonic}</div>
        <div className="name">
          <div className="n">{name}</div>
          <div className="s">{subtitle}</div>
        </div>
        <span className={`dot ${comfortClass(drill.comfort)}`} />
      </header>

      <div className={`engraving ${showingGuitar ? 'guitar' : ''}`}>
        {notation === 'guitar' && chordType !== null && guitarSupportsChord(chordType) ? (
          <GuitarChord type={chordType} pitchClass={noteToPitchClass(drill.tonic)} name={drill.name} />
        ) : showGuitarScale ? (
          <GuitarScale family={drill.family} tonic={drill.tonic} />
        ) : (
          <Score data={abc} options={DRILL_THUMB_OPTS} ariaLabel={name} />
        )}
      </div>

      <div className="meta">
        <span>target <b>♩ = {drill.bpmTarget}</b></span>
        <span>
          working{' '}
          <b style={{ color: atTarget ? 'var(--lumen)' : 'var(--krill)' }}>
            ♩ = {drill.bpmCurrent}
          </b>
        </span>
        <span>{drill.reps} reps</span>
        <span>last <span style={{ color: 'var(--foam)' }}>{last}</span></span>
      </div>

      <footer>
        <button className="btn btn-ghost" onClick={() => onStartSession(runId)}>
          Run it →
        </button>
        {onSave && identity && (
          <button className="btn btn-ghost" onClick={() => void onSave(voiced ?? identity, name)}>
            ★ Save
          </button>
        )}
      </footer>
    </article>
  );
}

/**
 * The italic line under each drill card. Chords derive it from their identity
 * (`subtitleLine`); scales and arpeggios — which aren't chords — keep their
 * hand-written descriptors.
 */
function subtitleFor(drill: Drill): string {
  const identity = CHORD_IDENTITY_BY_ID.get(drill.id);
  if (identity) return subtitleLine(identity);
  switch (drill.family) {
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
    default:
      return '';
  }
}
