import { useRef, useState } from 'react';
import { Sidebar, type View } from './components/Sidebar';
import { LibraryView } from './views/LibraryView';
import { PieceView } from './views/PieceView';
import { SessionView } from './views/SessionView';
import { StatsView } from './views/StatsView';
import { SketchbookView } from './views/SketchbookView';
import { DrillsView } from './views/DrillsView';
import { WorldNotationView } from './views/WorldNotationView';
import { DRILL_BY_ID } from './data/drills';
import { decodeVoicedId } from './data/chord-catalog';
import { useIdeas } from './hooks/useIdeas';

export default function App() {
  const [view, setView] = useState<View>('library');
  const [pieceId, setPieceId] = useState<string>('chopin-9-2');
  const [subjectId, setSubjectId] = useState<string>('chopin-9-2');

  // The Sidebar's Sketchbook badge needs a live inbox count from anywhere in
  // the app, not just while the Sketchbook tab itself is open — so this is a
  // second, independent `useIdeas` instance from the one `SketchbookLive`
  // owns for its own stream (same idiom as `useSavedChords` in DrillsView).
  // `active: true` here means "the app is running", the Sidebar's own
  // lifetime; it no-ops on the public build exactly like every other call.
  const sketchbookIdeas = useIdeas(true);
  const sketchbookCount = sketchbookIdeas.enabled
    ? sketchbookIdeas.ideas.filter((idea) => idea.status === 'inbox').length
    : 3; // static mock count, unchanged on the public build

  // Track the view the user was on before they started a session, so we can
  // send them back there when they end it (Library for pieces, Technique for
  // scales). Defaulted by subject kind so an externally-initiated session
  // (deep link, hot reload) still lands somewhere sensible.
  const returnViewRef = useRef<View>('library');

  const openPiece = (id: string) => { setPieceId(id); setView('piece'); };

  const startSession = (id: string) => {
    setSubjectId(id);
    // A drill id may carry a voicing suffix (e.g. "c-maj7-chord~drop2").
    if (DRILL_BY_ID.has(decodeVoicedId(id).id)) {
      returnViewRef.current = 'drills';
    } else {
      returnViewRef.current = 'library';
      setPieceId(id);
    }
    setView('session');
  };

  const endSession = () => setView(returnViewRef.current);

  let body;
  if (view === 'library') {
    body = <LibraryView onOpenPiece={openPiece} onStartSession={startSession} />;
  } else if (view === 'piece') {
    body = <PieceView pieceId={pieceId} onBack={() => setView('library')} onStartSession={startSession} />;
  } else if (view === 'session') {
    body = <SessionView subjectId={subjectId} onEnd={endSession} onOpenPiece={openPiece} />;
  } else if (view === 'stats') {
    body = <StatsView />;
  } else if (view === 'drills') {
    body = <DrillsView onStartSession={startSession} />;
  } else if (view === 'world-notation') {
    body = <WorldNotationView />;
  } else {
    body = <SketchbookView />;
  }

  return (
    <div className="app">
      <Sidebar view={view} onSetView={setView} counts={{ sketchbook: sketchbookCount }} />
      <main className="main">{body}</main>
    </div>
  );
}
