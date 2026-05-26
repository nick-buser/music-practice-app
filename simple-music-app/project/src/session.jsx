// src/session.jsx — active practice session

const SessionView = ({ pieceId, onEnd, onOpenPiece }) => {
  const piece = SOUND_DATA.PIECES.find(p => p.id === pieceId) || SOUND_DATA.PIECES[0];

  // Timer state
  const [elapsed, setElapsed] = React.useState(847); // seconds (14:07)
  const [playing, setPlaying] = React.useState(true);
  // Metronome state
  const [bpm, setBpm] = React.useState(piece.tempo.bpm);
  const [beat, setBeat] = React.useState(0);
  const [meter] = React.useState(parseInt(piece.meter.split('/')[0]) || 4);
  // Loop / focus section
  const initialLoop = piece.sections.findIndex(s => s.active);
  const [loopIdx, setLoopIdx] = React.useState(initialLoop >= 0 ? initialLoop : 1);
  const [notes, setNotes] = React.useState(
    'Bar 19 LH leap is still tense — try anchoring the elbow.\nThe turn on bar 22 finally locked in around the 18th rep tonight.'
  );

  // Timer tick
  React.useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [playing]);

  // Metronome blink — synced to bpm
  React.useEffect(() => {
    if (!playing) return;
    const ms = (60 / bpm) * 1000;
    const id = setInterval(() => setBeat(b => (b + 1) % meter), ms);
    return () => clearInterval(id);
  }, [playing, bpm, meter]);

  const mm = Math.floor(elapsed / 60);
  const ss = String(elapsed % 60).padStart(2, '0');
  const goalMins = 35;
  const progressPct = Math.min(1, elapsed / (goalMins * 60));

  const focusSection = piece.sections[loopIdx] || piece.sections[0];

  return (
    <div>
      <Topbar crumbs={['Soundings', 'Session · active']} right={
        <>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--lumen)', letterSpacing: '0.18em', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span className="dot deep"/> recording
          </span>
          <button className="btn btn-ghost" onClick={onEnd}>End session</button>
        </>
      }/>

      <div className="session-page">
        <div className="bio-bg" aria-hidden="true">
          <img src="assets/bioluminescence.svg" alt="" />
        </div>

        <div className="layer">
          <div className="page-hero" style={{ marginBottom: 16 }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 14 }}><span className="rule"/> Session · in progress · started 18:33</div>
              <h1>Sounding · <em>session 48</em></h1>
              <div className="lede" style={{ marginTop: 14 }}>
                A focused session on the <span className="lumen">figuration variation</span>.
                Slow tempo. Hands separate. The room is quiet.
              </div>
            </div>
            <div className="meta-col">
              <div>Goal <span className="v">{goalMins}m</span></div>
              <div>Elapsed <span className="v">{mm}m {ss}s</span></div>
              <div>Reps logged <span className="v">14</span></div>
              <div>Energy <span className="v" style={{ color: 'var(--lumen)' }}>++</span></div>
            </div>
          </div>

          <div className="session-grid">
            <div className="session-stage">

              <div className="session-piece">
                <div>
                  <div className="eyebrow">— now sounding</div>
                  <h2>
                    {piece.title}
                    <em>{piece.composer} · {piece.subtitle || piece.key}</em>
                  </h2>
                </div>
                <div className="right">
                  <div>started <span className="v">18:33</span></div>
                  <div>tempo target <span className="v">♩ = {piece.tempo.bpm}</span></div>
                  <div>current <span className="v" style={{ color: bpm < piece.tempo.bpm ? 'var(--krill)' : 'var(--foam)' }}>♩ = {bpm}</span></div>
                </div>
              </div>

              {/* Focus / loop banner */}
              <div className="session-focus">
                <div className="eyebrow">— focus loop · {focusSection.range}</div>
                <h3 className="title">{focusSection.label}</h3>
                <div className="meas">
                  <span style={{ color: 'var(--mist)' }}>{focusSection.subtitle}</span>
                  <span style={{ margin: '0 12px', color: 'var(--shoal)' }}>·</span>
                  <span>target ♩ = <b style={{ color: 'var(--foam)', fontWeight: 400 }}>{piece.tempo.bpm}</b></span>
                  <span style={{ margin: '0 12px', color: 'var(--shoal)' }}>·</span>
                  <span>working at <b style={{ color: 'var(--lumen)' }}>♩ = {bpm}</b></span>
                </div>
              </div>

              {/* Timer */}
              <div className="session-timer">
                <div>
                  <div className={`clock ${playing ? '' : 'paused'}`}>
                    {String(mm).padStart(2,'0')}<span className="sm">:</span>{ss}
                  </div>
                  <div style={{
                    height: 3,
                    background: 'color-mix(in oklch, var(--foam) 8%, transparent)',
                    borderRadius: 2,
                    marginTop: 8,
                    overflow: 'hidden',
                    position: 'relative',
                  }}>
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'var(--lumen)',
                      boxShadow: '0 0 6px var(--lumen-core)',
                      transform: `scaleX(${progressPct})`, transformOrigin: 'left',
                      transition: 'transform 400ms var(--ease-glide)',
                    }}/>
                  </div>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--shoal)',
                    letterSpacing: '0.04em', marginTop: 8,
                  }}>
                    <span>0m</span>
                    <span>goal · {goalMins}m</span>
                    <span>60m</span>
                  </div>
                </div>

                <div className="controls">
                  <button className="play-btn" onClick={() => setPlaying(!playing)}>
                    <Icon name={playing ? 'pause' : 'play'} size={28}/>
                  </button>
                  <div className="small">
                    <button className="icon-btn"><Icon name="rewind" size={12}/></button>
                    <button className="icon-btn"><Icon name="mic" size={12}/></button>
                    <button className="icon-btn"><Icon name="forward" size={12}/></button>
                  </div>
                </div>
              </div>

              {/* Metronome */}
              <div className="metro">
                <div className="tempo-ctl">
                  <button onClick={() => setBpm(b => Math.max(20, b - 4))}>−</button>
                </div>
                <div className="pips">
                  {Array.from({ length: meter }).map((_, i) => (
                    <span key={i}
                      className={`pip ${i === beat && playing ? (i===0 ? 'downbeat active' : 'active') : ''}`}/>
                  ))}
                </div>
                <div className="bpm">
                  {bpm}<span className="unit">bpm</span>
                </div>
                <div className="tempo-ctl">
                  <button onClick={() => setBpm(b => Math.min(220, b + 4))}>+</button>
                </div>
              </div>

              {/* Mini score for context */}
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 18 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                  fontFamily: 'var(--font-sans)', fontSize: 10, letterSpacing: '0.22em',
                  textTransform: 'uppercase', color: 'var(--shoal)',
                  marginBottom: 10,
                }}>
                  <span>— score · pinned to focus</span>
                  <span onClick={() => onOpenPiece(piece.id)} style={{ cursor: 'pointer', color: 'var(--mist)' }}>open full score →</span>
                </div>
                <Score piece={piece} heatMode={true} highlightMeasure={parseInt(focusSection.range.match(/\d+/)?.[0]) || null}/>
              </div>
            </div>

            <div className="session-rail">
              {/* Progress ring */}
              <div className="session-prog">
                <div className="eyebrow">— session progress</div>
                <div className="ring-wrap" style={{ height: 180 }}>
                  <svg viewBox="0 0 180 180" width="180" height="180">
                    <circle cx="90" cy="90" r="78" fill="none"
                            stroke="color-mix(in oklch, var(--foam) 6%, transparent)" strokeWidth="6"/>
                    <circle cx="90" cy="90" r="78" fill="none"
                            stroke="var(--lumen)" strokeWidth="6"
                            strokeDasharray={`${progressPct * 2 * Math.PI * 78} ${2*Math.PI*78}`}
                            strokeLinecap="round"
                            transform="rotate(-90 90 90)"
                            style={{ filter: 'drop-shadow(0 0 6px var(--lumen-core))' }}/>
                  </svg>
                  <div className="center">
                    <div className="n">{Math.round(progressPct*100)}%</div>
                    <div className="l">to goal</div>
                  </div>
                </div>
                <div className="sub-row"><span>elapsed</span><span className="v">{mm}m {ss}s</span></div>
                <div className="sub-row"><span>remaining</span><span className="v">{Math.max(0, goalMins - mm)}m</span></div>
                <div className="sub-row"><span>tempo trend</span><span className="v" style={{ color: 'var(--lumen)' }}>+4 bpm</span></div>
              </div>

              {/* Loop / sections */}
              <div className="loop-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                  <span className="eyebrow">— loop</span>
                  <button className="btn btn-quiet" style={{ fontSize: 10, padding: '4px 8px' }}>
                    <Icon name="loop" size={11}/> set
                  </button>
                </div>
                {piece.sections.map((s, i) => (
                  <div key={s.id} className={`loop-row ${loopIdx === i ? 'active' : ''}`}>
                    <div>
                      <div className="name">{s.label}</div>
                      <div className="meas">{s.range} · {s.tempo}</div>
                    </div>
                    <button className="pick" onClick={() => setLoopIdx(i)}>
                      {loopIdx === i ? 'looping' : 'focus'}
                    </button>
                  </div>
                ))}
              </div>

              {/* Quick notes */}
              <div className="quick-notes">
                <div className="eyebrow">— quick notes</div>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="What did you notice? Where did it click? Where did it resist?"
                />
                <div className="saved"><span className="pulse"/> auto-saved · 8s ago</div>
              </div>

              {/* End-of-session log */}
              <div className="loop-card">
                <div className="eyebrow">— log this session as…</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  {['Deep work', 'Slow drill', 'Run-through', 'Sight-read', 'Memorize', 'Recording'].map(t => (
                    <span key={t} className="chip" style={{
                      cursor: 'pointer',
                      borderColor: t === 'Slow drill' ? 'var(--lumen)' : undefined,
                      color: t === 'Slow drill' ? 'var(--lumen)' : undefined,
                    }}>{t}</span>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { SessionView });
