import { useMemo, useState } from 'react';

import { Topbar } from '../components/Topbar';
import { CompositionScore, PhraseLine } from '../components/raga/RagaScore';
import { COMPOSITIONS } from '../data/raga/composition';
import { RAGAS, type Raga } from '../data/raga/raga';
import { TALA_BY_ID } from '../data/raga/tala';
import { type MusicSystem, type Swara } from '../data/raga/swara';

const TRADITIONS: Array<{ id: MusicSystem; label: string; blurb: string }> = [
  {
    id: 'hindustani',
    label: 'Hindustani',
    blurb:
      'North Indian. Sargam swarlipi with komal/tivra inflections and octave dots, laid on tala cycles marked by sam, tali and khali.',
  },
  {
    id: 'carnatic',
    label: 'Carnatic',
    blurb:
      'South Indian. Swara notation on the 72-melakarta system, with tala built from angas — laghu and drutam.',
  },
];

const FULL_NAME: Record<string, string> = {
  S: 'Sa',
  R: 'Re',
  G: 'Ga',
  M: 'Ma',
  P: 'Pa',
  D: 'Dha',
  N: 'Ni',
};

/** A readable label for a single swara, e.g. "Ga", "komal Re", "tivra Ma". */
function swaraName(s: Swara): string {
  const prefix = s.variant === 'komal' ? 'komal ' : s.variant === 'tivra' ? 'tivra ' : '';
  return `${prefix}${FULL_NAME[s.name]}`;
}

function RagaPanel({ raga }: { raga: Raga }) {
  const comps = COMPOSITIONS.filter((c) => c.ragaId === raga.id);
  return (
    <div className="raga-panel">
      <div className="raga-head">
        <h2>{raga.name}</h2>
        <div className="raga-meta">
          <span>{raga.parentScale}</span>
          {raga.melakarta && <span>melakarta {raga.melakarta}</span>}
          {raga.vadi && <span>vadi {swaraName(raga.vadi)}</span>}
          {raga.samvadi && <span>samvadi {swaraName(raga.samvadi)}</span>}
          {raga.timeOfDay && <span>{raga.timeOfDay}</span>}
        </div>
      </div>

      <p className="raga-desc">{raga.description}</p>

      <div className="raga-lines">
        <div className="raga-line">
          <span className="raga-line-label">Ārohaṇa</span>
          <PhraseLine phrase={raga.aroha} ariaLabel={`${raga.name} aroha`} />
        </div>
        <div className="raga-line">
          <span className="raga-line-label">Avarohaṇa</span>
          <PhraseLine phrase={raga.avaroha} ariaLabel={`${raga.name} avaroha`} />
        </div>
        {raga.pakad && (
          <div className="raga-line">
            <span className="raga-line-label">Pakaḍ</span>
            <PhraseLine phrase={raga.pakad} ariaLabel={`${raga.name} pakad`} />
          </div>
        )}
      </div>

      {comps.length > 0 && (
        <div className="raga-comps">
          <div className="eyebrow"><span className="rule" /> Compositions &amp; exercises</div>
          {comps.map((comp) => {
            const tala = TALA_BY_ID.get(comp.talaId);
            if (!tala) return null;
            return (
              <div key={comp.id} className="raga-comp card">
                <div className="raga-comp-head">
                  <h3>{comp.title}</h3>
                  <span className="raga-comp-tala">{tala.name}</span>
                </div>
                {comp.note && <div className="raga-comp-note">{comp.note}</div>}
                {comp.sections.map((section) => (
                  <CompositionScore key={section.id} section={section} tala={tala} />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** A compact legend for how to read the notation. */
function Legend() {
  return (
    <div className="raga-legend card">
      <div className="head">
        <h3>Reading the notation</h3>
        <span className="eyebrow">— legend</span>
      </div>
      <ul>
        <li><b>S R G M P D N</b> — the seven swaras (Sa Re Ga Ma Pa Dha Ni).</li>
        <li><u>Underline</u> marks a <b>komal</b> (flat) swara; an overline marks <b>tivra</b> (sharp) Ma.</li>
        <li>A dot <b>above</b> raises a swara to the upper octave (taar); a dot <b>below</b> drops it to the lower octave (mandra).</li>
        <li><b>–</b> sustains the previous swara; <b>·</b> is a rest.</li>
        <li>Above the grid: <b>×</b> is the sam (cycle start), numbers are tali (claps), <b>○</b> is khali (wave). Carnatic shows angas (<b>|</b> laghu, <b>O</b> drutam).</li>
      </ul>
    </div>
  );
}

export function WorldNotationView() {
  const [system, setSystem] = useState<MusicSystem>('hindustani');
  const ragas = useMemo(() => RAGAS.filter((r) => r.system === system), [system]);
  const [ragaId, setRagaId] = useState<string>(ragas[0]?.id ?? '');

  // Keep the selected raga consistent with the chosen tradition.
  const selected = ragas.find((r) => r.id === ragaId) ?? ragas[0];
  const tradition = TRADITIONS.find((t) => t.id === system)!;

  const chooseSystem = (next: MusicSystem) => {
    setSystem(next);
    const first = RAGAS.find((r) => r.system === next);
    if (first) setRagaId(first.id);
  };

  return (
    <div>
      <Topbar crumbs={['Soundings', 'World Notation']} />

      <div className="page-hero">
        <div>
          <div className="eyebrow"><span className="rule" /> World Notation · Indian classical</div>
          <h1>Sargam, <em>in its own hand</em>.</h1>
          <div className="lede">
            Hindustani and Carnatic music don't live on the staff — they live in
            swaras and tala cycles. Here they're engraved in their own notation,
            with <span className="lumen">ragas to study</span> and exercises to play.
          </div>
        </div>
        <div className="meta-col">
          <div>Traditions <span className="v">2</span></div>
          <div>Ragas <span className="v">{RAGAS.length}</span></div>
          <div>Pieces <span className="v">{COMPOSITIONS.length}</span></div>
          <div>Notation <span className="v">native sargam</span></div>
        </div>
      </div>

      <div className="tech-sub-toggle">
        {TRADITIONS.map((t) => (
          <button
            key={t.id}
            className={`sub-chip ${t.id === system ? 'active' : ''}`}
            onClick={() => chooseSystem(t.id)}
            aria-pressed={t.id === system}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="raga-tradition-blurb">{tradition.blurb}</p>

      <div className="tech-layout">
        <div>
          {ragas.length > 1 && (
            <div className="tech-sub-toggle raga-picker">
              {ragas.map((r) => (
                <button
                  key={r.id}
                  className={`sub-chip ${r.id === selected?.id ? 'active' : ''}`}
                  onClick={() => setRagaId(r.id)}
                  aria-pressed={r.id === selected?.id}
                >
                  {r.name}
                </button>
              ))}
            </div>
          )}
          {selected && <RagaPanel raga={selected} />}
        </div>

        <aside className="tech-rail">
          <Legend />
        </aside>
      </div>
    </div>
  );
}
