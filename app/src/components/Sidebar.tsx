import { Icon } from './Icon';
import { INSTRUMENTS, PIECES, TODAY_TOTAL_MIN, WEEK_TOTAL_MIN } from '../data/sounddata';
import { SCALES } from '../data/scales';
import markUrl from '../assets/mark.svg';

export type View = 'library' | 'piece' | 'session' | 'stats' | 'sketchbook' | 'technique';

interface Props {
  view: View;
  onSetView: (v: View) => void;
}

const NAV: Array<{ id: View; icon: string; label: string; count: number | null }> = [
  { id: 'library',    icon: 'book',      label: 'Library',    count: PIECES.length },
  { id: 'technique',  icon: 'scales',    label: 'Technique',  count: SCALES.length },
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

export function Sidebar({ view, onSetView }: Props) {
  return (
    <aside className="side">
      <div className="brand">
        <img className="mark" src={markUrl} alt="Soundings" />
      </div>

      <div className="nav">
        <div className="nav-label">— Practice</div>
        {NAV.map((it) => (
          <a
            key={it.id}
            className={view === it.id ? 'active' : ''}
            onClick={() => onSetView(it.id)}
          >
            <span className="ico"><Icon name={it.icon} /></span>
            {it.label}
            {it.count !== null && (
              <span className="count">{String(it.count).padStart(2, '0')}</span>
            )}
          </a>
        ))}

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
