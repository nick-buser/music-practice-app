import { useRef, useState } from 'react';

import type { IdeaAssetRevisionGroup, IdeaAssetRole } from '../api/client';
import { guessAssetRole, ideaAssetContentUrl } from '../api/ideas';

// Mirrors `IdeaAssetRead.role`'s enum (schema.d.ts) — spelled out here rather
// than derived at runtime because the role picker needs every option up
// front, including ones a capture-path guess would never produce (e.g.
// `score`, `rpp`) but a human filing an attachment by hand still needs.
const ASSET_ROLES: IdeaAssetRole[] = [
  'melody', 'harmony', 'bass', 'drums', 'full',
  'render', 'score', 'rpp', 'reference', 'image', 'other',
];

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  ideaId: string;
  assets: IdeaAssetRevisionGroup[];
  onUpload: (file: File, role: IdeaAssetRole, newRevision: boolean) => Promise<void>;
}

/**
 * Attachments grouped by revision — the backend already groups and orders
 * them newest-revision-first (`IdeaAssetRevisionGroup`'s docstring), so this
 * renders that shape in one pass rather than re-deriving it.
 */
export function AttachmentsPanel({ ideaId, assets, onUpload }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [role, setRole] = useState<IdeaAssetRole>('other');
  const [newRevision, setNewRevision] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (chosen: File | null) => {
    setFile(chosen);
    if (chosen) setRole(guessAssetRole(chosen)); // a starting guess; the picker below can still override it
  };

  const handleUpload = async () => {
    if (!file) return;
    setSubmitting(true);
    try {
      await onUpload(file, role, newRevision);
    } finally {
      setFile(null);
      setNewRevision(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSubmitting(false);
    }
  };

  return (
    <div className="attachments-panel">
      <div className="idea-head">
        <span className="l">— attachments</span>
        <span className="c">{String(assets.reduce((n, g) => n + g.assets.length, 0)).padStart(2, '0')}</span>
      </div>

      {assets.length === 0 && <div className="props-empty">nothing attached yet.</div>}

      {assets.map((group) => (
        <div key={group.revision} className="attachments-rev">
          <div className="rev-label">revision {group.revision}</div>
          {group.assets.map((asset) => (
            <div key={asset.id} className="asset-row">
              <span className="filename">{asset.filename}</span>
              <span className={`chip ${asset.role === 'melody' ? 'lumen' : ''}`}>{asset.role}</span>
              <span className="size">{formatBytes(asset.bytes)}</span>
              <a
                className="btn btn-ghost"
                style={{ padding: '4px 10px', fontSize: 10 }}
                href={ideaAssetContentUrl(ideaId, asset.id)}
                download={asset.filename}
              >
                download
              </a>
              {asset.mime.startsWith('audio/') && (
                <audio controls src={ideaAssetContentUrl(ideaId, asset.id)} />
              )}
            </div>
          ))}
        </div>
      ))}

      <div className="attachments-upload">
        <input
          ref={fileInputRef}
          type="file"
          aria-label="Attach a file"
          onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
        />
        <select
          className="meta-select"
          aria-label="Attachment role"
          value={role}
          onChange={(e) => setRole(e.target.value as IdeaAssetRole)}
        >
          {ASSET_ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--mist)' }}>
          <input
            type="checkbox"
            checked={newRevision}
            onChange={(e) => setNewRevision(e.target.checked)}
          />{' '}
          new revision
        </label>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={!file || submitting}
          onClick={() => void handleUpload()}
        >
          + upload
        </button>
      </div>
    </div>
  );
}
