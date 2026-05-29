import { useState } from 'react';
import { Sidebar, type View } from './components/Sidebar';
import { LibraryView } from './views/LibraryView';
import { PieceView } from './views/PieceView';
import { SessionView } from './views/SessionView';
import { StatsView } from './views/StatsView';
import { StubView } from './views/StubView';

export default function App() {
  const [view, setView] = useState<View>('library');
  const [pieceId, setPieceId] = useState<string>('chopin-9-2');

  const openPiece = (id: string) => { setPieceId(id); setView('piece'); };
  const startSession = (id: string) => { setPieceId(id); setView('session'); };

  let body;
  if (view === 'library') {
    body = <LibraryView onOpenPiece={openPiece} onStartSession={startSession} />;
  } else if (view === 'piece') {
    body = <PieceView pieceId={pieceId} onBack={() => setView('library')} onStartSession={startSession} />;
  } else if (view === 'session') {
    body = <SessionView pieceId={pieceId} onEnd={() => setView('library')} onOpenPiece={openPiece} />;
  } else if (view === 'stats') {
    body = <StatsView />;
  } else {
    body = <StubView label="Sketchbook" title="Sketchbook" />;
  }

  return (
    <div className="app">
      <Sidebar view={view} onSetView={setView} />
      <main className="main">{body}</main>
    </div>
  );
}
