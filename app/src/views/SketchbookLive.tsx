import { useCallback, useEffect, useRef, useState } from 'react';

import type { IdeaSummary } from '../api/client';
import { Topbar } from '../components/Topbar';
import { useIdeas } from '../hooks/useIdeas';
import { IdeaPage } from './IdeaPage';

/**
 * The stream's fallback "title" — a captured thought needs neither before it
 * lands (docs/sketchbook.md: "Title... come later, or never"), so the first
 * non-empty body line stands in until one exists.
 */
function ideaHeadline(idea: IdeaSummary): string {
  if (idea.title) return idea.title;
  const firstLine = idea.body.split('\n').find((line) => line.trim().length > 0);
  return firstLine?.trim() || '(untitled capture)';
}

function formatCapturedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface Props {
  /** SB4: "Practice this" on an idea page — threaded straight through to `IdeaPage`. */
  onStartSession?: (id: string) => void;
}

/**
 * The live Sketchbook: a reverse-chronological idea stream, an inbox filter,
 * and quick capture. Replaces `SketchbookMock` once a backend is configured
 * (see `SketchbookView.tsx`). The idea page (SB3b) is here; links/graph
 * (SB5) is deliberately not.
 */
export function SketchbookLive({ onStartSession }: Props) {
  // SB5: the search box's raw value, debounced 250ms before it becomes the
  // `q` that reaches `useIdeas`/`GET /v1/ideas?q=` — every keystroke firing
  // its own request would be both wasteful and prone to exactly the
  // out-of-order-response bug `useIdeas` otherwise has to guard against.
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(searchInput), 250);
    return () => clearTimeout(handle);
  }, [searchInput]);

  // This component is only ever mounted while the Sketchbook tab is open, so
  // "active" is unconditionally true here — the enclosing switch is the gate.
  const ideasState = useIdeas(true, debouncedQuery);
  const [inboxOnly, setInboxOnly] = useState(true);
  const [draft, setDraft] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // SB3b's idea page (structure arrives later, after capture). There's no
  // router in this app, so "open an idea" / "follow a [[#n]] link" is just
  // this component pointing its own selection at a different id — the same
  // view-switching idiom `App` uses for its top-level tabs.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const navigateToHandle = useCallback(
    (handle: number) => {
      const target = ideasState.ideas.find((idea) => idea.handle === handle);
      if (target) setSelectedId(target.id); // an unloaded handle is simply not followed
    },
    [ideasState.ideas],
  );

  // Hotkey `c` jumps to the capture box, unless the user is already typing
  // somewhere. Listens on `window` for the component's lifetime, which is
  // exactly the lifetime of "the view is focused" — nothing else in this
  // app renders on top of a view.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'c' || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      e.preventDefault();
      textareaRef.current?.focus();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleCapture = useCallback(async () => {
    const body = draft.trim();
    if (!body && !file) return; // capture needs a line of text or an attachment
    setSubmitting(true);
    try {
      await ideasState.capture(body, file);
    } finally {
      // Clears regardless of success/failure — a failed capture surfaces
      // through `ideasState.error`, not by leaving stale input behind
      // (matches useSavedChords.save's catch-internally contract).
      setDraft('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSubmitting(false);
    }
  }, [draft, file, ideasState]);

  const inboxCount = ideasState.ideas.filter((idea) => idea.status === 'inbox').length;
  // SB5: `q` (tag/kind/key/status filters plus free text) is applied
  // server-side inside `useIdeas` — `ideasState.ideas` here has already
  // been narrowed by the search box. `inboxOnly` stays a purely
  // client-side filter on top of that, same as before this ticket, so the
  // two compose: searching still respects the toggle, and toggling still
  // respects whatever's currently searched.
  const visible = inboxOnly
    ? ideasState.ideas.filter((idea) => idea.status === 'inbox')
    : ideasState.ideas;

  if (selectedId) {
    return (
      <IdeaPage
        ideaId={selectedId}
        onBack={() => setSelectedId(null)}
        onNavigateToHandle={navigateToHandle}
        onStartSession={onStartSession}
      />
    );
  }

  return (
    <div>
      <Topbar crumbs={['Soundings', 'Sketchbook']} />

      <div className="page-hero">
        <div>
          <div className="eyebrow">
            <span className="rule" /> Composition · the inbox is the product
          </div>
          <h1>
            The <em>sketchbook</em>.
          </h1>
          <div className="lede">
            Capture first, structure later. One reverse-chronological stream
            for every scratch idea, melody fragment and half-finished
            thought — classify it later, or never.
          </div>
        </div>
        <div className="meta-col">
          <div>
            Ideas captured <span className="v">{ideasState.ideas.length}</span>
          </div>
          <div>
            In the inbox <span className="v">{inboxCount}</span>
          </div>
        </div>
      </div>

      <div className="tech-layout">
        <div className="sketch-list">
          <div className="head">
            <span className="l">— {inboxOnly ? 'inbox' : 'stream'}</span>
            <button
              type="button"
              className={`tog-chip ${inboxOnly ? 'on' : ''}`}
              onClick={() => setInboxOnly((v) => !v)}
            >
              <span className="tog-dot" />
              inbox only
            </button>
            <span className="c">{String(visible.length).padStart(2, '0')}</span>
          </div>

          <input
            type="search"
            className="meta-input"
            style={{ width: '100%', marginBottom: 12 }}
            aria-label="Search ideas"
            placeholder="tag:x kind:y — or just type…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />

          {ideasState.error && (
            <div style={{ fontFamily: 'var(--font-body)', color: 'var(--krill)', marginBottom: 12 }}>
              {ideasState.error}
            </div>
          )}

          {visible.length === 0 ? (
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontStyle: 'italic',
                color: 'var(--shoal)',
                fontSize: 13,
              }}
            >
              {inboxOnly ? 'Inbox is empty.' : 'Nothing captured yet.'} Press <strong>c</strong> to
              catch a thought.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {visible.map((idea) => (
                <div
                  key={idea.id}
                  className="idea-card"
                  data-testid="idea-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(idea.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setSelectedId(idea.id);
                  }}
                >
                  <div className="when">
                    #{idea.handle} · {formatCapturedAt(idea.capturedAt)}
                  </div>
                  <div className="what">{ideaHeadline(idea)}</div>
                  <div className="tags">
                    <span className={`chip ${idea.status === 'inbox' ? 'lumen' : ''}`}>
                      {idea.status}
                    </span>
                    {idea.kinds.map((k) => (
                      <span key={`k-${k}`} className="t">
                        {k}
                      </span>
                    ))}
                    {idea.tags.map((t) => (
                      <span key={`t-${t}`} className="t">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="tech-rail">
          <div className="idea-rail">
            <div className="idea-head">
              <span className="l">— quick capture</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--shoal)' }}>
                press c
              </span>
            </div>
            <textarea
              ref={textareaRef}
              className="idea-input"
              placeholder="Catch the thought before it sounds away…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <input
              ref={fileInputRef}
              type="file"
              aria-label="Attach a file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--mist)' }}>
                {file.name}
              </div>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              disabled={submitting || (!draft.trim() && !file)}
              onClick={() => void handleCapture()}
            >
              + capture
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
