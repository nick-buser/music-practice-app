/**
 * Extracted properties (key/tempo/chord-guesses derived from an idea's audio,
 * with lineage badges back to the extraction run) are PV3's job, not SB3b's
 * — this is the placeholder the idea page reserves for that panel so PV3
 * only has to fill it in, not carve a new slot out of the layout.
 */
export function PropertiesPanel() {
  return (
    <div className="idea-rail">
      <div className="idea-head">
        <span className="l">— properties</span>
      </div>
      <div className="props-empty">no extracted properties yet</div>
    </div>
  );
}
