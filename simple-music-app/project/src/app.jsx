// src/app.jsx — root: view routing + tweaks

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "view": "library",
  "openPieceId": "chopin-9-2",
  "heatStyle": "warm-to-lumen",
  "density": "regular",
  "accent": "#4afdc6",
  "showBio": true
}/*EDITMODE-END*/;

function applyAccent(hex) {
  // Override --lumen tokens at the root so the entire palette retunes.
  const root = document.documentElement.style;
  root.setProperty('--lumen', hex);
  // Derive bright / core / deep variants by tweaking the same hue
  root.setProperty('--lumen-bright', hex);
  root.setProperty('--lumen-core', hex);
  root.setProperty('--accent', hex);
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [view, setView] = React.useState(t.view || 'library');
  const [pieceId, setPieceId] = React.useState(t.openPieceId || 'chopin-9-2');

  React.useEffect(() => { applyAccent(t.accent); }, [t.accent]);

  React.useEffect(() => {
    // Density: change root font scale a touch
    document.documentElement.style.setProperty(
      'font-size',
      t.density === 'compact' ? '15px' : t.density === 'comfy' ? '17px' : '16px'
    );
  }, [t.density]);

  const goPiece = (id) => { setPieceId(id); setView('piece'); setTweak({ view: 'piece', openPieceId: id }); };
  const goSession = (id) => { setPieceId(id); setView('session'); setTweak({ view: 'session', openPieceId: id }); };

  const setViewPersist = (v) => { setView(v); setTweak('view', v); };

  let body;
  if (view === 'library')    body = <LibraryView onOpenPiece={goPiece} onStartSession={goSession}/>;
  else if (view === 'piece') body = <PieceView pieceId={pieceId} onBack={() => setViewPersist('library')} onStartSession={goSession}/>;
  else if (view === 'session') body = <SessionView pieceId={pieceId} onEnd={() => setViewPersist('library')} onOpenPiece={goPiece}/>;
  else if (view === 'stats') body = <StatsView/>;
  else if (view === 'sketchbook') body = <SketchbookView/>;
  else body = <LibraryView onOpenPiece={goPiece} onStartSession={goSession}/>;

  return (
    <div className="app">
      <Sidebar view={view} setView={setViewPersist}/>
      <main className="main">
        {body}
      </main>

      <TweaksPanel title="Soundings">
        <TweakSection label="View"/>
        <TweakSelect
          label="Open screen"
          value={view}
          options={[
            { value: 'library',    label: 'Library' },
            { value: 'piece',      label: 'Piece detail' },
            { value: 'session',    label: 'Practice session' },
            { value: 'stats',      label: 'Stats / journal' },
            { value: 'sketchbook', label: 'Sketchbook' },
          ]}
          onChange={(v) => setViewPersist(v)}
        />
        <TweakSelect
          label="Active piece"
          value={pieceId}
          options={SOUND_DATA.PIECES.map(p => ({ value: p.id, label: `${p.title.slice(0,28)} · ${p.composer.split(' ').slice(-1)[0]}` }))}
          onChange={(v) => { setPieceId(v); setTweak('openPieceId', v); }}
        />

        <TweakSection label="Visual"/>
        <TweakColor
          label="Bioluminescence"
          value={t.accent}
          options={['#4afdc6', '#a6ff5e', '#5ec8ff', '#ff5ec8', '#ffb472']}
          onChange={(v) => setTweak('accent', v)}
        />
        <TweakRadio
          label="Density"
          value={t.density}
          options={['compact', 'regular', 'comfy']}
          onChange={(v) => setTweak('density', v)}
        />
        <TweakToggle
          label="Bioluminescence wash (session)"
          value={t.showBio}
          onChange={(v) => setTweak('showBio', v)}
        />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
