// src/piece.jsx — Piece detail · score-first, with presentation modes,
// measure-range selection, section pins, page navigator.

const TOTAL_SYSTEMS_FOR = (piece) => {
  const grand = piece.instrument === 'piano' || piece.instrument === 'compose';
  const per = grand ? 4 : 5;
  return Math.min(8, Math.ceil((piece.measures || 32) / per));
};

const PieceView = ({ pieceId, onBack, onStartSession }) => {
  const piece = SOUND_DATA.PIECES.find(p => p.id === pieceId);
  const [presentMode, setPresentMode] = React.useState('plate');  // 'plate' | 'paper' | 'image'
  const [showBrackets, setShowBrackets] = React.useState(true);
  const [showHeat, setShowHeat] = React.useState(true);

  // measure selection (shift-click to extend)
  const [selection, setSelection] = React.useState(null); // [m1, m2]
  const [pinnedSectionId, setPinnedSectionId] = React.useState(
    piece?.sections.find(s => s.active)?.id ?? piece?.sections[0]?.id
  );

  // page navigator — which systems are visible (windowed view)
  const totalSystems = piece ? TOTAL_SYSTEMS_FOR(piece) : 0;
  const [visibleRange, setVisibleRange] = React.useState([0, Math.min(2, totalSystems - 1)]);

  // focused reading overlay
  const [focused, setFocused] = React.useState(false);

  if (!piece) return <div>Piece not found.</div>;

  const ins = SOUND_DATA.INSTRUMENTS.find(i => i.id === piece.instrument);
  const maxHistMins = Math.max(...piece.history.map(h => h.mins), 60);
  const measuresPerSystem = (piece.instrument === 'piano' || piece.instrument === 'compose') ? 4 : 5;

  const onMeasureClick = (m, e) => {
    if (e?.shiftKey && selection) {
      const lo = Math.min(selection[0], m);
      const hi = Math.max(selection[1], m);
      setSelection([lo, hi]);
    } else if (selection && selection[0] === m && selection[1] === m) {
      setSelection(null);
    } else {
      setSelection([m, m]);
    }
  };

  const clearSelection = () => setSelection(null);

  const jumpToSystem = (i) => {
    const span = visibleRange[1] - visibleRange[0];
    const lo = Math.max(0, Math.min(i, totalSystems - 1 - span));
    setVisibleRange([lo, lo + span]);
  };

  const pinnedSection = piece.sections.find(s => s.id === pinnedSectionId);

  return (
    <div>
      <Topbar crumbs={['Library', ins?.name || '', piece.title]} right={
        <button className="btn btn-quiet" onClick={onBack}>← back</button>
      }/>

      <PieceHeader piece={piece} ins={ins} onStartSession={onStartSession}/>

      <div className="piece-layout">
        {/* LEFT column ====================================== */}
        <div>
          {/* The score frame */}
          <div className={`score-frame ${presentMode === 'paper' ? 'paper' : ''}`}>
            <div className="score-tools">
              <div className="mode-tabs">
                <button className={`tab ${presentMode==='plate' ? 'active' : ''}`} onClick={()=>setPresentMode('plate')}>
                  <span className="lbl">Plate</span>
                  <span className="sub">rendered staff · dark</span>
                </button>
                <button className={`tab ${presentMode==='paper' ? 'active' : ''}`} onClick={()=>setPresentMode('paper')}>
                  <span className="lbl">PDF</span>
                  <span className="sub">paper plate · print</span>
                </button>
                <button className={`tab ${presentMode==='image' ? 'active' : ''}`} onClick={()=>setPresentMode('image')}>
                  <span className="lbl">Image</span>
                  <span className="sub">PNG · share</span>
                </button>
              </div>

              <div className="annot-toggles">
                <ToggleChip on={showBrackets} onClick={() => setShowBrackets(!showBrackets)}>Brackets</ToggleChip>
                <ToggleChip on={showHeat} onClick={() => setShowHeat(!showHeat)}>Heat strip</ToggleChip>
                <button className="icon-btn" title="Focused view" onClick={() => setFocused(true)}>
                  <Icon name="arrow-up-right" size={14}/>
                </button>
              </div>
            </div>

            {/* The score itself ============================== */}
            <div className={`score-stage ${presentMode}`}>
              {presentMode === 'image' ? (
                <ImagePreviewFrame piece={piece}>
                  <Score
                    piece={piece}
                    mode="paper"
                    showBrackets={false}
                    showHeatStrip={false}
                    selection={null}
                    onMeasureClick={() => {}}
                    visibleSystems={[0, Math.min(1, totalSystems-1)]}
                  />
                </ImagePreviewFrame>
              ) : (
                <Score
                  piece={piece}
                  mode={presentMode}
                  showBrackets={showBrackets}
                  showHeatStrip={showHeat}
                  selection={selection}
                  onMeasureClick={onMeasureClick}
                  visibleSystems={visibleRange}
                />
              )}
            </div>

            {/* Selection toolbar */}
            {selection && presentMode !== 'image' && (
              <SelectionToolbar
                selection={selection}
                onClear={clearSelection}
                onLoop={() => onStartSession(piece.id)}
                onMarkSection={() => alert(`Would mark mm. ${selection[0]}–${selection[1]} as a new section`)}
              />
            )}

            <div className="score-foot">
              <HeatLegend/>
            </div>
          </div>

          {/* Page navigator ============================= */}
          {presentMode !== 'image' && (
            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center' }}>
              <ScoreMinimap
                piece={piece}
                totalSystems={totalSystems}
                currentRange={visibleRange}
                onJump={jumpToSystem}
              />
              <div className="window-ctl">
                <button className="icon-btn" onClick={() => jumpToSystem(visibleRange[0] - 1)} disabled={visibleRange[0] === 0}><Icon name="rewind" size={12}/></button>
                <span className="page-of">system <b>{visibleRange[0]+1}–{visibleRange[1]+1}</b> of <b>{totalSystems}</b></span>
                <button className="icon-btn" onClick={() => jumpToSystem(visibleRange[0] + 1)} disabled={visibleRange[1] >= totalSystems-1}><Icon name="forward" size={12}/></button>
                <select
                  className="window-size-select"
                  value={visibleRange[1] - visibleRange[0] + 1}
                  onChange={(e) => {
                    const span = parseInt(e.target.value);
                    const lo = visibleRange[0];
                    const hi = Math.min(totalSystems - 1, lo + span - 1);
                    setVisibleRange([Math.max(0, hi - span + 1), hi]);
                  }}>
                  <option value="1">1 system</option>
                  <option value="2">2 systems</option>
                  <option value="3">3 systems</option>
                  <option value="4">4 systems</option>
                </select>
              </div>
            </div>
          )}

          {/* Sections list ============================ */}
          <div style={{ marginTop: 36 }}>
            <div className="sect-head">
              <span className="eyebrow">— sections · pinned cues</span>
              <span className="title">Sounded depths</span>
              <span className="right">click a section to jump · ⇧+click measures to range-select</span>
            </div>
            <div className="cue-list">
              {piece.sections.map((s, i) => (
                <SectionRow key={s.id} s={s} idx={i}
                  active={pinnedSectionId === s.id}
                  onPick={() => {
                    setPinnedSectionId(s.id);
                    const m = s.range.match(/(\d+)\D+(\d+)/);
                    if (m) {
                      const startM = +m[1], endM = +m[2];
                      setSelection([startM, endM]);
                      // jump nav to the system containing this section
                      const sysIdx = Math.floor((startM - 1) / measuresPerSystem);
                      const span = visibleRange[1] - visibleRange[0];
                      const lo = Math.max(0, Math.min(sysIdx, totalSystems - 1 - span));
                      setVisibleRange([lo, lo + span]);
                    }
                  }} />
              ))}
              <button className="add-section">
                <Icon name="plus" size={12}/> Add a section
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT column ====================================== */}
        <div className="piece-rail">
          {pinnedSection && (
            <div className="pinned-section-card">
              <div className="eyebrow">— now pinned · {pinnedSection.range}</div>
              <div className="title">{pinnedSection.label}</div>
              <div className="sub">{pinnedSection.subtitle}</div>
              <div className="row-stats">
                <span>conf <b>{pinnedSection.conf}/5</b></span>
                <span>tempo <b>{pinnedSection.tempo}</b></span>
                <span>reps <b>{pinnedSection.reps}</b></span>
              </div>
              <div className="acts">
                <button className="btn btn-primary" onClick={() => onStartSession(piece.id)}>
                  <Icon name="loop" size={11}/> Loop this
                </button>
                <button className="btn btn-ghost"><Icon name="pin" size={12}/> Annotate</button>
              </div>
            </div>
          )}

          <div className="plan-card">
            <div className="eyebrow">— approach plan</div>
            <h3>How we're hunting this piece</h3>
            {piece.plan.map((step, i) => (
              <div key={i} className={`step ${step.done ? 'done' : ''}`}>
                <span className="n">{step.done ? '✓' : String(i+1).padStart(2,'0')}</span>
                <span>{step.text}</span>
              </div>
            ))}
            <div style={{ marginTop: 14 }}>
              <button className="btn btn-ghost" style={{ fontSize: 10, padding: '8px 12px' }}>
                <Icon name="plus" size={12}/> Add step
              </button>
            </div>
          </div>

          <div className="history-card">
            <div className="eyebrow">— recent practice on this piece</div>
            {piece.history.map((h, i) => (
              <div key={i} className="history-row">
                <span className="date">{h.date}</span>
                <span className="bar-wrap"><span className="fill" style={{ width: `${(h.mins/maxHistMins)*100}%` }}/></span>
                <span className="min">{h.mins}m</span>
              </div>
            ))}
            <div style={{ marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--shoal)', letterSpacing: '0.04em', display: 'flex', justifyContent: 'space-between' }}>
              <span>last 30 days</span>
              <span>{piece.sessions} sessions · avg {Math.round(piece.minutesTotal / piece.sessions)}m</span>
            </div>
          </div>

          <div className="notes-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
              <span className="eyebrow">— field notes</span>
              <button className="btn btn-quiet" style={{ fontSize: 10, padding: '4px 8px' }}>+ add</button>
            </div>
            {piece.notes.slice(0, 4).map((n, i) => (
              <div key={i} className="note-entry">
                <span className="when">{n.when}</span>
                <div className="body" dangerouslySetInnerHTML={{ __html: n.body.replace(/\*(.+?)\*/g, '<em>$1</em>') }}/>
              </div>
            ))}
          </div>
        </div>
      </div>

      {focused && (
        <FocusedReader piece={piece}
          onClose={() => setFocused(false)}
          showBrackets={showBrackets}
          showHeat={showHeat}
          selection={selection}
          onMeasureClick={onMeasureClick}/>
      )}
    </div>
  );
};

/* ─── Piece header (specimen-style) ─────────────────── */
const PieceHeader = ({ piece, ins, onStartSession }) => (
  <div className="specimen-head">
    <div>
      <div className="eyebrow">
        <span className="rule"/> {ins?.name.toUpperCase()} · {piece.depthLabel} · {piece.tags.join(' · ')}
      </div>
      <h1>
        {piece.title}
        {piece.subtitle && <em>{piece.subtitle}</em>}
      </h1>
      <div className="composer">{piece.composer} · {piece.year}</div>

      <div className="coord-row">
        <span>Key <span className="v">{piece.key}</span></span>
        <span>Meter <span className="v">{piece.meter}</span></span>
        <span>Tempo <span className="v">{piece.tempo.mark}, ♩={piece.tempo.bpm}</span></span>
        <span>Duration <span className="v">{piece.duration}</span></span>
        <span>Measures <span className="v">{piece.measures}</span></span>
      </div>

      <div className="header-actions">
        <button className="btn btn-primary" onClick={() => onStartSession(piece.id)}>
          <Icon name="play" size={12}/> Begin session
        </button>
        <button className="btn btn-ghost">
          <Icon name="loop" size={14}/> Loop tough sections
        </button>
        <div className="export-row" style={{ margin: 0, marginLeft: 'auto' }}>
          <span className="ex"><Icon name="pdf" size={12}/> Export PDF</span>
          <span className="ex"><Icon name="image" size={12}/> Save PNG</span>
          <span className="ex"><Icon name="staff" size={12}/> MusicXML</span>
        </div>
      </div>
    </div>

    <div className="stats-col">
      <div className="stat"><span>Progress</span><span className="v lumen">{Math.round(piece.progressPct*100)}<span className="unit-sm">%</span></span></div>
      <div className="stat"><span>Sessions</span><span className="v">{piece.sessions}</span></div>
      <div className="stat"><span>Time invested</span><span className="v">{Math.floor(piece.minutesTotal/60)}<span className="unit-sm">h</span> {piece.minutesTotal%60}<span className="unit-sm">m</span></span></div>
      <div className="stat"><span>Streak on piece</span><span className="v">{piece.streakDays}<span className="unit-sm">d</span></span></div>
    </div>
  </div>
);

/* ─── Toggle chip (annot toggles) ───────────────── */
const ToggleChip = ({ on, onClick, children }) => (
  <button className={`tog-chip ${on ? 'on' : ''}`} onClick={onClick}>
    <span className="tog-dot"/>
    {children}
  </button>
);

/* ─── Selection toolbar (appears when measures selected) ─ */
const SelectionToolbar = ({ selection, onClear, onLoop, onMarkSection }) => {
  const [m1, m2] = selection;
  const count = m2 - m1 + 1;
  return (
    <div className="sel-toolbar">
      <div className="sel-left">
        <span className="dot deep"/>
        <span className="lbl">Selected</span>
        <span className="range">mm. {m1}{m1 !== m2 ? `–${m2}` : ''}</span>
        <span className="meta">{count} {count === 1 ? 'measure' : 'measures'}</span>
      </div>
      <div className="sel-acts">
        <button className="btn btn-ghost"><Icon name="loop" size={12}/> Loop</button>
        <button className="btn btn-ghost" onClick={onLoop}><Icon name="metronome" size={12}/> Practice slow</button>
        <button className="btn btn-ghost"><Icon name="pin" size={12}/> Annotate</button>
        <button className="btn btn-primary" onClick={onMarkSection}><Icon name="plus" size={11}/> Mark as section</button>
        <button className="icon-btn" onClick={onClear} title="Clear selection">×</button>
      </div>
    </div>
  );
};

/* ─── Image (PNG) preview frame ─────────────────── */
const ImagePreviewFrame = ({ piece, children }) => (
  <div style={{
    position: 'relative',
    background: 'color-mix(in oklch, var(--foam) 4%, transparent)',
    border: '1px dashed var(--line)',
    borderRadius: 4,
    padding: 32,
    maxWidth: 1100,
    margin: '0 auto',
  }}>
    <div style={{
      position: 'absolute', top: 8, left: 12,
      fontFamily: 'var(--font-mono)', fontSize: 10,
      letterSpacing: '0.04em', color: 'var(--shoal)',
    }}>
      preview · {piece.id}.png · 1600 × 900
    </div>
    <div style={{
      position: 'absolute', top: 8, right: 12,
      fontFamily: 'var(--font-sans)', fontSize: 10,
      letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--shoal)',
    }}>
      png export · transparent bg · 2× scale
    </div>
    <div style={{ marginTop: 18, marginBottom: 18 }}>
      {children}
    </div>
    <div style={{
      borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: 14,
      display: 'flex', justifyContent: 'space-between',
      fontFamily: 'var(--font-sans)', fontSize: 10,
      letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--shoal)',
    }}>
      <span>{piece.title}</span>
      <span>annotated · heat strip preserved as flat color</span>
      <span><b style={{ color: 'var(--lumen)' }}>↓ download</b></span>
    </div>
  </div>
);

/* ─── Section row in the cue list ───────────────── */
const SectionRow = ({ s, idx, active, onPick }) => {
  const dotColor = s.heat > 0.65 ? 'var(--lumen)' : s.heat > 0.32 ? 'var(--krill)' : 'var(--coral)';
  const dotGlow = s.heat > 0.65 ? `0 0 8px var(--lumen-core)` : 'none';
  return (
    <div className={`cue-row ${active ? 'active' : ''}`} onClick={onPick}>
      <div className="pin-num">
        <span className="marker" style={{ background: dotColor, boxShadow: dotGlow }}/>
        {String.fromCharCode(65 + idx)}
      </div>
      <div className="measures">{s.range}</div>
      <div className="label">
        {s.label}
        <span className="sub">{s.subtitle}</span>
      </div>
      <div className="tempo">{s.tempo}</div>
      <div className="conf">
        <div className="pips">
          {[1,2,3,4,5].map(i => (
            <span key={i} className={`pip ${
              i <= s.conf ? (s.heat > 0.65 ? 'on' : s.heat > 0.32 ? 'warn' : 'bad') : ''
            }`}/>
          ))}
        </div>
      </div>
      <div className="reps">{s.reps} reps</div>
      <div className="more"><Icon name="arrow-right" size={12}/></div>
    </div>
  );
};

/* ─── Focused reader (fullscreen-ish overlay) ───── */
const FocusedReader = ({ piece, onClose, showBrackets, showHeat, selection, onMeasureClick }) => {
  const total = TOTAL_SYSTEMS_FOR(piece);
  return (
    <div className="focused-reader" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="focused-inner">
        <div className="focused-top">
          <div>
            <div className="eyebrow"><span className="rule"/> Focused reading · plate</div>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 400, letterSpacing: '-0.022em' }}>
              {piece.title} <em style={{ fontStyle: 'italic', color: 'var(--mist)', fontWeight: 300, fontSize: 18, marginLeft: 14 }}>{piece.composer}</em>
            </h2>
          </div>
          <button className="icon-btn" onClick={onClose}>×</button>
        </div>
        <Score
          piece={piece}
          mode="plate"
          showBrackets={showBrackets}
          showHeatStrip={showHeat}
          selection={selection}
          onMeasureClick={onMeasureClick}
          visibleSystems={[0, total - 1]}
        />
      </div>
    </div>
  );
};

Object.assign(window, { PieceView });
