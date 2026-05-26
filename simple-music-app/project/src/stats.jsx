// src/stats.jsx — practice journal / analytics

const StatsView = () => {
  const { HEATMAP, TIME_BY_PIECE, WEEK, RECENT } = SOUND_DATA;
  const maxWeekTotal = Math.max(...WEEK.map(d => d.piano + d.guitar + d.compose));
  const totalThisWeek = WEEK.reduce((s, d) => s + d.piano + d.guitar + d.compose, 0);

  return (
    <div>
      <Topbar crumbs={['Soundings', 'Practice journal']} />

      <div className="page-hero">
        <div>
          <div className="eyebrow"><span className="rule"/> Practice journal · last 365 days</div>
          <h1>The <em>sounding line</em> pays out.</h1>
          <div className="lede">
            Every cell below is a day of practice — the brighter, the longer.
            The columns to the right are what kept you in the chair.
          </div>
        </div>
        <div className="meta-col">
          <div>Logged this year <span className="v">194h 22m</span></div>
          <div>Sessions this year <span className="v">412</span></div>
          <div>Longest streak <span className="v">61 days</span></div>
          <div>Current streak <span className="v" style={{ color: 'var(--lumen)' }}>28 days</span></div>
        </div>
      </div>

      {/* Headline numbers */}
      <div className="stats-summary">
        <div className="cell">
          <span className="lbl">— this week</span>
          <span className="n lumen">{Math.floor(totalThisWeek/60)}h {totalThisWeek%60}m</span>
          <span className="delta up">+ <b>32m</b> vs. last week</span>
        </div>
        <div className="cell">
          <span className="lbl">— daily average</span>
          <span className="n">{Math.round(totalThisWeek/7)}<span className="unit">min</span></span>
          <span className="delta">target <b>45m</b> · met 5/7 days</span>
        </div>
        <div className="cell">
          <span className="lbl">— streak</span>
          <span className="n lumen">28<span className="unit">days</span></span>
          <span className="delta up">longest of <b>2026</b></span>
        </div>
        <div className="cell">
          <span className="lbl">— pieces in motion</span>
          <span className="n">7</span>
          <span className="delta">3 maintenance · <b>4</b> active</span>
        </div>
      </div>

      {/* Heatmap (year) */}
      <div className="stats-card" style={{ marginBottom: 32 }}>
        <div className="head">
          <div>
            <div className="l">— bathy chart · daily depth</div>
            <h3 className="t">Practice minutes, every day of the year</h3>
          </div>
          <div className="r">
            <span style={{ color: 'var(--shoal)' }}>0m</span>
            <span style={{ margin: '0 14px' }}>
              {[0,1,2,3,4].map(l => (
                <span key={l} className={`cell l${l}`} style={{
                  display: 'inline-block', width: 12, height: 12, marginRight: 3, borderRadius: 2,
                  background: l === 0 ? 'color-mix(in oklch, var(--foam) 6%, transparent)'
                    : `color-mix(in oklch, var(--lumen) ${[0,16,32,55,100][l]}%, transparent)`,
                  boxShadow: l >= 3 ? '0 0 6px var(--lumen-core)' : 'none',
                }}/>
              ))}
            </span>
            <span style={{ color: 'var(--foam)' }}>120m+</span>
          </div>
        </div>

        <div className="heat-grid">
          {HEATMAP.map((level, i) => (
            <div key={i} className={`cell l${level}`}/>
          ))}
        </div>

        <div className="heat-x-axis">
          {['Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May'].map(m => <span key={m}>{m}</span>)}
        </div>
      </div>

      {/* Time by piece + week breakdown */}
      <div className="stats-grid">
        <div className="stats-card">
          <div className="head">
            <div>
              <div className="l">— time invested · by piece</div>
              <h3 className="t">What you've been hunting</h3>
            </div>
            <div className="r">last 90 days</div>
          </div>
          <div className="bars">
            {TIME_BY_PIECE.map((p, i) => (
              <div key={i} className="row">
                <div className="lbl">
                  <span className="name">{p.name}</span>
                  <span className="who">{p.who}</span>
                </div>
                <div className="v">{Math.floor(p.mins/60)}h {p.mins%60}m</div>
                <div className="bar-wrap">
                  <div className="bar" style={{
                    transform: `scaleX(${p.pct})`,
                    background: p.who === 'compose'
                      ? 'linear-gradient(to right, color-mix(in oklch, var(--krill) 75%, transparent), var(--krill))'
                      : undefined,
                    boxShadow: p.who === 'compose' ? '0 0 8px color-mix(in oklch, var(--krill) 70%, transparent)' : '0 0 8px var(--lumen-core)',
                  }}/>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="stats-card">
          <div className="head">
            <div>
              <div className="l">— this week</div>
              <h3 className="t">Minutes per day, stacked by instrument</h3>
            </div>
            <div className="r">{Math.floor(totalThisWeek/60)}h {totalThisWeek%60}m total</div>
          </div>
          <div className="weekbars">
            {WEEK.map((d, i) => {
              const total = d.piano + d.guitar + d.compose;
              const scale = total / maxWeekTotal;
              const totalPx = 160 * scale;
              return (
                <div key={i} className={`col ${d.today ? 'today' : ''}`}>
                  <div style={{ flex: 1 }}/>
                  <div className="stack" style={{ height: totalPx, justifyContent: 'flex-end' }}>
                    {d.piano > 0 && <div className="seg" style={{ height: (d.piano/total)*totalPx }} title={`Piano · ${d.piano}m`}/>}
                    {d.guitar > 0 && <div className="seg guitar" style={{ height: (d.guitar/total)*totalPx }} title={`Guitar · ${d.guitar}m`}/>}
                    {d.compose > 0 && <div className="seg compose" style={{ height: (d.compose/total)*totalPx }} title={`Compose · ${d.compose}m`}/>}
                  </div>
                  <div className="day">{d.day}<b>{d.date}</b></div>
                </div>
              );
            })}
          </div>
          <div className="legend" style={{ marginTop: 18 }}>
            <span className="item"><span className="sw piano"/> Piano</span>
            <span className="item"><span className="sw guitar"/> Guitar</span>
            <span className="item"><span className="sw compose"/> Composition</span>
          </div>
        </div>
      </div>

      {/* Recent sessions list */}
      <div className="stats-card">
        <div className="head">
          <div>
            <div className="l">— field log</div>
            <h3 className="t">Recent sessions</h3>
          </div>
          <div className="r">last 8</div>
        </div>
        <div className="recent-list">
          {RECENT.map((r, i) => (
            <div key={i} className="recent-row">
              <span className="when">{r.when}</span>
              <span className="what">
                {r.what}
                <span className="sub">{r.sub}</span>
              </span>
              <span className="min">{r.mins}m</span>
              <span className="mood">
                {[1,2,3,4,5].map(p => (
                  <span key={p} className={`pip ${p <= r.mood ? 'on' : ''}`}/>
                ))}
              </span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 18, fontFamily: 'var(--font-body)', fontStyle: 'italic', color: 'var(--shoal)', fontSize: 14, lineHeight: 1.5 }}>
          Mood pips are a five-point reading you log at the end of a session —
          the brighter the row, the further <span className="lumen">down</span> you got.
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { StatsView });
