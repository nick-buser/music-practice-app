// src/library.jsx — overview: pieces grouped by instrument + today panel

const LibraryView = ({ onOpenPiece, onStartSession }) => {
  const [filter, setFilter] = React.useState('all');
  const { INSTRUMENTS, PIECES, TODAY_QUEUE, QUOTES } = SOUND_DATA;

  const filtered = PIECES.filter(p => filter === 'all' || p.instrument === filter);
  const grouped = INSTRUMENTS
    .filter(i => i.id !== 'compose')
    .map(ins => ({ ...ins, pieces: filtered.filter(p => p.instrument === ins.id) }))
    .filter(g => g.pieces.length > 0);

  return (
    <div>
      <Topbar crumbs={['Soundings', 'Library']} />

      <div style={{ position: 'relative' }}>
        <div className="sonar-faint"><img src="assets/sonar-rings.svg" alt="" /></div>

        <div className="page-hero">
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="eyebrow"><span className="rule"/> The library · {PIECES.length} pieces · 4 instruments</div>
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
            <button className={`filter-chip ${filter==='all' ? 'active' : ''}`} onClick={()=>setFilter('all')}>All</button>
            {INSTRUMENTS.filter(i=>i.id!=='compose').map(i => (
              <button key={i.id}
                className={`filter-chip ${filter===i.id ? 'active' : ''}`}
                onClick={()=>setFilter(i.id)}>{i.name}</button>
            ))}
            <div className="spacer"/>
            <div className="sort">Sort: <b>last touched ↓</b></div>
          </div>

          {grouped.map(g => (
            <section key={g.id} className="lib-group">
              <div className="lib-group-head">
                <span className="name">{g.name}</span>
                <span className="latin">{g.latin}</span>
                <span className="count">{String(g.pieces.length).padStart(2,'0')} pieces · {Math.round(g.pieces.reduce((s,p)=>s+p.minutesTotal,0)/60)}h logged</span>
              </div>
              <div>
                {g.pieces.map(p => (
                  <div key={p.id} className="piece-row" onClick={() => onOpenPiece(p.id)}>
                    <button className="play" onClick={(e) => { e.stopPropagation(); onStartSession(p.id); }}>
                      <Icon name="play" size={12}/>
                    </button>
                    <div>
                      <div className="title">
                        {p.title}{p.subtitle ? <em>· {p.subtitle}</em> : null}
                      </div>
                      <div className="composer">{p.composer} · {p.year} · {p.key} · {p.meter}</div>
                    </div>
                    <div className="progress">
                      <div className="bar"><div className="fill" style={{ transform: `scaleX(${p.progressPct})` }}/></div>
                      <div className="pct">{Math.round(p.progressPct*100)}%</div>
                    </div>
                    <div className="depth">
                      <span className={`dot ${p.depth}`}/>
                      <div style={{ marginTop: 2 }}>
                        <span className="v">{p.depthLabel}</span>
                      </div>
                    </div>
                    <div className="last">
                      <div>last <span style={{ color: 'var(--foam)' }}>{relTime(p.lastTouched)}</span></div>
                      <div>{p.sessions} sessions · {Math.round(p.minutesTotal/60)}h {p.minutesTotal%60}m</div>
                    </div>
                    <div className="more">
                      <Icon name="arrow-right" size={14}/>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <aside className="lib-rail">
          {/* Today's queue */}
          <div className="today-panel">
            <div className="head">
              <span className="l">— Today · queued</span>
              <span className="date">19 may · 18:47</span>
            </div>
            <div className="queue-list">
              {TODAY_QUEUE.map((q, i) => (
                <div key={q.id} className="queue-item" onClick={() => q.pieceId && onStartSession(q.pieceId)}>
                  <div className="ord">{String(i+1).padStart(2,'0')}</div>
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

          {/* Depth strip — how mastered each piece is */}
          <div className="card">
            <div className="head">
              <h3>Depth strip</h3>
              <span className="eyebrow">— mastery</span>
            </div>
            <div className="depth-strip">
              {PIECES.filter(p=>p.depth!=='mastered').slice(0,6).map(p => (
                <div key={p.id} className="row">
                  <div className="name">{p.title.split(' ')[0]}</div>
                  <div className="bar">
                    <span className="pin" style={{ left: `${Math.round(p.progressPct*100)}%` }}/>
                  </div>
                  <div className="num">{Math.round(p.progressPct*100)}%</div>
                </div>
              ))}
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', color: 'var(--shoal)', fontSize: 13, marginTop: 14, lineHeight: 1.5 }}>
              Surface to trench: red marks the parts that fight back; mint marks
              the ones that <span className="lumen">settle</span>.
            </div>
          </div>

          {/* Quote */}
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
};

function relTime(dateStr) {
  // dateStr like '2026-05-19' — compare to today (also 2026-05-19)
  const today = new Date('2026-05-19');
  const d = new Date(dateStr);
  const diff = Math.round((today - d) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'today';
  if (diff === 1) return 'yesterday';
  if (diff < 7) return `${diff} days ago`;
  if (diff < 30) return `${Math.floor(diff/7)} wk ago`;
  return `${Math.floor(diff/30)} mo ago`;
}

Object.assign(window, { LibraryView });
