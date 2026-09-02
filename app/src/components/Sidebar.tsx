import { Icon } from './Icon';
import { INSTRUMENTS, PIECES, TODAY_TOTAL_MIN, WEEK_TOTAL_MIN } from '../data/sounddata';
import { DRILLS } from '../data/drills';
import { RAGAS } from '../data/raga/raga';
import markUrl from '../assets/mark.svg';

export type View = 'library' | 'piece' | 'session' | 'stats' | 'sketchbook' | 'drills' | 'world-notation';

interface Props {
  view: View;
  onSetView: (v: View) => void;
  /**
   * Overrides for NAV's compiled-in counts, keyed by view id — e.g. the
   * Sketchbook badge becomes the live inbox count once a backend is
   * configured (docs/sketchbook.md: "The sidebar count on the Sketchbook
   * nav item becomes the inbox count"). NAV is a module-level const and
   * can't read live state itself, so App.tsx computes the live number and
   * threads it in here; omitted entries fall back to NAV's static count.
   */
  counts?: Partial<Record<View, number>>;
}

const NAV: Array<{ id: View; icon: string; label: string; count: number | null }> = [
  { id: 'library',    icon: 'book',      label: 'Library',    count: PIECES.length },
  { id: 'drills',     icon: 'scales',    label: 'Drills',     count: DRILLS.length },
  { id: 'world-notation', icon: 'globe', label: 'World',      count: RAGAS.length },
  { id: 'session',    icon: 'metronome', label: 'Session',    count: null },
  { id: 'stats',      icon: 'chart',     label: 'Stats',      count: null },
  { id: 'sketchbook', icon: 'pen',       label: 'Sketchbook', count: 3 },
];

const INSTR_DOT: Record<string, string> = {
  piano: 'deep',
  guitar: 'shallow',
  voice: 'warm',
  compose: 'surface',
};

export function Sidebar({ view, onSetView, counts }: Props) {
  return (
    <aside className="side">
      <div className="brand">
        <img className="mark" src={markUrl} alt="Soundings" />
      </div>

      <div className="nav">
        <div className="nav-label">— Practice</div>
        {NAV.map((it) => {
          const count = counts?.[it.id] ?? it.count;
          return (
            <a
              key={it.id}
              className={view === it.id ? 'active' : ''}
              onClick={() => onSetView(it.id)}
            >
              <span className="ico"><Icon name={it.icon} /></span>
              {it.label}
              {count !== null && (
                <span className="count">{String(count).padStart(2, '0')}</span>
              )}
            </a>
          );
        })}

        <div className="nav-label">— Instruments</div>
        {INSTRUMENTS.map((ins) => (
          <a key={ins.id} onClick={() => onSetView('library')}>
            <span className="ico"><span className={`dot ${INSTR_DOT[ins.id] ?? 'surface'}`} /></span>
            {ins.name}
            <span className="count">{String(ins.count).padStart(2, '0')}</span>
          </a>
        ))}
      </div>

      <div className="now">
        <div className="row"><span>Today</span><span className="v">{TODAY_TOTAL_MIN} min</span></div>
        <div className="row"><span>This week</span><span className="v">{WEEK_TOTAL_MIN} min</span></div>
        <div className="streak">
          <span className="n">28</span>
          <span className="l">day streak</span>
        </div>
      </div>
    </aside>
  );
}
