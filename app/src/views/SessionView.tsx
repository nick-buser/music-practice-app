import { useEffect, useMemo, useRef, useState } from 'react';
import { Topbar } from '../components/Topbar';
import { Icon } from '../components/Icon';
import { SessionScore } from '../verovio/SessionScore';
import { useMetronome } from '../verovio/useMetronome';
import { resolveSubject } from '../data/subject';
import { beatsPerBar } from '../lib/time';
import bioluminescence from '../assets/bioluminescence.svg';

interface Props {
  subjectId: string;
  onEnd: () => void;
  onOpenPiece: (id: string) => void;
}

const SESSION_SCORE_OPTS_FULL = {
  inputFrom: 'abc' as const,
  scale: 36,
  adjustPageHeight: true,
  header: 'none' as const,
  footer: 'none' as const,
  breaks: 'auto' as const,
  pageMarginLeft: 50,
  pageMarginRight: 50,
  pageMarginTop: 30,
  pageMarginBottom: 20,
};

/** Pieces render end-to-end for the piece-detail heatmap, which is too tall
 *  here — clip to the opening 8 bars. Scales are already 1–2 bars so they get
 *  the unclipped options. */
const PIECE_SCORE_OPTS = { ...SESSION_SCORE_OPTS_FULL, measureRange: '1-8' };

const GOAL_MINS = 35;
const LOG_TAGS = ['Deep work', 'Slow drill', 'Run-through', 'Sight-read', 'Memorize', 'Recording'];

export function SessionView({ subjectId, onEnd, onOpenPiece }: Props) {
  const subject = useMemo(() => resolveSubject(subjectId), [subjectId]);
  const isScale = subject.kind === 'scale';

  const meterBeats = useMemo(() => beatsPerBar(subject.meter), [subject.meter]);

  const [playing, setPlaying] = useState(true);
  const [bpm, setBpm] = useState(subject.bpmCurrent);
  const [elapsed, setElapsed] = useState(0); // seconds
  const [scoreFraction, setScoreFraction] = useState(0);
  const [notes, setNotes] = useState('');
  const [logTag, setLogTag] = useState(isScale ? 'Slow drill' : 'Slow drill');

  // Loop list applies only to subjects that have sections (pieces).
  const initialLoop = subject.sections.findIndex((s) => s.active);
  const [loopIdx, setLoopIdx] = useState(initialLoop >= 0 ? initialLoop : 0);

  const { currentBeat } = useMetronome(bpm, meterBeats, playing);

  // Reset working bpm + tempo when the subject changes.
  useEffect(() => {
    setBpm(subject.bpmCurrent);
    setElapsed(0);
    setScoreFraction(0);
    setLoopIdx(initialLoop >= 0 ? initialLoop : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject.id]);

  // Practice-time clock — wall-clock seconds while playing.
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);
  const accRef = useRef(0);
  useEffect(() => {
    if (!playing) { lastRef.current = null; return; }
    const tick = (ts: number) => {
      if (lastRef.current !== null) {
        accRef.current += (ts - lastRef.current) / 1000;
        if (accRef.current >= 1) {
          const whole = Math.floor(accRef.current);
          accRef.current -= whole;
          setElapsed((e) => e + whole);
        }
      }
      lastRef.current = ts;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing]);

  const mm = Math.floor(elapsed / 60);
  const ss = String(elapsed % 60).padStart(2, '0');
  const goalProgress = Math.min(1, elapsed / (GOAL_MINS * 60));
  const focusSection = subject.sections[loopIdx] ?? subject.sections[0];

  const R = 78;
  const CIRC = 2 * Math.PI * R;

  const crumb = isScale ? 'Technique · scale drill' : 'Session · active';
  const heroEyebrow = isScale
    ? 'Warmup · in progress · technique'
    : `Session · in progress · ${subject.byline.split(' ').slice(-1)[0]}`;
  const heroTitle = isScale ? (
    <>Warming · <em>{subject.title.toLowerCase()}</em></>
  ) : (
    <>Sounding · <em>session {subject.sessionsLogged + 1}</em></>
  );
  const heroLede = isScale ? (
    <>
      A slow rotation through <span className="lumen">{subject.title.toLowerCase()}</span>.
      Metronome on; fingers warming; eyes off the staff once it's in the hand.
    </>
  ) : (
    <>
      A focused session on the{' '}
      <span className="lumen">{focusSection?.label.toLowerCase() ?? 'opening'}</span>.
      Slow tempo. Hands separate. The room is quiet.
    </>
  );

  const scoreOpts = isScale ? SESSION_SCORE_OPTS_FULL : PIECE_SCORE_OPTS;

  return (
    <div>
      <Topbar crumbs={['Soundings', crumb]} />
      <div style={{ marginTop: -20, marginBottom: 10, display: 'flex', justifyContent: 'flex-end', gap: 14, alignItems: 'center' }}>
        <span className="recording-badge"><span className="dot deep" /> recording</span>
        <button className="btn btn-ghost" onClick={onEnd} style={{ padding: '6px 14px' }}>
          {isScale ? 'End warmup' : 'End session'}
        </button>
      </div>

      <div className="session-page">
        <div className="bio-bg" aria-hidden="true">
          <img src={bioluminescence} alt="" />
        </div>

        <div className="layer">
          <div className="page-hero" style={{ marginBottom: 16 }}>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="eyebrow" style={{ marginBottom: 14 }}>
                <span className="rule" /> {heroEyebrow}
              </div>
              <h1>{heroTitle}</h1>
              <div className="lede" style={{ marginTop: 14 }}>{heroLede}</div>
            </div>
            <div className="meta-col">
              <div>Goal <span className="v">{GOAL_MINS}m</span></div>
              <div>Elapsed <span className="v">{mm}m {ss}s</span></div>
              <div>Target tempo <span className="v">♩ = {subject.bpmTarget}</span></div>
              <div>Working <span className="v" style={{ color: bpm < subject.bpmTarget ? 'var(--krill)' : 'var(--lumen)' }}>♩ = {bpm}</span></div>
            </div>
          </div>

          <div className="session-grid">
            <div className="session-stage">
              <div className="session-piece">
                <div>
                  <div className="eyebrow">— {isScale ? 'now warming' : 'now sounding'}</div>
                  <h2>
                    {subject.title}
                    <em>{subject.byline} · {subject.subtitle}</em>
                  </h2>
                </div>
                <div className="right">
                  <div>target tempo <span className="v">♩ = {subject.bpmTarget}</span></div>
                  <div>current <span className="v" style={{ color: bpm < subject.bpmTarget ? 'var(--krill)' : 'var(--foam)' }}>♩ = {bpm}</span></div>
                </div>
              </div>

              {focusSection && (
                <div className="session-focus">
                  <div className="eyebrow">— focus loop · {focusSection.range}</div>
                  <h3 className="title">{focusSection.label}</h3>
                  <div className="meas">
                    <span style={{ color: 'var(--mist)' }}>{focusSection.subtitle}</span>
                    <span style={{ margin: '0 12px', color: 'var(--shoal)' }}>·</span>
                    <span>target ♩ = <b style={{ color: 'var(--foam)', fontWeight: 400 }}>{subject.bpmTarget}</b></span>
                    <span style={{ margin: '0 12px', color: 'var(--shoal)' }}>·</span>
                    <span>working at <b style={{ color: 'var(--lumen)' }}>♩ = {bpm}</b></span>
                  </div>
                </div>
              )}

              <div className="session-timer">
                <div className="clock-col">
                  <div className={`clock ${playing ? '' : 'paused'}`}>
                    {String(mm).padStart(2, '0')}<span className="sm">:</span>{ss}
                  </div>
                  <div className="goal-bar">
                    <div className="fill" style={{ transform: `scaleX(${goalProgress})` }} />
                  </div>
                  <div className="goal-legend">
                    <span>0m</span>
                    <span>goal · {GOAL_MINS}m</span>
                    <span>60m</span>
                  </div>
                </div>

                <div className="controls">
                  <button className="play-btn" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}>
                    <Icon name={playing ? 'pause' : 'play'} size={28} />
                  </button>
                </div>
              </div>

              <div className="metro">
                <div className="tempo-ctl">
                  <button onClick={() => setBpm((b) => Math.max(30, b - 4))} aria-label="Slower">−</button>
                </div>
                <div className="pips">
                  {Array.from({ length: meterBeats }).map((_, i) => (
                    <span
                      key={i}
                      className={`pip ${i === currentBeat && playing ? (i === 0 ? 'downbeat active' : 'active') : ''}`}
                    />
                  ))}
                </div>
                <div className="bpm">{bpm}<span className="unit">bpm</span></div>
                <div className="tempo-ctl">
                  <button onClick={() => setBpm((b) => Math.min(220, b + 4))} aria-label="Faster">+</button>
                </div>
              </div>

              <div className="session-score-block">
                <div className="score-head">
                  <span>— score · playback cursor follows the metronome</span>
                  {subject.hasPieceDetail && (
                    <span className="open-full" onClick={() => onOpenPiece(subject.id)}>
                      open full score →
                    </span>
                  )}
                </div>
                {subject.abc ? (
                  <SessionScore
                    className="session-score"
                    data={subject.abc}
                    options={scoreOpts}
                    encodedBpm={subject.bpmTarget}
                    bpm={bpm}
                    playing={playing}
                    onProgress={setScoreFraction}
                  />
                ) : (
                  <div className="loading">no score data</div>
                )}
                <div className="score-pos">
                  <div className="fill" style={{ transform: `scaleX(${scoreFraction})` }} />
                </div>
              </div>
            </div>

            <div className="session-rail">
              <div className="session-prog">
                <div className="eyebrow">— session progress</div>
                <div className="ring-wrap">
                  <svg viewBox="0 0 180 180" width="180" height="180">
                    <circle cx="90" cy="90" r={R} fill="none" stroke="color-mix(in oklch, var(--foam) 6%, transparent)" strokeWidth="6" />
                    <circle
                      cx="90" cy="90" r={R} fill="none"
                      stroke="var(--lumen)" strokeWidth="6"
                      strokeDasharray={`${goalProgress * CIRC} ${CIRC}`}
                      strokeLinecap="round"
                      transform="rotate(-90 90 90)"
                      style={{ filter: 'drop-shadow(0 0 6px var(--lumen-core))', transition: 'stroke-dasharray 400ms var(--ease-glide)' }}
                    />
                  </svg>
                  <div className="center">
                    <div className="n">{Math.round(goalProgress * 100)}%</div>
                    <div className="l">to goal</div>
                  </div>
                </div>
                <div className="sub-row"><span>elapsed</span><span className="v">{mm}m {ss}s</span></div>
                <div className="sub-row"><span>remaining</span><span className="v">{Math.max(0, GOAL_MINS - mm)}m</span></div>
                <div className="sub-row">
                  <span>working tempo</span>
                  <span className="v" style={{ color: 'var(--lumen)' }}>
                    {bpm - subject.bpmTarget >= 0 ? '+' : ''}{bpm - subject.bpmTarget} bpm
                  </span>
                </div>
              </div>

              {subject.sections.length > 0 && (
                <div className="loop-card">
                  <div className="eyebrow">— loop</div>
                  {subject.sections.map((s, i) => (
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
              )}

              {isScale && (
                <div className="loop-card">
                  <div className="eyebrow">— scale drill · reps</div>
                  <div style={{
                    fontFamily: 'var(--font-body)',
                    color: 'var(--mist)',
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}>
                    Slow at <b style={{ color: 'var(--foam)', fontWeight: 400 }}>♩ = {subject.bpmCurrent}</b>{' '}
                    until it's effortless; nudge the metronome up
                    by 4 only when the line is even. Target{' '}
                    <span className="lumen">♩ = {subject.bpmTarget}</span>.
                  </div>
                </div>
              )}

              <div className="quick-notes">
                <div className="eyebrow">— quick notes</div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={isScale ? 'Notice anything? Even fingers? Steady wrist?' : 'What did you notice? Where did it click? Where did it resist?'}
                />
                {notes.trim().length > 0 && (
                  <div className="saved"><span className="pulse" /> auto-saved</div>
                )}
              </div>

              <div className="loop-card">
                <div className="eyebrow">— log this session as…</div>
                <div className="log-tags">
                  {LOG_TAGS.map((t) => (
                    <span
                      key={t}
                      className={`chip ${logTag === t ? 'lumen' : ''}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setLogTag(t)}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
