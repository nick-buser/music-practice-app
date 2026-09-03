import { useState, type FocusEvent } from 'react';

import type { Idea, IdeaLinkEdge, IdeaStatus, IdeaUpdate } from '../api/client';

const STATUSES: IdeaStatus[] = ['inbox', 'active', 'shelved', 'done'];

interface ChipEditorProps {
  label: string;
  items: string[];
  placeholder: string;
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
}

/** An editable chip list (kinds, tags) — Enter or blur on the input commits a new chip. */
function ChipEditor({ label, items, placeholder, onAdd, onRemove }: ChipEditorProps) {
  const [draft, setDraft] = useState('');

  const commit = () => {
    const value = draft.trim();
    if (value && !items.includes(value)) onAdd(value);
    setDraft('');
  };

  return (
    <div className="meta-field">
      <label>{label}</label>
      <div className="chip-list">
        {items.map((item) => (
          <span key={item} className="chip">
            {item}
            <button
              type="button"
              className="chip-remove"
              aria-label={`Remove ${item}`}
              onClick={() => onRemove(item)}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        className="meta-input"
        placeholder={placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
      />
    </div>
  );
}

function LinkList({ label, links }: { label: string; links: IdeaLinkEdge[] }) {
  return (
    <div className="meta-field">
      <label>{label}</label>
      {links.length === 0 ? (
        <div className="props-empty">none</div>
      ) : (
        <div className="meta-links">
          {links.map((link) => (
            <div key={link.id} className="link-row">
              <span>{link.title || `#${link.handle}`}</span>
              <span className="link-kind">{link.kind.replace(/_/g, ' ')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  idea: Idea;
  onPatch: (patch: IdeaUpdate) => Promise<void>;
}

/**
 * Status, kinds/tags, key/meter/bpm and the link list — every field here
 * round-trips through `onPatch` (`useIdea.patch`), same as the title and
 * body on the rest of the idea page.
 */
export function MetadataRail({ idea, onPatch }: Props) {
  const commitNumberBlur = (field: 'bpm', current: number | null) =>
    (e: FocusEvent<HTMLInputElement>) => {
      const raw = e.currentTarget.value.trim();
      if (raw === '') {
        if (current !== null) void onPatch({ [field]: null });
        return;
      }
      const parsed = Number(raw);
      if (!Number.isNaN(parsed) && parsed !== current) void onPatch({ [field]: parsed });
    };

  const commitTextBlur = (field: 'key' | 'meter', current: string | null) =>
    (e: FocusEvent<HTMLInputElement>) => {
      const raw = e.currentTarget.value.trim();
      const value = raw === '' ? null : raw;
      if (value !== current) void onPatch({ [field]: value });
    };

  return (
    <div className="meta-rail">
      <div className="idea-head">
        <span className="l">— metadata</span>
      </div>

      <div className="meta-field">
        <label htmlFor="idea-status">status</label>
        <select
          id="idea-status"
          className="meta-select"
          aria-label="Status"
          value={idea.status}
          onChange={(e) => void onPatch({ status: e.target.value as IdeaStatus })}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <ChipEditor
        label="kinds"
        items={idea.kinds}
        placeholder="add kind…"
        onAdd={(value) => void onPatch({ kinds: [...idea.kinds, value] })}
        onRemove={(value) => void onPatch({ kinds: idea.kinds.filter((k) => k !== value) })}
      />

      <ChipEditor
        label="tags"
        items={idea.tags}
        placeholder="add tag…"
        onAdd={(value) => void onPatch({ tags: [...idea.tags, value] })}
        onRemove={(value) => void onPatch({ tags: idea.tags.filter((t) => t !== value) })}
      />

      <div className="meta-field">
        <label htmlFor="idea-key">key</label>
        <input
          id="idea-key"
          key={`key-${idea.id}`}
          className="meta-input"
          aria-label="Key"
          defaultValue={idea.key ?? ''}
          onBlur={commitTextBlur('key', idea.key)}
        />
      </div>

      <div className="meta-field">
        <label htmlFor="idea-meter">meter</label>
        <input
          id="idea-meter"
          key={`meter-${idea.id}`}
          className="meta-input"
          aria-label="Meter"
          defaultValue={idea.meter ?? ''}
          onBlur={commitTextBlur('meter', idea.meter)}
        />
      </div>

      <div className="meta-field">
        <label htmlFor="idea-bpm">bpm</label>
        <input
          id="idea-bpm"
          key={`bpm-${idea.id}`}
          className="meta-input"
          type="number"
          aria-label="BPM"
          defaultValue={idea.bpm ?? ''}
          onBlur={commitNumberBlur('bpm', idea.bpm)}
        />
      </div>

      <LinkList label="links in" links={idea.linksIn} />
      <LinkList label="links out" links={idea.linksOut} />
    </div>
  );
}
