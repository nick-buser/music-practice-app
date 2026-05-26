// src/mobile-screens.jsx
// Five mobile screens for the Soundings practice journal.

const M = window.SOUND_DATA;

/* ─── Tiny icons ──────────────────────────────────── */
const MIcon = ({ name, size = 18, color = 'currentColor' }) => {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
              stroke: color, strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'home':       return <svg {...p}><path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z"/></svg>;
    case 'book':       return <svg {...p}><path d="M4 4h8a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M20 4h-8a4 4 0 0 0-4 4v12h8a4 4 0 0 0 4-4z"/></svg>;
    case 'mic':        return <svg {...p}><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/></svg>;
    case 'chart':      return <svg {...p}><path d="M3 21h18"/><rect x="6" y="13" width="3" height="6"/><rect x="11" y="9" width="3" height="10"/><rect x="16" y="5" width="3" height="14"/></svg>;
    case 'pen':        return <svg {...p}><path d="M3 21l3.5-1L18 8.5 15.5 6 4 17.5z"/><path d="M14 7l3 3"/></svg>;
    case 'metronome':  return <svg {...p}><path d="M8 21h8M7 21L11 3h2l4 18M9 14h6"/><path d="M12 14l4-9"/></svg>;
    case 'play':       return <svg {...p}><path d="M8 5v14l11-7z" fill={color} stroke="none"/></svg>;
    case 'pause':      return <svg {...p}><rect x="7" y="5" width="3" height="14"/><rect x="14" y="5" width="3" height="14"/></svg>;
    case 'arrow':      return <svg {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case 'check':      return <svg {...p}><path d="M5 12l5 5 9-12"/></svg>;
    case 'plus':       return <svg {...p}><path d="M12 5v14M5 12h14"/></svg>;
    case 'back':       return <svg {...p}><path d="M19 12H5M11 18l-6-6 6-6"/></svg>;
    case 'rewind':     return <svg {...p}><path d="M11 5l-7 7 7 7M20 5l-7 7 7 7"/></svg>;
    case 'forward':    return <svg {...p}><path d="M13 5l7 7-7 7M4 5l7 7-7 7"/></svg>;
    case 'loop':       return <svg {...p}><path d="M4 7h13l-3-3M20 17H7l3 3"/></svg>;
    case 'close':      return <svg {...p}><path d="M6 6l12 12M18 6L6 18"/></svg>;
    case 'lock':       return <svg {...p}><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>;
    default: return null;
  }
};

/* ─── Shared tab bar ──────────────────────────────── */
const MTabs = ({ active = 'today' }) => {
  const tabs = [
    { id: 'today',   ic: 'home',  l: 'Today' },
    { id: 'library', ic: 'book',  l: 'Library' },
    { id: 'capture', ic: 'mic',   l: 'Capture', center: true },
    { id: 'stats',   ic: 'chart', l: 'Stats' },
    { id: 'notes',   ic: 'pen',   l: 'Notes' },
  ];
  return (
    <nav className="m-tabs" aria-label="primary">
      {tabs.map(t => (
        <button key={t.id} className={`tab ${t.center ? 'center' : ''} ${active === t.id ? 'active' : ''}`}>
          <span className="glyph"><MIcon name={t.ic} size={t.center ? 22 : 18}/></span>
          {!t.center && <span>{t.l}</span>}
        </button>
      ))}
    </nav>
  );
};

/* ─── Shared top bar (date + brand mark, very quiet) ── */
const MTopbar = ({ right }) => (
  <div className="m-topbar">
    <div className="brand"><img src="assets/mark.svg" alt="Soundings"/></div>
    <div className="right">
      {right || <span className="date">19 may · 24.5°N 158.2°W</span>}
    </div>
  </div>
);

/* ─────────────────────────────────────────────────── */
/* SCREEN 1 — Today / home                             */
/* ─────────────────────────────────────────────────── */
const STodayScreen = () => {
  const todayMins = M.WEEK[6].piano + M.WEEK[6].guitar + M.WEEK[6].compose;
  return (
    <div className="m-screen mobile-root">
      <MTopbar/>
      <div className="m-body">
        <div className="m-eyebrow lumen"><span className="rule"/> Tuesday · 19 May 2026</div>
        <h1 className="m-h1">Today<em>three pieces, one sketch</em></h1>

        <div className="m-streak">
          <div className="col">
            <div className="n lumen">28<span className="unit">d</span></div>
            <div className="lbl">— sounding streak</div>
          </div>
          <div className="divider"/>
          <div className="col r">
            <div className="n">{todayMins}<span className="unit">m</span></div>
            <div className="lbl">— today so far</div>
          </div>
        </div>

        <div className="m-sect">
          <span className="l">— queue · today</span>
          <span className="r"><b>90</b> min planned</span>
        </div>

        <div className="m-queue">
          {M.TODAY_QUEUE.map((q, i) => (
            <div key={q.id} className={`m-q ${i === 0 ? 'active' : ''}`}>
              <span className="play"><MIcon name="play" size={16}/></span>
              <div className="what">
                <div className="t">{q.label}</div>
                <div className="s">{q.sub}</div>
              </div>
              <div className="mins"><b>{q.mins}</b>m</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 22 }}>
          <button className="m-cta">
            <span className="l">
              <span className="lbl">— begin</span>
              <span className="t">Chopin · Nocturne E♭</span>
            </span>
            <span className="arrow"><MIcon name="arrow" size={18}/></span>
          </button>
        </div>

        <div className="m-sect">
          <span className="l">— recent</span>
          <span className="r"><b>2</b> sessions today</span>
        </div>
        <div className="m-recent">
          {M.RECENT.slice(0, 4).map((r, i) => (
            <div key={i} className="row">
              <div className="when">{r.when.replace(' · ', '\n')}</div>
              <div className="what">{r.what}<span className="sub">— {r.sub}</span></div>
              <div className="min">{r.mins}m</div>
            </div>
          ))}
        </div>

        <blockquote style={{
          margin: '28px 0 0', padding: '12px 0 12px 18px',
          borderLeft: '1px solid var(--lumen)',
          fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 300,
          fontSize: 16, lineHeight: 1.4, color: 'var(--mist)',
          textWrap: 'balance',
        }}>
          Slow practice is a kind of listening. You sound the depth.
          <cite style={{
            display: 'block', marginTop: 8,
            fontFamily: 'var(--font-sans)', fontSize: 9, letterSpacing: '0.22em',
            textTransform: 'uppercase', fontStyle: 'normal', color: 'var(--shoal)',
          }}>— field notes, 2026</cite>
        </blockquote>
      </div>
      <MTabs active="today"/>
    </div>
  );
};

/* ─────────────────────────────────────────────────── */
/* SCREEN 2 — Active session                           */
/* ─────────────────────────────────────────────────── */
const SSessionScreen = () => {
  const piece = M.PIECES[0]; // Chopin
  const elapsed = 1227; // 20:27
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  const goal = 35;
  const progress = elapsed / (goal * 60);
  const focus = piece.sections[2]; // figuration variation
  const bpm = 48;
  const meter = 4;
  const beat = 1;

  return (
    <div className="m-screen mobile-root m-session">
      <div className="bio" aria-hidden="true">
        <img src="assets/bioluminescence.svg" alt=""/>
      </div>
      <div className="m-topbar">
        <button style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'color-mix(in oklch, var(--abyss-ink) 70%, transparent)',
          border: '1px solid var(--line)', color: 'var(--mist)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(8px)',
        }}>
          <MIcon name="back" size={14}/>
        </button>
        <div className="right">
          <span className="m-pill lumen"><span className="dot"/> Recording</span>
        </div>
      </div>

      <div className="m-body immersive layer">
        <div className="m-eyebrow lumen" style={{ marginTop: 4 }}>
          <span className="rule"/> Now sounding · session 48 · started 18:33
        </div>
        <h2 className="m-h2 m-now-piece">
          {piece.title}<em>{piece.composer} · {piece.subtitle}</em>
        </h2>

        <div className="m-clock-wrap">
          <div className="m-clock">{mm}<span className="sep">:</span>{ss}</div>
          <div className="m-clock-sub">
            elapsed · goal <b>{goal}m</b> · <span style={{ color: 'var(--lumen)' }}>+4 bpm trend</span>
          </div>
          <div className="m-progress">
            <div className="fill" style={{ transform: `scaleX(${progress})` }}/>
            <div className="marker" style={{ left: '50%' }}/>
          </div>
        </div>

        <div className="m-focus">
          <div className="e">— focus loop · <b>{focus.range}</b></div>
          <div className="t">{focus.label}</div>
          <div className="sub">{focus.subtitle}</div>
        </div>

        <div className="m-transport">
          <div className="side l">
            <button className="small-btn"><MIcon name="rewind" size={14}/></button>
            <button className="small-btn"><MIcon name="loop" size={14}/></button>
          </div>
          <button className="play-btn"><MIcon name="pause" size={28}/></button>
          <div className="side r">
            <button className="small-btn"><MIcon name="mic" size={14}/></button>
            <button className="small-btn"><MIcon name="forward" size={14}/></button>
          </div>
        </div>

        <div className="m-metro">
          <button>−</button>
          <div className="mid">
            <div className="pips">
              {Array.from({ length: meter }).map((_, i) => (
                <span key={i} className={`pip ${i === beat ? (i === 0 ? 'downbeat active' : 'active') : ''}`}/>
              ))}
            </div>
            <div className="bpm">{bpm}<span className="unit">bpm</span></div>
          </div>
          <button>+</button>
        </div>

        <div className="m-sect" style={{ marginTop: 22 }}>
          <span className="l">— loop · tap to swap</span>
          <span className="r">5 sections</span>
        </div>
        <div className="m-loops">
          {piece.sections.slice(0, 4).map((s, i) => (
            <div key={s.id} className={`row ${i === 2 ? 'active' : ''}`}>
              <div>
                <div className="n">{s.label}</div>
                <div className="meas">{s.range} · {s.tempo}</div>
              </div>
              <div className="act">{i === 2 ? 'looping' : 'focus'}</div>
            </div>
          ))}
        </div>
      </div>

      <button className="m-cta m-end ghost">
        <span className="l">
          <span className="lbl">— end session</span>
          <span className="t">Log & save · {Math.floor(elapsed / 60)}m</span>
        </span>
        <span className="arrow"><MIcon name="check" size={18}/></span>
      </button>
    </div>
  );
};

/* ─────────────────────────────────────────────────── */
/* SCREEN 3 — Log sheet (post-session)                 */
/* ─────────────────────────────────────────────────── */
const SLogScreen = () => {
  const piece = M.PIECES[0];
  const types = ['Deep work', 'Slow drill', 'Run-through', 'Sight-read', 'Memorize', 'Recording'];
  const moods = [
    { v: 1, l: 'tense' },
    { v: 2, l: 'foggy' },
    { v: 3, l: 'ok' },
    { v: 4, l: 'flowed' },
    { v: 5, l: 'lit' },
  ];

  return (
    <div className="m-screen mobile-root">
      {/* dimmed peek of session below */}
      <div className="m-sheet-bg">
        <div style={{ position: 'absolute', top: 80, left: 18, right: 18, opacity: 0.18 }}>
          <div className="m-eyebrow lumen" style={{ marginBottom: 10 }}><span className="rule"/> Now sounding</div>
          <h2 className="m-h2">{piece.title}<em>{piece.composer}</em></h2>
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 300,
            fontSize: 96, color: 'var(--lumen-bright)', textAlign: 'center', marginTop: 32,
            textShadow: '0 0 18px var(--lumen-core)',
          }}>20:27</div>
        </div>
      </div>

      <div className="m-sheet">
        <div className="grab"/>
        <div className="m-eyebrow lumen"><span className="rule"/> Log this session</div>
        <h2 className="m-h2" style={{ marginTop: 8 }}>How did it go?</h2>

        <div className="m-piece-lock" style={{ marginTop: 18 }}>
          <div>
            <div className="t">{piece.title}</div>
            <div className="s">{piece.composer} · figuration variation · mm. 17–24</div>
          </div>
          <span className="swap" style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
            <MIcon name="lock" size={12}/> swap
          </span>
        </div>

        <div className="m-field">
          <div className="lbl">— duration <span className="hint">tap to nudge</span></div>
          <div className="m-duration">
            <button>−</button>
            <div className="v">20<span className="unit">m 27s</span></div>
            <button>+</button>
          </div>
        </div>

        <div className="m-field">
          <div className="lbl">— what was this <span className="hint">pick all that apply</span></div>
          <div className="m-chips">
            {types.map(t => (
              <span key={t} className={`chip ${t === 'Slow drill' || t === 'Memorize' ? 'on' : ''}`}>{t}</span>
            ))}
          </div>
        </div>

        <div className="m-field">
          <div className="lbl">— energy <span className="hint">flowed</span></div>
          <div className="m-mood">
            {moods.map(m => (
              <div key={m.v} className={`pip ${m.v === 4 ? 'on' : ''}`}>
                <span className="dot"/>{m.v}
              </div>
            ))}
          </div>
        </div>

        <div className="m-field">
          <div className="lbl">— quick note <span className="hint">what to remember</span></div>
          <textarea
            className="m-textarea"
            defaultValue={'Bar 19 LH leap is still tense — try anchoring the elbow.\nThe turn on bar 22 finally locked in around the 18th rep.'}
          />
        </div>

        <button className="m-save">Save to journal · sounding depth +1</button>
        <button className="m-cancel">discard</button>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────── */
/* SCREEN 4 — Piece quick view (read-only)             */
/* ─────────────────────────────────────────────────── */
const SPieceScreen = () => {
  const piece = M.PIECES[0]; // Chopin
  return (
    <div className="m-screen mobile-root">
      <div className="m-topbar">
        <button style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'transparent', border: '1px solid var(--line)', color: 'var(--mist)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <MIcon name="back" size={14}/>
        </button>
        <div className="right">
          <span className="m-pill"><span className="dot" style={{ background: 'var(--krill)', boxShadow: 'none' }}/> Bathyal</span>
          <span className="date" style={{ marginLeft: 8 }}>last · 19 may</span>
        </div>
      </div>

      <div className="m-body">
        <div className="m-piece-head">
          <div className="m-eyebrow lumen"><span className="rule"/> Piano · <em style={{ fontStyle: 'italic', color: 'var(--mist)' }}>Pianoforte</em></div>
          <h1 className="m-h1" style={{ marginTop: 10 }}>
            Nocturne in E♭<em>op. 9 no. 2 · 1832</em>
          </h1>
          <div className="composer">Frédéric Chopin</div>

          <div className="m-coord-row">
            <div>key <span className="v">E♭ major</span></div>
            <div>meter <span className="v">12/8</span></div>
            <div>tempo <span className="v">♩ = 60</span></div>
            <div>length <span className="v">4:32 · 34 bars</span></div>
          </div>
        </div>

        <div className="m-progress-big">
          <div className="pct">62%</div>
          <div className="bar"><div className="fill" style={{ transform: 'scaleX(0.62)' }}/></div>
          <div className="depth">— bathyal<br/><b>1840m</b> total</div>
        </div>

        <div style={{ display: 'flex', gap: 14, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--shoal)', letterSpacing: '0.04em', padding: '10px 0', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
          <div style={{ flex: 1 }}>started <b style={{ color: 'var(--foam)', fontWeight: 400, display: 'block', marginTop: 2 }}>14 feb</b></div>
          <div style={{ flex: 1 }}>sessions <b style={{ color: 'var(--foam)', fontWeight: 400, display: 'block', marginTop: 2 }}>47</b></div>
          <div style={{ flex: 1 }}>streak <b style={{ color: 'var(--lumen)', fontWeight: 400, display: 'block', marginTop: 2, textShadow: 'var(--glow-text)' }}>12 d</b></div>
        </div>

        <div className="m-sect">
          <span className="l">— plan · this week</span>
          <span className="r"><b>2</b> of 5 done</span>
        </div>
        <div className="m-plan">
          {piece.plan.map((step, i) => (
            <div key={i} className={`step ${step.done ? 'done' : ''} ${step.active ? 'active' : ''}`}>
              <span className="check">{step.done && <MIcon name="check" size={10}/>}</span>
              <span>{step.text}</span>
            </div>
          ))}
        </div>

        <div className="m-sect">
          <span className="l">— last note</span>
          <span className="r">19 may</span>
        </div>
        <div className="m-note">
          <div className="when">19 may · last session</div>
          <div className="body">
            Bar 21 LH leap — keep the elbow loose. Felt the connection finally when
            I stopped <em>aiming</em> at the bottom note.
          </div>
        </div>
        <div className="m-note">
          <div className="when">17 may</div>
          <div className="body">
            Right-hand thirds in bar 14 are settling. Pedal change is now on beat 4 of the previous bar — much cleaner.
          </div>
        </div>

        <div style={{ height: 90 }}/>
      </div>

      <button className="m-cta m-footer">
        <span className="l">
          <span className="lbl">— begin · 35m</span>
          <span className="t">Sound the figuration</span>
        </span>
        <span className="arrow"><MIcon name="play" size={16}/></span>
      </button>
    </div>
  );
};

/* ─────────────────────────────────────────────────── */
/* SCREEN 5 — Capture (voice / lyric)                  */
/* ─────────────────────────────────────────────────── */
const SCaptureScreen = () => {
  // pseudorandom but stable waveform heights
  const wf = (seed) => Array.from({ length: 22 }).map((_, i) => {
    const x = Math.sin((i + seed) * 1.3) * 0.5 + Math.sin((i + seed) * 0.5) * 0.5;
    return 6 + Math.abs(x) * 22;
  });
  const captures = [
    { ts: '19 may · 06:14', t: 'Litany — bridge in 5/8', dur: '0:48', tied: 'Litany for a Falling Whale', seed: 3 },
    { ts: '18 may · 22:31', t: 'Voice memo · the falling line',  dur: '1:22', tied: 'Blue Light, Blue Light', seed: 7 },
    { ts: '17 may · 11:08', t: '~ chord change for verse 2',     dur: '0:32', tied: 'Litany for a Falling Whale', seed: 11 },
    { ts: '15 may · 19:50', t: 'Hummed melody — possibly D♭',    dur: '0:19', tied: '— unfiled',                  seed: 15 },
  ];

  return (
    <div className="m-screen mobile-root">
      <MTopbar right={<span className="m-pill lumen"><span className="dot"/> 24 captures</span>}/>
      <div className="m-body">
        <div className="m-eyebrow lumen"><span className="rule"/> Capture · fast</div>
        <h1 className="m-h1">Catch the line<em>before it sounds away</em></h1>

        <div className="m-record-wrap">
          <div className="sonar"/>
          <div className="sonar s2"/>
          <div className="sonar s3"/>
          <button className="rec" aria-label="Record">
            <div className="inner"/>
          </button>
          <div className="ts">tap to begin</div>
        </div>

        <div className="m-capture-shortcuts">
          <div className="b">
            <span className="e">— shortcut</span>
            <span className="t">+ lyric</span>
          </div>
          <div className="b">
            <span className="e">— shortcut</span>
            <span className="t">+ chord idea</span>
          </div>
        </div>

        <div className="m-sect">
          <span className="l">— recent captures</span>
          <span className="r"><b>4</b> this week</span>
        </div>

        <div className="m-captures">
          {captures.map((c, i) => {
            const bars = wf(c.seed);
            return (
              <div key={i} className="row">
                <div className="wf">
                  {bars.slice(0, 14).map((h, j) => (
                    <span key={j} style={{ height: h + 'px', opacity: 0.4 + (h / 28) * 0.6 }}/>
                  ))}
                </div>
                <div className="what">
                  <div className="t">{c.t}</div>
                  <div className="s">{c.ts} · → {c.tied}</div>
                </div>
                <div className="dur">{c.dur}</div>
              </div>
            );
          })}
        </div>
      </div>
      <MTabs active="capture"/>
    </div>
  );
};

Object.assign(window, {
  MIcon, MTabs, MTopbar,
  STodayScreen, SSessionScreen, SLogScreen, SPieceScreen, SCaptureScreen,
});
