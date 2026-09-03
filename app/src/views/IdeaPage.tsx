import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { AttachmentsPanel } from '../components/AttachmentsPanel';
import { MetadataRail } from '../components/MetadataRail';
import { PropertiesPanel } from '../components/PropertiesPanel';
import { Topbar } from '../components/Topbar';
import { useIdea } from '../hooks/useIdea';

interface Props {
  ideaId: string;
  onBack: () => void;
  /** Resolve `[[#n]]` — SketchbookLive owns the handle→id lookup across the whole stream. */
  onNavigateToHandle: (handle: number) => void;
}

const IDEA_LINK_RE = /\[\[#(\d+)\]\]/g;

/** Split `text` on `[[#n]]` idea-link tokens, rendering each as a clickable link. */
function renderInlineLinks(text: string, onNavigateToHandle: (handle: number) => void): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  IDEA_LINK_RE.lastIndex = 0;
  while ((match = IDEA_LINK_RE.exec(text))) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const handle = Number(match[1]);
    parts.push(
      <a
        key={`link-${key++}`}
        href="#"
        className="idea-link"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation(); // don't also flip the body into edit mode
          onNavigateToHandle(handle);
        }}
      >
        #{handle}
      </a>,
    );
    lastIndex = IDEA_LINK_RE.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

/**
 * Renders `body` the way `SketchbookMock`'s (unexported) `LyricBlock`
 * renders a sketch's lyric — `[section]` markers, `{ }` annotations — but
 * re-implemented here rather than imported, so `SketchbookMock.tsx` (pinned
 * by `SketchbookView.test.tsx` and `app/e2e/stats-and-sketchbook.spec.ts`)
 * never has to change for this feature. Adds the one thing the mock never
 * needed: `[[#n]]` cross-links to other ideas.
 */
function renderBody(body: string, onNavigateToHandle: (handle: number) => void): ReactNode {
  return body.split('\n').map((line, i) => {
    const marker = line.match(/^\[(.+?)\]/);
    // A `[[#n]]` link at the start of a line also matches `^\[(.+?)\]`
    // (non-greedy capture stops at "[#n") — skip the marker read in that
    // case so a link-only line renders as a link, not a stray section label.
    if (marker && !marker[1].startsWith('[')) {
      return <span key={i} className="marker">{marker[1]}</span>;
    }
    if (line.match(/^\s*\{/)) {
      return (
        <span key={i} className="annot">
          {renderInlineLinks(line, onNavigateToHandle)}
          {'\n'}
        </span>
      );
    }
    return (
      <span key={i}>
        {line ? renderInlineLinks(line, onNavigateToHandle) : ' '}
        {'\n'}
      </span>
    );
  });
}

function ideaHeadline(idea: { title: string | null; body: string }): string {
  if (idea.title) return idea.title;
  const firstLine = idea.body.split('\n').find((line) => line.trim().length > 0);
  return firstLine?.trim() || '(untitled capture)';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * The idea page: capture's counterpart, where structure arrives later
 * (docs/sketchbook.md). Rendered by `SketchbookLive` in place of the stream
 * once an idea is selected — there's no router in this app, so "navigate to
 * idea #2" just means the parent re-pointing its selection.
 */
export function IdeaPage({ ideaId, onBack, onNavigateToHandle }: Props) {
  const { idea, assets, properties, loading, error, patch, uploadAsset } = useIdea(ideaId);

  const [titleDraft, setTitleDraft] = useState('');
  const [bodyDraft, setBodyDraft] = useState('');
  const [editingBody, setEditingBody] = useState(false);

  // Re-seed the drafts only when a *different* idea has loaded, not on every
  // `idea` update — a patch that lands mid-edit (e.g. a tag added from the
  // rail while the body textarea is open) must not stomp on what's being typed.
  useEffect(() => {
    if (idea) {
      setTitleDraft(idea.title ?? '');
      setBodyDraft(idea.body);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idea?.id]);

  if (!idea) {
    return (
      <div>
        <Topbar crumbs={['Soundings', 'Sketchbook']} />
        <button type="button" className="idea-page-back" onClick={onBack}>← back to stream</button>
        <div className="props-empty" style={{ padding: 40 }}>
          {loading ? 'Loading…' : error ?? 'Idea not found.'}
        </div>
      </div>
    );
  }

  const saveTitle = () => {
    const value = titleDraft.trim();
    const next = value === '' ? null : value;
    if (next !== idea.title) void patch({ title: next });
  };

  const saveBody = () => {
    if (bodyDraft !== idea.body) void patch({ body: bodyDraft });
  };

  return (
    <div>
      <Topbar crumbs={['Soundings', 'Sketchbook', ideaHeadline(idea)]} />

      <button type="button" className="idea-page-back" onClick={onBack}>
        ← back to stream
      </button>

      {error && (
        <div style={{ fontFamily: 'var(--font-body)', color: 'var(--krill)', marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div className="tech-layout">
        <div className="sketch-detail">
          <div className="top">
            <div style={{ flex: 1 }}>
              <div className="eyebrow">— #{idea.handle} · {idea.status}</div>
              <input
                className="idea-title-input"
                aria-label="Idea title"
                placeholder="(untitled capture)"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
              />
            </div>
            <div className="meta-block">
              <div>captured · <span>{formatDate(idea.capturedAt)}</span></div>
              <div>updated · <span>{formatDate(idea.updatedAt)}</span></div>
            </div>
          </div>

          {editingBody ? (
            <textarea
              className="idea-input idea-body-edit"
              aria-label="Idea body"
              autoFocus
              value={bodyDraft}
              onChange={(e) => setBodyDraft(e.target.value)}
              onBlur={() => {
                saveBody();
                setEditingBody(false);
              }}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                  e.preventDefault();
                  saveBody();
                }
              }}
            />
          ) : (
            <div
              className={`lyric-block idea-body-view ${idea.body ? '' : 'empty'}`}
              data-testid="idea-body"
              role="button"
              tabIndex={0}
              onClick={() => setEditingBody(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setEditingBody(true);
              }}
            >
              {idea.body ? renderBody(idea.body, onNavigateToHandle) : 'Click to add a body…'}
            </div>
          )}

          <div style={{ marginTop: 32 }}>
            <AttachmentsPanel ideaId={idea.id} assets={assets} onUpload={uploadAsset} />
          </div>
        </div>

        <aside className="tech-rail">
          <MetadataRail idea={idea} onPatch={patch} />
          <PropertiesPanel properties={properties} />
        </aside>
      </div>
    </div>
  );
}
