// src/chrome.jsx — app shell: sidebar + topbar + icon set

/* ─── Tiny inline icon set (Phosphor-ish, 1.5px) ──────── */
const Icon = ({ name, size = 16, color = 'currentColor' }) => {
  const props = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round',
  };
  switch (name) {
    case 'home':
      return (<svg {...props}><path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z"/></svg>);
    case 'book':
      return (<svg {...props}><path d="M4 4h8a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M20 4h-8a4 4 0 0 0-4 4v12h8a4 4 0 0 0 4-4z"/></svg>);
    case 'metronome':
      return (<svg {...props}><path d="M8 21h8M7 21L11 3h2l4 18M9 14h6"/><path d="M12 14l4-9"/></svg>);
    case 'chart':
      return (<svg {...props}><path d="M3 21h18"/><rect x="6" y="13" width="3" height="6"/><rect x="11" y="9" width="3" height="10"/><rect x="16" y="5" width="3" height="14"/></svg>);
    case 'pen':
      return (<svg {...props}><path d="M3 21l3.5-1L18 8.5 15.5 6 4 17.5z"/><path d="M14 7l3 3"/></svg>);
    case 'play':
      return (<svg {...props}><path d="M8 5v14l11-7z" fill={color} stroke="none"/></svg>);
    case 'pause':
      return (<svg {...props}><rect x="7" y="5" width="3" height="14"/><rect x="14" y="5" width="3" height="14"/></svg>);
    case 'arrow-right':
      return (<svg {...props}><path d="M5 12h14M13 6l6 6-6 6"/></svg>);
    case 'arrow-up-right':
      return (<svg {...props}><path d="M7 17L17 7M9 7h8v8"/></svg>);
    case 'plus':
      return (<svg {...props}><path d="M12 5v14M5 12h14"/></svg>);
    case 'more':
      return (<svg {...props}><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>);
    case 'pdf':
      return (<svg {...props}><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><text x="8" y="17" fontSize="6" fill={color} stroke="none" fontFamily="sans-serif" fontWeight="600">PDF</text></svg>);
    case 'image':
      return (<svg {...props}><rect x="3" y="5" width="18" height="14" rx="1"/><circle cx="9" cy="11" r="1.5"/><path d="M21 17l-5-5-9 7"/></svg>);
    case 'staff':
      return (<svg {...props}><path d="M3 6h18M3 10h18M3 14h18M3 18h18"/></svg>);
    case 'mic':
      return (<svg {...props}><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/></svg>);
    case 'rewind':
      return (<svg {...props}><path d="M11 5l-7 7 7 7M20 5l-7 7 7 7"/></svg>);
    case 'forward':
      return (<svg {...props}><path d="M13 5l7 7-7 7M4 5l7 7-7 7"/></svg>);
    case 'pin':
      return (<svg {...props}><path d="M12 22v-7M7 9l5-5 5 5-2 2-3-1-3 1z"/></svg>);
    case 'search':
      return (<svg {...props}><circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/></svg>);
    case 'check':
      return (<svg {...props}><path d="M5 12l5 5 9-12"/></svg>);
    case 'loop':
      return (<svg {...props}><path d="M4 7h13l-3-3M20 17H7l3 3"/></svg>);
    default:
      return null;
  }
};

/* ─── Side rail ───────────────────────────────────────── */
const Sidebar = ({ view, setView, openPiece }) => {
  const items = [
    { id: 'library',    icon: 'book',       label: 'Library',     count: SOUND_DATA.PIECES.length },
    { id: 'session',    icon: 'metronome',  label: 'Session',     count: null },
    { id: 'stats',      icon: 'chart',      label: 'Stats',       count: null },
    { id: 'sketchbook', icon: 'pen',        label: 'Sketchbook',  count: SOUND_DATA.SKETCHES.length },
  ];
  const totalToday = SOUND_DATA.WEEK[6].piano + SOUND_DATA.WEEK[6].guitar + SOUND_DATA.WEEK[6].compose;
  return (
    <aside className="side">
      <div className="brand">
        <img className="mark" src="assets/mark.svg" alt="Soundings" />
      </div>

      <div className="nav">
        <div className="nav-label">— Practice</div>
        {items.map((it) => (
          <a key={it.id}
             className={view === it.id ? 'active' : ''}
             onClick={() => setView(it.id)}>
            <span className="ico"><Icon name={it.icon} /></span>
            {it.label}
            {it.count != null && <span className="count">{String(it.count).padStart(2,'0')}</span>}
          </a>
        ))}

        <div className="nav-label">— Instruments</div>
        {SOUND_DATA.INSTRUMENTS.map((ins) => (
          <a key={ins.id} onClick={() => setView('library')}>
            <span className="ico">
              <span className={`dot ${ins.id === 'piano' ? 'deep' : ins.id === 'guitar' ? 'shallow' : ins.id === 'voice' ? 'warm' : 'surface'}`}/>
            </span>
            {ins.name}
            <span className="count">{String(ins.count).padStart(2,'0')}</span>
          </a>
        ))}
      </div>

      <div className="now">
        <div className="row"><span>Today</span><span className="v">{totalToday} min</span></div>
        <div className="row"><span>This week</span><span className="v">{SOUND_DATA.WEEK.reduce((s,d)=>s+d.piano+d.guitar+d.compose,0)} min</span></div>
        <div className="streak">
          <span className="n">28</span>
          <span className="l">day streak</span>
        </div>
      </div>
    </aside>
  );
};

/* ─── Top crumb / toolbar ─────────────────────────────── */
const Topbar = ({ crumbs = [], right = null }) => (
  <div className="topbar">
    <div className="crumb">
      {crumbs.map((c, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="sep">/</span>}
          <span className={i === crumbs.length - 1 ? 'here' : ''}>{c}</span>
        </React.Fragment>
      ))}
    </div>
    <div className="right">
      <span className="date">19 may 2026 · 18:47 · 24.5°n 158.2°w</span>
      {right}
      <button className="icon-btn"><Icon name="search" size={16} /></button>
      <button className="icon-btn lumen"><Icon name="plus" size={16} /></button>
    </div>
  </div>
);

Object.assign(window, { Icon, Sidebar, Topbar });
