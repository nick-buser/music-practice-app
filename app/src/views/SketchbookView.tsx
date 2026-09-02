import { backendEnabled } from '../config';
import { SketchbookLive } from './SketchbookLive';
import { SketchbookMock } from './SketchbookMock';

/**
 * The Sketchbook tab: a live idea stream when a backend is configured, the
 * static showcase mock otherwise (docs/sketchbook.md: "The static mock
 * itself stays as the public-build showcase"). `SketchbookMock` is the
 * original mock body, moved verbatim — see that file's history for the diff.
 */
export function SketchbookView() {
  return backendEnabled ? <SketchbookLive /> : <SketchbookMock />;
}
