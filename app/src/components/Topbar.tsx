import { Icon } from './Icon';

interface Props {
  crumbs: string[];
}

export function Topbar({ crumbs }: Props) {
  return (
    <div className="topbar">
      <div className="crumb">
        {crumbs.map((c, i) => (
          <span key={i} className={i === crumbs.length - 1 ? 'here' : ''}>
            {i > 0 && <span className="sep" style={{ marginRight: 12 }}>/</span>}
            {c}
          </span>
        ))}
      </div>
      <div className="right">
        <span className="date">19 may 2026 · 18:47 · 24.5°n 158.2°w</span>
        <button className="icon-btn" aria-label="Search"><Icon name="search" size={16} /></button>
        <button className="icon-btn lumen" aria-label="New"><Icon name="plus" size={16} /></button>
      </div>
    </div>
  );
}
