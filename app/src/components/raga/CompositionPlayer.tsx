/**
 * A playable segment: one composition section with a transport (play / stop /
 * loop) that sonifies its swaras and drives the score's matra cursor.
 */

import { useState } from 'react';

import { Icon } from '../Icon';
import type { CompositionSection } from '../../data/raga/composition';
import type { SwaraScript } from '../../data/raga/swara';
import type { Tala } from '../../data/raga/tala';
import { CompositionScore } from './RagaScore';
import { DEFAULT_SA_HZ, useSwaraPlayback, type TuningSystem } from './playback';

interface Props {
  section: CompositionSection;
  tala: Tala;
  /** Matras per minute. */
  bpm: number;
  saHz?: number;
  script?: SwaraScript;
  tuning?: TuningSystem;
}

export function CompositionPlayer({
  section,
  tala,
  bpm,
  saHz = DEFAULT_SA_HZ,
  script = 'roman',
  tuning = 'equal',
}: Props) {
  const [running, setRunning] = useState(false);
  const [loop, setLoop] = useState(true);
  const { activeIndex } = useSwaraPlayback({
    cells: section.cells,
    bpm,
    saHz,
    tuning,
    running,
    loop,
    onEnded: () => setRunning(false),
  });

  return (
    <div className="raga-comp-section">
      <div className="raga-transport">
        <button
          className={`raga-play ${running ? 'on' : ''}`}
          onClick={() => setRunning((r) => !r)}
          aria-pressed={running}
          aria-label={running ? `Stop ${section.label}` : `Play ${section.label}`}
        >
          <Icon name={running ? 'stop' : 'play'} size={13} />
          {running ? 'Stop' : 'Play'}
        </button>
        <button
          className={`raga-loop ${loop ? 'active' : ''}`}
          onClick={() => setLoop((l) => !l)}
          aria-pressed={loop}
        >
          Loop
        </button>
        <span className="raga-laya">{bpm} mpm</span>
      </div>
      <CompositionScore
        section={section}
        tala={tala}
        activeMatra={running ? activeIndex : undefined}
        script={script}
      />
    </div>
  );
}
