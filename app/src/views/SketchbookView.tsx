import { backendEnabled } from '../config';
import { SketchbookLive } from './SketchbookLive';
import { SketchbookMock } from './SketchbookMock';

interface Props {
  /**
   * SB4: "Practice this" on an idea page. Optional — the public build
   * (`SketchbookMock`, no live ideas) never needs it, and existing callers
   * that render this view bare (SketchbookView.test.tsx) shouldn't have to
   * supply one just to keep compiling.
   */
  onStartSession?: (id: string) => void;
}

/**
 * The Sketchbook tab: a live idea stream when a backend is configured, the
 * static showcase mock otherwise (docs/sketchbook.md: "The static mock
 * itself stays as the public-build showcase"). `SketchbookMock` is the
 * original mock body, moved verbatim — see that file's history for the diff.
 */
export function SketchbookView({ onStartSession }: Props) {
  return backendEnabled ? <SketchbookLive onStartSession={onStartSession} /> : <SketchbookMock />;
}
