import { useState } from 'react';
import { Topbar } from '../components/Topbar';
import { Icon } from '../components/Icon';
import { Score } from '../verovio/Score';
import {
  SKETCHES,
  ARCHIVED_SKETCHES,
  SCRATCH_IDEAS,
  VOICE_MEMOS,
} from '../data/sketches';
import type { Sketch } from '../data/schemas';
import { emphasize } from '../lib/text';

type Tab = 'lyric' | 'harmony' | 'plan' | 'audio';

const HARMONY_OPTS = {
  inputFrom: 'abc' as const,
  scale: 42,
  adjustPageHeight: true,
  header: 'none' as const,
  footer: 'none' as const,
  breaks: 'none' as const,
  pageMarginLeft: 40,
  pageMarginRight: 40,
  pageMarginTop: 20,
  pageMarginBottom: 10,
};

export function SketchbookMock() {
  const [activeId, setActiveId] = useState(SKETCHES[0].id);
  const [tab, setTab] = useState<Tab>('lyric');
  const active = SKETCHES.find((s) => s.id === activeId) ?? SKETCHES[0];

  return (
    <div>
      <Topbar crumbs={['Soundings', 'Sketchbook']} />

      <div className="page-hero">
        <div>
          <div className="eyebrow"><span className="rule" /> Composition · 3 pieces in motion</div>
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
        <div className="sketch-list">
          <div className="head">
            <span className="l">— in progress</span>
            <span className="c">{String(SKETCHES.length).padStart(2, '0')}</span>
          </div>
          {SKETCHES.map((s) => (
            <div
              key={s.id}
              className={`sketch-item ${activeId === s.id ? 'active' : ''}`}
              onClick={() => { setActiveId(s.id); setTab('lyric'); }}
            >
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
            <span className="c">{String(ARCHIVED_SKETCHES.length).padStart(2, '0')}</span>
          </div>
          {ARCHIVED_SKETCHES.map((s, i) => (
            <div key={i} className="sketch-item" style={{ opacity: 0.6 }}>
              <div className="t" style={{ fontSize: 16 }}>{s.title}</div>
              <div className="meta"><span>{s.sub}</span></div>
            </div>
          ))}
        </div>

        <div className="sketch-detail">
          <div className="top">
            <div>
              <div className="eyebrow">— {active.status} · {active.tags.join(' · ')}</div>
              <h2>
                {active.title}
                {active.subtitle && <em>{active.subtitle}</em>}
              </h2>
            </div>
            <div className="meta-block">
              <div>started · <span>{active.started}</span></div>
              <div>last edit · <span>{active.lastTouched}</span></div>
              <div>key · <span>{active.keyArea}</span></div>
              <div>meter · <span>{active.meter}</span></div>
            </div>
          </div>

          <div className="tabs">
            <button className={tab === 'lyric' ? 'active' : ''} onClick={() => setTab('lyric')}>Lyric · structure</button>
            <button className={tab === 'harmony' ? 'active' : ''} onClick={() => setTab('harmony')}>Harmony</button>
            <button className={tab === 'plan' ? 'active' : ''} onClick={() => setTab('plan')}>Plan</button>
            <button className={tab === 'audio' ? 'active' : ''} onClick={() => setTab('audio')}>Voice memos</button>
          </div>

          {tab === 'lyric' && <LyricBlock lyric={active.lyric} />}
          {tab === 'harmony' && <HarmonyTab sketch={active} />}
          {tab === 'plan' && (
            <div className="sketch-plan">
              <div className="eyebrow">— next moves</div>
              <h3>How we'll finish this</h3>
              {active.plan.map((step, i) => (
                <div key={i} className={`step ${step.done ? 'done' : ''} ${step.active ? 'active' : ''}`}>
                  <span className="n">{step.done ? '✓' : String(i + 1).padStart(2, '0')}</span>
                  <span>{step.text}</span>
                </div>
              ))}
            </div>
          )}
          {tab === 'audio' && <VoiceMemos />}
        </div>

        <div className="idea-rail">
          <div className="idea-head">
            <span className="l">— scratch ideas</span>
            <button className="btn btn-ghost" style={{ fontSize: 10, padding: '4px 10px' }}>+ capture</button>
          </div>
          <textarea className="idea-input" placeholder="Catch the thought before it sounds away…" />
          {SCRATCH_IDEAS.map((idea, i) => (
            <div key={i} className="idea-card">
              <div className="when">{idea.when}</div>
              <div className="what" dangerouslySetInnerHTML={{ __html: emphasize(idea.what) }} />
              <div className="tags">
                {idea.tags.map((t, j) => <span key={j} className="t">{t}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LyricBlock({ lyric }: { lyric: string }) {
  return (
    <div className="lyric-block">
      {lyric.split('\n').map((line, i) => {
        const marker = line.match(/^\[(.+?)\]/);
        if (marker) return <span key={i} className="marker">{marker[1]}</span>;
        if (line.match(/^\s*\{/)) return <span key={i} className="annot">{line}{'\n'}</span>;
        return <span key={i}>{line || ' '}{'\n'}</span>;
      })}
    </div>
  );
}

function HarmonyTab({ sketch }: { sketch: Sketch }) {
  if (!sketch.harmony) {
    return (
      <div className="harmony-empty">
        No harmony sketched yet for <em>{sketch.title}</em>.
      </div>
    );
  }
  return (
    <div>
      <div className="harmony-eyebrow">— chord sketch · chorus</div>
      <div className="chord-row">
        {sketch.harmony.map((ch, i) => (
          <div key={i} className="chord">
            <div className="sym">{ch.symbol}</div>
            <div className="rom">{ch.roman}</div>
          </div>
        ))}
      </div>

      {sketch.harmonyAbc && (
        <div className="harmony-score">
          <div className="harmony-score-label">— engraved · grand staff</div>
          <Score data={sketch.harmonyAbc} options={HARMONY_OPTS} ariaLabel={`${sketch.title} chorus harmony`} />
        </div>
      )}

      <div className="harmony-note">
        The chorus moves <span className="lumen">i — VI — v — iv — i⁶</span>.
        The drop to iv (B add4) before returning to the tonic is the line
        "<em>litany of slow</em>" — let the harmony <span className="lumen">sag</span> there,
        like the weight of the carcass reaching the bottom.
      </div>
    </div>
  );
}

function VoiceMemos() {
  return (
    <div>
      <div className="harmony-eyebrow muted">— voice memos · {VOICE_MEMOS.length} takes</div>
      {VOICE_MEMOS.map((r, i) => (
        <div key={i} className="memo-row">
          <button className="icon-btn" aria-label={`Play ${r.label}`}><Icon name="play" size={11} /></button>
          <span className="when">{r.when}</span>
          <span className="label">
            {r.label}
            {r.keeper && <span className="chip lumen" style={{ marginLeft: 14 }}>keeper</span>}
          </span>
          <span className="len">{r.len}</span>
          <span className="more"><Icon name="more" size={14} /></span>
        </div>
      ))}
    </div>
  );
}
