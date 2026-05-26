// src/sketchbook.jsx — composition / writing side

const SketchbookView = () => {
  const { SKETCHES } = SOUND_DATA;
  const [activeId, setActiveId] = React.useState(SKETCHES[0].id);
  const [tab, setTab] = React.useState('lyric');
  const active = SKETCHES.find(s => s.id === activeId);

  const sideIdeas = [
    { when: 'tue · 23:14', what: 'A countermelody for the *Litany* chorus — sing the bass line up an octave, like an answering voice.', tags: ['litany', 'arrangement'] },
    { when: 'sat · 07:02', what: 'Title idea: <em>the great sea-shell</em>. Maybe a piano nocturne.', tags: ['title'] },
    { when: 'thu · 18:40', what: 'Form sketch: ABA with a *void* in the middle — 8 bars of held silence, then return.', tags: ['form', 'experiment'] },
    { when: 'wed · 06:55', what: 'The chord <em>F♯m add9 over E</em> — could be the bridge for *Blue Light*.', tags: ['blue-light'] },
    { when: 'mon · 22:11', what: 'Try setting the Mary Oliver poem fragment — *the world offers itself.*', tags: ['lyric'] },
  ];

  return (
    <div>
      <Topbar crumbs={['Soundings', 'Sketchbook']} />

      <div className="page-hero">
        <div>
          <div className="eyebrow"><span className="rule"/> Composition · 3 pieces in motion</div>
          <h1>The <em>sketchbook</em>.</h1>
          <div className="lede">
            Lyrics, fragments, harmonic ideas, structural sketches. A song
            sits at the same table as a piece you're learning — both are
            being slowly worked.
          </div>
        </div>
        <div className="meta-col">
          <div>Pieces drafting <span className="v">3</span></div>
          <div>Words this month <span className="v">2,418</span></div>
          <div>Ideas captured <span className="v">37</span></div>
          <div>Last sketch <span className="v">today · 19:02</span></div>
        </div>
      </div>

      <div className="sketch-grid">
        {/* LEFT: sketch list */}
        <div className="sketch-list">
          <div className="head">
            <span className="l">— in progress</span>
            <span className="c">{SKETCHES.length}</span>
          </div>
          {SKETCHES.map(s => (
            <div key={s.id} className={`sketch-item ${activeId === s.id ? 'active' : ''}`}
                 onClick={() => setActiveId(s.id)}>
              <div className="t">
                {s.title}
                {s.subtitle && <em>{s.subtitle}</em>}
              </div>
              <div className="meta">
                <span>{s.status}</span>
                <span>·</span>
                <span>{s.duration || '?'}</span>
                <span>·</span>
                <span>{s.keyArea}</span>
              </div>
            </div>
          ))}

          <div className="head" style={{ marginTop: 28 }}>
            <span className="l">— archived</span>
            <span className="c">04</span>
          </div>
          {[
            { t: 'Vellichor (study)', s: 'piano · march' },
            { t: 'Threnody for the Last Vaquita', s: 'voice + strings' },
            { t: 'Song without a name', s: 'unfinished' },
            { t: 'Étude in C♯', s: 'shelved' },
          ].map((s,i) => (
            <div key={i} className="sketch-item" style={{ opacity: 0.6 }}>
              <div className="t" style={{ fontSize: 16 }}>{s.t}</div>
              <div className="meta"><span>{s.s}</span></div>
            </div>
          ))}
        </div>

        {/* CENTER: active sketch */}
        <div className="sketch-detail">
          <div className="top">
            <div>
              <div className="eyebrow">— {active.status} · {active.tags.join(' · ')}</div>
              <h2>
                {active.title}
                {active.subtitle && <em>{active.subtitle}</em>}
              </h2>
            </div>
            <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--shoal)', letterSpacing: '0.04em' }}>
              <div>started · <span style={{ color: 'var(--foam)' }}>{active.started}</span></div>
              <div>last edit · <span style={{ color: 'var(--foam)' }}>{active.lastTouched}</span></div>
              <div>key · <span style={{ color: 'var(--foam)' }}>{active.keyArea}</span></div>
              <div>meter · <span style={{ color: 'var(--foam)' }}>{active.meter}</span></div>
            </div>
          </div>

          <div className="tabs">
            <button className={tab==='lyric' ? 'active' : ''} onClick={()=>setTab('lyric')}>Lyric · structure</button>
            <button className={tab==='harmony' ? 'active' : ''} onClick={()=>setTab('harmony')}>Harmony</button>
            <button className={tab==='plan' ? 'active' : ''} onClick={()=>setTab('plan')}>Plan</button>
            <button className={tab==='audio' ? 'active' : ''} onClick={()=>setTab('audio')}>Voice memos</button>
          </div>

          {tab === 'lyric' && (
            <div className="lyric-block">
              {active.lyric.split('\n').map((line, i) => {
                const isMarker = line.match(/^\[(.+?)\]/);
                if (isMarker) {
                  return <span key={i} className="marker">{isMarker[1]}</span>;
                }
                // hl annotations in { }
                if (line.match(/^\{/)) {
                  return <span key={i} className="annot">{line}</span>;
                }
                return <span key={i}>{line || ' '}{'\n'}</span>;
              })}
            </div>
          )}

          {tab === 'harmony' && (
            <div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--lumen)', marginBottom: 18 }}>— chord sketch · chorus</div>
              <div style={{ display: 'flex', gap: 24, padding: '20px 0 32px', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
                {[
                  { c: 'F♯m', l: 'i' },
                  { c: 'D maj9', l: 'VI' },
                  { c: 'C♯m7', l: 'v' },
                  { c: 'B add4', l: 'iv' },
                  { c: 'F♯m / A', l: 'i⁶' },
                ].map((ch, i) => (
                  <div key={i} style={{ textAlign: 'center', minWidth: 80 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, color: 'var(--foam)', fontStyle: 'italic', fontWeight: 300, letterSpacing: '-0.02em' }}>{ch.c}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--lumen)', letterSpacing: '0.06em', marginTop: 6 }}>{ch.l}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 24, fontFamily: 'var(--font-body)', fontSize: 16, lineHeight: 1.6, color: 'var(--mist)', maxWidth: '52ch' }}>
                The chorus moves <span className="lumen">i — VI — v — iv — i⁶</span>.
                The drop to iv (B add4) before returning to the tonic is the line
                "<em style={{ color: 'var(--foam)', fontFamily: 'var(--font-display)' }}>litany of slow</em>" — let the harmony
                <span className="lumen"> sag</span> there, like the weight of the carcass
                reaching the bottom.
              </div>
            </div>
          )}

          {tab === 'plan' && (
            <div className="plan-card" style={{ border: 'none', padding: 0 }}>
              <div className="eyebrow">— next moves</div>
              <h3 style={{ marginBottom: 22 }}>How we'll finish this</h3>
              {active.plan.map((step, i) => (
                <div key={i} className={`step ${step.done ? 'done' : ''}`}>
                  <span className="n">{step.done ? '✓' : String(i+1).padStart(2,'0')}</span>
                  <span>{step.text}</span>
                </div>
              ))}
            </div>
          )}

          {tab === 'audio' && (
            <div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--shoal)', marginBottom: 18 }}>— voice memos · 8 takes</div>
              {[
                { d: 'today · 19:02', l: 'humming the bridge — F♯m to A', m: '0:34', best: true },
                { d: 'mon · 22:18',  l: 'verse 1 / piano only',              m: '1:22' },
                { d: 'sun · 08:11',  l: 'chorus alt. melody (rejected)',     m: '0:48' },
                { d: 'sat · 15:32',  l: 'first sketch · the whole shape',    m: '3:04' },
              ].map((r, i) => (
                <div key={i} style={{
                  display: 'grid',
                  gridTemplateColumns: '36px 130px 1fr 80px 28px',
                  alignItems: 'center', gap: 16,
                  padding: '14px 0', borderBottom: '1px solid var(--line)',
                  cursor: 'pointer',
                }}>
                  <button className="icon-btn"><Icon name="play" size={11}/></button>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--shoal)', letterSpacing: '0.04em' }}>{r.d}</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--foam)', fontStyle: 'italic', fontWeight: 300 }}>
                    {r.l}
                    {r.best && <span className="chip lumen" style={{ marginLeft: 14 }}>keeper</span>}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--mist)', textAlign: 'right' }}>{r.m}</span>
                  <span style={{ color: 'var(--shoal)' }}><Icon name="more" size={14}/></span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: idea capture rail */}
        <div className="idea-rail">
          <div className="head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid var(--line)', paddingBottom: 12 }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--shoal)' }}>— scratch ideas</span>
            <button className="btn btn-quiet" style={{ fontSize: 10, padding: '4px 8px' }}>+ capture</button>
          </div>

          <textarea
            placeholder="Catch the thought before it sounds away…"
            style={{
              width: '100%', minHeight: 90,
              background: 'var(--abyss-soft)',
              border: '1px solid var(--line)',
              borderRadius: 4,
              color: 'var(--foam)',
              fontFamily: 'var(--font-body)',
              fontStyle: 'italic',
              fontSize: 15,
              padding: 14,
              resize: 'vertical',
              lineHeight: 1.5,
            }}
            defaultValue=""
          />

          {sideIdeas.map((idea, i) => (
            <div key={i} className="idea-card">
              <div className="when">{idea.when}</div>
              <div className="what" dangerouslySetInnerHTML={{ __html: idea.what }}/>
              <div className="tags">
                {idea.tags.map((t,j) => <span key={j} className="t">{t}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { SketchbookView });
