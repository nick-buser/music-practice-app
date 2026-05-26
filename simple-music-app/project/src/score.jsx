// src/score.jsx — engraved-feel sheet music
//
// Hard rule: the staff is sacred — pristine ink on pristine paper.
// All annotation (heat, sections, selection, pins) lives in margins
// or in dedicated strips BELOW the staff, never tinted across the notes.

/* ─── Clef + time-sig glyphs (small SVGs, hand-drawn) ── */
const TrebleClef = ({ color = 'currentColor' }) => (
  <svg viewBox="0 0 24 72" width="22" height="72" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 6c4 0 6 3 5 8c-1 5-6 7-9 12c-3 5-2 13 5 13c5 0 8-4 7-9c-1-5-7-7-12-2"/>
    <line x1="12" y1="6" x2="12" y2="60"/>
    <circle cx="11" cy="62" r="3" fill={color}/>
  </svg>
);

const BassClef = ({ color = 'currentColor' }) => (
  <svg viewBox="0 0 24 40" width="22" height="40" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12c0-3 3-6 7-6c5 0 8 4 8 9c0 8-7 14-15 18"/>
    <circle cx="21" cy="12" r="1.4" fill={color}/>
    <circle cx="21" cy="18" r="1.4" fill={color}/>
  </svg>
);

const TimeSig = ({ top = '4', bottom = '4', color = 'currentColor' }) => (
  <g fill={color}>
    <text fontFamily="Newsreader, serif" fontSize="18" textAnchor="middle" fontWeight="500" y="16">{top}</text>
    <text fontFamily="Newsreader, serif" fontSize="18" textAnchor="middle" fontWeight="500" y="33">{bottom}</text>
  </g>
);

/* ─── Heat color helpers (used only in dedicated strips) ─ */
function heatFill(h) {
  if (h < 0.05) return 'color-mix(in oklch, var(--foam) 5%, transparent)';
  if (h < 0.32) return 'color-mix(in oklch, var(--coral) 70%, transparent)';
  if (h < 0.65) return 'color-mix(in oklch, var(--krill) 80%, transparent)';
  return 'var(--lumen)';
}
function heatGlow(h) {
  if (h < 0.32) return '0 0 6px color-mix(in oklch, var(--coral) 50%, transparent)';
  if (h < 0.65) return '0 0 6px color-mix(in oklch, var(--krill) 50%, transparent)';
  return '0 0 8px var(--lumen-core)';
}

/* ─── Single staff (5 lines, pristine) ────────────── */
const Staff = ({ x = 0, y = 0, width, color }) => (
  <g stroke={color} strokeWidth="0.8" strokeLinecap="round">
    {[0,1,2,3,4].map((i) => (
      <line key={i} x1={x} y1={y + i*7} x2={x + width} y2={y + i*7}/>
    ))}
  </g>
);

/* Note head + stem */
const Note = ({ x, y, dur = 8, stemUp = true, color }) => {
  const stemLen = 22;
  const sx = stemUp ? x + 3.5 : x - 3.5;
  const sy1 = y;
  const sy2 = y + (stemUp ? -stemLen : stemLen);
  return (
    <g>
      <ellipse cx={x} cy={y} rx="3.8" ry="2.8" fill={color} stroke="none"
               transform={`rotate(-20 ${x} ${y})`}/>
      {dur >= 2 && <line x1={sx} y1={sy1} x2={sx} y2={sy2} stroke={color} strokeWidth="1"/>}
    </g>
  );
};

const HalfNote = ({ x, y, stemUp = true, color }) => {
  const sx = stemUp ? x + 3.5 : x - 3.5;
  const sy2 = y + (stemUp ? -22 : 22);
  return (
    <g>
      <ellipse cx={x} cy={y} rx="3.8" ry="2.8" fill="none" stroke={color} strokeWidth="1.2"
               transform={`rotate(-20 ${x} ${y})`}/>
      <line x1={sx} y1={y} x2={sx} y2={sy2} stroke={color} strokeWidth="1"/>
    </g>
  );
};

const Beam = ({ x1, y1, x2, y2, color }) => (
  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="2.6" strokeLinecap="round"/>
);

const BarLine = ({ x, y1, y2, color, heavy = false }) => (
  <line x1={x} y1={y1} x2={x} y2={y2} stroke={color} strokeWidth={heavy ? 2 : 0.9}/>
);

/* Section bracket — drawn BELOW the staff, never over it.
   Engraver-style: `⌊──── LABEL ────⌋` with end ticks and the label
   sitting in a gap on the line itself. */
const SectionBracket = ({ x1, x2, y, label, sub, heat, color, accentColor, active }) => {
  const cx = (x1 + x2) / 2;
  const tick = 5;
  const dotR = 3;
  const showHeatDot = heat > 0;
  // Roughly compute text width to gap the line out
  const charW = 6.6;
  const textW = label ? Math.min((x2 - x1) - 24, label.length * charW) : 0;
  const gap1 = cx - textW / 2 - 6;
  const gap2 = cx + textW / 2 + 6;
  const lineOp = active ? 0.85 : 0.55;
  return (
    <g>
      {/* line in two halves, leaving a gap for the label */}
      <line x1={x1} y1={y} x2={label ? gap1 : x2} y2={y} stroke={color} strokeWidth="0.9" strokeOpacity={lineOp}/>
      {label && (
        <line x1={gap2} y1={y} x2={x2} y2={y} stroke={color} strokeWidth="0.9" strokeOpacity={lineOp}/>
      )}
      {/* end ticks (downward) */}
      <line x1={x1} y1={y} x2={x1} y2={y + tick} stroke={color} strokeWidth="0.9" strokeOpacity={lineOp}/>
      <line x1={x2} y1={y} x2={x2} y2={y + tick} stroke={color} strokeWidth="0.9" strokeOpacity={lineOp}/>
      {/* heat dot at the left edge, sitting on the line */}
      {showHeatDot && (
        <circle cx={x1 + 2} cy={y} r={dotR}
                fill={heatFill(heat)}
                style={{ filter: heat > 0.65 ? `drop-shadow(${heatGlow(heat)})` : 'none' }}/>
      )}
      {/* label sits ON the bracket line (slight baseline shift up so it's centered on the line) */}
      {label && (
        <text x={cx} y={y + 4}
              fontFamily="IBM Plex Sans, system-ui, sans-serif"
              fontSize="11"
              letterSpacing="0.18em"
              textAnchor="middle"
              fill={active ? accentColor : color}
              fillOpacity={active ? 1 : 0.88}>
          {label.toUpperCase()}
        </text>
      )}
      {/* sub text below */}
      {sub && (
        <text x={cx} y={y + 19}
              fontFamily="Spectral, Georgia, serif"
              fontStyle="italic"
              fontSize="12"
              textAnchor="middle"
              fill={color}
              fillOpacity="0.55">
          {sub}
        </text>
      )}
    </g>
  );
};

/* Selection bracket — drawn ABOVE the staff, in lumen */
const SelectionBracket = ({ x1, x2, y, color }) => {
  const tick = 5;
  return (
    <g style={{ filter: `drop-shadow(0 0 6px ${color})` }}>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={color} strokeWidth="1.4"/>
      <line x1={x1} y1={y} x2={x1} y2={y + tick} stroke={color} strokeWidth="1.4"/>
      <line x1={x2} y1={y} x2={x2} y2={y + tick} stroke={color} strokeWidth="1.4"/>
    </g>
  );
};

/* ─── Notes per measure based on a pattern (no color on notation) ─ */
function measureNotes(mx, measureW, pattern, mi, grandStaff, color) {
  const els = [];
  if (pattern === 'rest') return els;

  if (pattern === 'arpeggio') {
    const ys = [14, 18, 22, 26, 30, 26, 22, 18];
    const nPos = 8;
    for (let i = 0; i < nPos; i++) {
      const x = mx + 16 + i * (measureW - 32) / (nPos - 1);
      els.push(<Note key={`r${mi}-${i}`} x={x} y={ys[i] + (mi%2===0 ? 0 : -2)} dur={8} stemUp={true} color={color}/>);
    }
    // beam across all (8 eighths grouped)
    const x0 = mx + 16, x1 = mx + 16 + (nPos-1)*(measureW-32)/(nPos-1);
    els.push(<Beam key={`rb${mi}-a`} x1={x0+3.5} y1={ys[0]-22} x2={x1+3.5} y2={ys[nPos-1]-22} color={color}/>);
    if (grandStaff) {
      const ly1 = 100;
      els.push(<HalfNote key={`lh1-${mi}`} x={mx+20} y={ly1} stemUp={false} color={color}/>);
      els.push(<HalfNote key={`lh2-${mi}`} x={mx+measureW/2 + 8} y={ly1 + 6} stemUp={false} color={color}/>);
    }
  }
  else if (pattern === 'block') {
    const ys = [14, 18, 22, 26];
    for (let i = 0; i < 4; i++) {
      const x = mx + 18 + i * (measureW - 36) / 3;
      // 3-note chord
      [0, 6, 12].forEach((off, k) => {
        els.push(<ellipse key={`c${mi}-${i}-${k}`} cx={x} cy={ys[i]+off} rx="3.8" ry="2.8"
                 fill={color} transform={`rotate(-20 ${x} ${ys[i]+off})`}/>);
      });
      els.push(<line key={`cs${mi}-${i}`} x1={x+3.5} y1={ys[i]} x2={x+3.5} y2={ys[i]-22} stroke={color} strokeWidth="1"/>);
      if (grandStaff) {
        els.push(<ellipse key={`bl${mi}-${i}`} cx={x} cy={100 + (i%2)*4} rx="3.8" ry="2.8"
                 fill={color} transform={`rotate(-20 ${x} ${100})`}/>);
        els.push(<line key={`bls${mi}-${i}`} x1={x-3.5} y1={100 + (i%2)*4} x2={x-3.5} y2={100 + (i%2)*4 + 22} stroke={color} strokeWidth="1"/>);
      }
    }
  }
  else if (pattern === 'tremolo') {
    const nPos = 12;
    const x0 = mx + 16, x1 = mx + 16 + (nPos-1) * (measureW - 32) / (nPos - 1);
    for (let i = 0; i < nPos; i++) {
      const x = mx + 16 + i * (measureW - 32) / (nPos - 1);
      const y = 20 + (i % 4 === 0 ? -2 : (i % 4));
      els.push(<Note key={`t${mi}-${i}`} x={x} y={y} dur={8} stemUp={true} color={color}/>);
    }
    // double beam across (16th tremolo feel)
    els.push(<Beam key={`tb1-${mi}`} x1={x0+3.5} y1={-2} x2={x1+3.5} y2={-2} color={color}/>);
    els.push(<Beam key={`tb2-${mi}`} x1={x0+3.5} y1={3}  x2={x1+3.5} y2={3} color={color}/>);
    if (grandStaff) {
      // dotted half thumb
      els.push(<HalfNote key={`tht-${mi}`} x={mx + 22} y={104} stemUp={false} color={color}/>);
      els.push(<circle key={`tdt-${mi}`} cx={mx+30} cy={104} r="1.4" fill={color}/>);
    }
  }
  else if (pattern === 'cadenza') {
    const n = 18;
    for (let i = 0; i < n; i++) {
      const x = mx + 12 + i * (measureW - 24) / (n - 1);
      const y = 14 + 14 * Math.sin(i / 2.3);
      els.push(<ellipse key={`cz${mi}-${i}`} cx={x} cy={y + 14} rx="2.4" ry="1.8" fill={color}
               transform={`rotate(-20 ${x} ${y+14})`}/>);
    }
  }
  return els;
}

/* ─── ScoreSystem — one row of staff with brackets and heat ─ */
const ScoreSystem = ({
  systemIdx,
  width = 1100,
  measures = 4,
  startMeasure = 1,
  grandStaff = true,
  pattern = 'arpeggio',
  sectionHeats = [],
  mode = 'plate',            // 'plate' (dark) | 'paper' (light)
  showBrackets = true,
  showHeatStrip = true,
  showSelection = true,
  selection = null,          // [m1, m2] inclusive
  onMeasureClick,
  rehearsalLetter = null,
}) => {
  const PAPER_INK    = '#1a1a1a';
  const PLATE_INK    = 'var(--foam)';
  const PAPER_BG     = '#fbf9f3';
  const ink   = mode === 'paper' ? PAPER_INK : PLATE_INK;
  const muted = mode === 'paper' ? '#6b6b6b' : 'var(--shoal)';
  const accent = 'var(--lumen)';

  const padL = 64, padR = 24;
  const measureW = (width - padL - padR) / measures;
  const trebleY = 38;
  const bassY = grandStaff ? 104 : null;
  const staffBottomY = (bassY ?? trebleY) + 28;

  const selectionRow = showSelection ? 16 : 0;
  const bracketY = staffBottomY + 18;
  const bracketHeight = showBrackets ? 36 : 0;
  const heatY = staffBottomY + bracketHeight + 18;
  const heatHeight = showHeatStrip ? 10 : 0;
  const height = staffBottomY + bracketHeight + heatHeight + 24;

  // Section brackets that intersect this system's measure range
  const systemSections = sectionHeats.filter(s =>
    s.endM >= startMeasure && s.startM <= startMeasure + measures - 1
  );

  // Heat per measure
  const heatFor = (m) => {
    const s = sectionHeats.find(s => m >= s.startM && m <= s.endM);
    return s ? s.heat : 0;
  };
  const sectionFor = (m) => sectionHeats.find(s => m >= s.startM && m <= s.endM);

  // Selection clipped to this system
  let selStart = null, selEnd = null;
  if (selection) {
    const [a, b] = selection;
    selStart = Math.max(a, startMeasure);
    selEnd   = Math.min(b, startMeasure + measures - 1);
    if (selStart > selEnd) { selStart = null; selEnd = null; }
  }

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet"
         style={{ display: 'block', background: mode === 'paper' ? PAPER_BG : 'transparent' }}>

      {/* (A) Selection bracket — above the staff */}
      {selStart != null && (
        <SelectionBracket
          x1={padL + (selStart - startMeasure) * measureW}
          x2={padL + (selEnd - startMeasure + 1) * measureW}
          y={6}
          color={accent}
        />
      )}

      {/* (B) Rehearsal letter (above first measure of system) */}
      {rehearsalLetter && (
        <g>
          <rect x={padL - 2} y={trebleY - 28} width="22" height="18" rx="2"
                fill={ink} fillOpacity="0.92"/>
          <text x={padL + 9} y={trebleY - 14}
                fontFamily="IBM Plex Sans, system-ui, sans-serif"
                fontSize="12" fontWeight="600"
                fill={mode === 'paper' ? '#fbf9f3' : 'var(--abyss-deep)'}
                textAnchor="middle"
                letterSpacing="0.04em">
            {rehearsalLetter}
          </text>
        </g>
      )}

      {/* (C) Pristine staff ===================================== */}
      <Staff x={padL} y={trebleY} width={width - padL - padR} color={ink}/>
      {grandStaff && <Staff x={padL} y={bassY} width={width - padL - padR} color={ink}/>}

      {/* brace */}
      {grandStaff && (
        <path d={`M ${padL-12} ${trebleY-2} q -10 4 -10 ${(bassY-trebleY)/2} q 0 ${(bassY-trebleY)/2 + 30} 10 ${(bassY-trebleY)/2 + 32}`}
              fill="none" stroke={ink} strokeWidth="1.4"/>
      )}

      {/* clef + time signature on first system */}
      {systemIdx === 0 && (
        <g>
          <g transform={`translate(${padL - 30}, ${trebleY - 12})`}>
            <TrebleClef color={ink}/>
          </g>
          {grandStaff && (
            <g transform={`translate(${padL - 30}, ${bassY - 4})`}>
              <BassClef color={ink}/>
            </g>
          )}
          <g transform={`translate(${padL - 4}, ${trebleY - 2})`}>
            <TimeSig top="12" bottom="8" color={ink}/>
          </g>
        </g>
      )}

      {/* Notes per measure (pristine, ink color only) */}
      {Array.from({ length: measures }).map((_, i) => {
        const mx = padL + i * measureW;
        return <g key={`n${i}`}>{measureNotes(mx, measureW, pattern, i, grandStaff, ink)}</g>;
      })}

      {/* Bar lines */}
      {Array.from({ length: measures + 1 }).map((_, i) => {
        const x = padL + i * measureW;
        return <BarLine key={`bl${i}`} x={x} y1={trebleY} y2={(bassY ?? trebleY) + 28}
                        color={ink} heavy={i === measures && systemIdx === 7}/>;
      })}

      {/* Measure numbers (above the leftmost notes only — engraver style) */}
      {Array.from({ length: measures }).map((_, i) => {
        const mNum = startMeasure + i;
        if (i !== 0 && mNum % 5 !== 0) return null;
        return (
          <text key={`mn${i}`}
                x={padL + i * measureW + 2}
                y={trebleY - 8}
                fontFamily="IBM Plex Mono, monospace"
                fontSize="9"
                fill={muted}
                letterSpacing="0.04em">
            {mNum}
          </text>
        );
      })}

      {/* Invisible click targets per measure (above the staff) */}
      {Array.from({ length: measures }).map((_, i) => {
        const mx = padL + i * measureW;
        const top = trebleY - 6;
        const bot = (bassY ?? trebleY) + 34;
        return (
          <rect key={`hit${i}`} x={mx} y={top} width={measureW} height={bot - top}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onClick={(e) => onMeasureClick?.(startMeasure + i, e)}/>
        );
      })}

      {/* (D) Section-bracket annotation row ===================== */}
      {showBrackets && systemSections.map((s) => {
        const sectionStartsHere = s.startM >= startMeasure;
        const x1 = padL + (Math.max(s.startM, startMeasure) - startMeasure) * measureW;
        const x2 = padL + (Math.min(s.endM, startMeasure + measures - 1) - startMeasure + 1) * measureW;
        return (
          <SectionBracket key={`sb-${s.sectionId}-${systemIdx}`}
            x1={x1 + 2} x2={x2 - 2} y={bracketY}
            label={sectionStartsHere ? s.label : ''}
            sub={sectionStartsHere ? s.subtitle : ''}
            heat={s.heat}
            color={muted}
            accentColor={accent}
            active={s.active}/>
        );
      })}

      {/* (E) Heat strip ========================================= */}
      {showHeatStrip && Array.from({ length: measures }).map((_, i) => {
        const mNum = startMeasure + i;
        const h = heatFor(mNum);
        const mx = padL + i * measureW;
        const sec = sectionFor(mNum);
        if (h <= 0) {
          return (
            <line key={`hs${i}`}
                  x1={mx + 6} y1={heatY + 1.5}
                  x2={mx + measureW - 6} y2={heatY + 1.5}
                  stroke={muted} strokeOpacity="0.22" strokeWidth="1"/>
          );
        }
        return (
          <g key={`hs${i}`}>
            <rect x={mx + 5} y={heatY} width={measureW - 10} height="3"
                  fill={heatFill(h)}
                  rx="1.5"
                  style={{ filter: h > 0.65 ? `drop-shadow(${heatGlow(h)})` : 'none' }}/>
            {sec?.active && (
              <line x1={mx + 5} y1={heatY + 7} x2={mx + measureW - 5} y2={heatY + 7}
                    stroke={accent} strokeWidth="0.6" strokeDasharray="2 2" strokeOpacity="0.8"/>
            )}
          </g>
        );
      })}
    </svg>
  );
};

/* ─── Score — top-level (composes systems + provides nav) ──── */
const Score = ({
  piece,
  mode = 'plate',           // 'plate' | 'paper' | 'image'
  showBrackets = true,
  showHeatStrip = true,
  selection = null,
  onMeasureClick,
  visibleSystems = null,    // [startIdx, endIdx] inclusive, or null for all
}) => {
  // Build section data with subtitles preserved
  const sectionHeats = (piece.sections || []).map((s, i) => {
    const m = s.range.match(/(\d+)\D+(\d+)/);
    if (!m) return null;
    return {
      startM: +m[1], endM: +m[2],
      heat: s.heat, label: s.label, subtitle: s.subtitle,
      sectionId: s.id, active: s.active, idx: i,
    };
  }).filter(Boolean);

  const grandStaff = piece.instrument === 'piano' || piece.instrument === 'compose';
  const total = piece.measures || 32;
  const perSystem = grandStaff ? 4 : 5;
  const totalSystems = Math.min(8, Math.ceil(total / perSystem));

  const start = visibleSystems ? visibleSystems[0] : 0;
  const end = visibleSystems ? visibleSystems[1] : totalSystems - 1;

  let pattern = 'arpeggio';
  if (piece.id === 'bach-prelude-cmaj' || piece.id === 'bach-bouree') pattern = 'block';
  if (piece.id === 'tarrega-recuerdos') pattern = 'tremolo';
  if (piece.id === 'caldara-sebben') pattern = 'block';
  if (piece.id === 'satie-gymno-1') pattern = 'block';

  // Rehearsal letters A, B, C... at the start of each new section that begins on a system boundary
  const sectionStarts = new Set(sectionHeats.map(s => s.startM));

  return (
    <div style={{
      background: mode === 'paper' ? '#fbf9f3' : 'transparent',
      padding: mode === 'paper' ? '48px 56px' : 0,
      borderRadius: mode === 'paper' ? 2 : 0,
      border: mode === 'paper' ? '1px solid color-mix(in oklch, var(--foam) 12%, transparent)' : 'none',
      boxShadow: mode === 'paper' ? '0 24px 60px -20px rgba(0,0,0,0.55)' : 'none',
    }}>
      {mode === 'paper' && (
        <PaperHeader piece={piece}/>
      )}
      {Array.from({ length: end - start + 1 }).map((_, i) => {
        const systemIdx = start + i;
        const startMeasure = systemIdx * perSystem + 1;
        let sysPattern = pattern;
        if (piece.id === 'chopin-9-2' && systemIdx === Math.floor(25/perSystem)) sysPattern = 'cadenza';
        const letter = sectionStarts.has(startMeasure)
          ? String.fromCharCode(65 + Math.min(25, sectionHeats.findIndex(s => s.startM === startMeasure)))
          : null;
        return (
          <ScoreSystem
            key={systemIdx}
            systemIdx={systemIdx === 0 ? 0 : 1}
            measures={perSystem}
            startMeasure={startMeasure}
            grandStaff={grandStaff}
            pattern={sysPattern}
            sectionHeats={sectionHeats}
            mode={mode}
            showBrackets={showBrackets}
            showHeatStrip={showHeatStrip}
            selection={selection}
            onMeasureClick={onMeasureClick}
            rehearsalLetter={letter}
          />
        );
      })}
      {mode === 'paper' && (
        <PaperFooter piece={piece} pageNum={(visibleSystems ? visibleSystems[0] : 0) >= 4 ? 2 : 1}/>
      )}
    </div>
  );
};

/* Page header for "paper" mode — opus, title, composer */
const PaperHeader = ({ piece }) => (
  <div style={{
    color: '#1a1a1a',
    paddingBottom: 28,
    borderBottom: '0.5px solid #c4bdab',
    marginBottom: 24,
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                  fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 10,
                  letterSpacing: '0.22em', textTransform: 'uppercase', color: '#6b6b6b' }}>
      <span>opus {piece.id.replace(/[^0-9]/g,'')||'—'} · {piece.key} · {piece.meter}</span>
      <span>{piece.composer} · {piece.year}</span>
    </div>
    <div style={{ textAlign: 'center', marginTop: 22 }}>
      <div style={{ fontFamily: 'Newsreader, serif', fontSize: 32, fontStyle: 'italic', fontWeight: 400, letterSpacing: '-0.02em' }}>
        {piece.title}
      </div>
      {piece.subtitle && (
        <div style={{ fontFamily: 'Newsreader, serif', fontSize: 14, fontStyle: 'italic', color: '#6b6b6b', marginTop: 4 }}>
          {piece.subtitle}
        </div>
      )}
      <div style={{ fontFamily: 'Newsreader, serif', fontSize: 13, fontStyle: 'italic', color: '#3a3a3a', marginTop: 12 }}>
        {piece.tempo.mark} · ♩ = {piece.tempo.bpm}
      </div>
    </div>
  </div>
);

const PaperFooter = ({ piece, pageNum }) => (
  <div style={{
    color: '#6b6b6b',
    paddingTop: 22,
    marginTop: 28,
    borderTop: '0.5px solid #c4bdab',
    fontFamily: 'IBM Plex Sans, sans-serif',
    fontSize: 9,
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    display: 'flex',
    justifyContent: 'space-between',
  }}>
    <span>{piece.title.slice(0,40)}</span>
    <span>· {pageNum} ·</span>
    <span>page {pageNum} of 3</span>
  </div>
);

/* ─── System minimap — navigator across the piece ─────── */
const ScoreMinimap = ({ piece, totalSystems, currentRange, onJump }) => {
  return (
    <div style={{
      display: 'flex', gap: 6,
      padding: '14px 18px',
      background: 'var(--abyss)',
      border: '1px solid var(--line)',
      borderRadius: 4,
    }}>
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, letterSpacing: '0.22em',
                     textTransform: 'uppercase', color: 'var(--shoal)', alignSelf: 'center', marginRight: 8 }}>
        — pages
      </span>
      {Array.from({ length: totalSystems }).map((_, i) => {
        const active = i >= currentRange[0] && i <= currentRange[1];
        return (
          <button key={i} onClick={() => onJump(i)}
            style={{
              flex: 1, height: 38,
              background: active ? 'color-mix(in oklch, var(--lumen) 14%, transparent)' : 'color-mix(in oklch, var(--foam) 4%, transparent)',
              border: active ? '1px solid color-mix(in oklch, var(--lumen) 50%, transparent)' : '1px solid var(--line)',
              borderRadius: 2,
              cursor: 'pointer',
              position: 'relative',
              padding: '6px 8px',
              transition: 'all var(--dur-quick) var(--ease-glide)',
            }}>
            {/* mini staves */}
            <div style={{ position: 'absolute', inset: '8px 6px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              {[0,1,2,3,4].map(l => (
                <div key={l} style={{ height: 1, background: active ? 'color-mix(in oklch, var(--lumen) 60%, transparent)' : 'var(--shoal)', opacity: 0.6 }}/>
              ))}
            </div>
            <span style={{
              position: 'absolute', top: 2, left: 4,
              fontFamily: 'var(--font-mono)', fontSize: 9,
              color: active ? 'var(--lumen)' : 'var(--shoal)',
              letterSpacing: '0.04em',
            }}>{i+1}</span>
          </button>
        );
      })}
    </div>
  );
};

/* ─── Heat legend (small, lives below the score frame) ─ */
const HeatLegend = () => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 18,
    fontFamily: 'var(--font-sans)', fontSize: 10,
    letterSpacing: '0.18em', textTransform: 'uppercase',
    color: 'var(--shoal)',
  }}>
    <span>Mastery strip</span>
    <span style={{ display: 'flex', gap: 4 }}>
      <span style={{ width: 18, height: 6, borderRadius: 1, background: 'color-mix(in oklch, var(--coral) 60%, transparent)' }}/>
      <span style={{ width: 18, height: 6, borderRadius: 1, background: 'color-mix(in oklch, var(--krill) 70%, transparent)' }}/>
      <span style={{ width: 18, height: 6, borderRadius: 1, background: 'var(--lumen)', boxShadow: '0 0 6px var(--lumen-core)' }}/>
    </span>
    <span style={{ display: 'flex', gap: 14 }}>
      <span>struggling</span><span>·</span><span>working</span><span>·</span><span><b style={{ color: 'var(--foam)', fontWeight: 400 }}>solid</b></span>
    </span>
    <span style={{ marginLeft: 'auto' }}>
      Brackets and the strip below mark sections — the staff itself stays untouched.
    </span>
  </div>
);

Object.assign(window, { Score, ScoreMinimap, HeatLegend });
