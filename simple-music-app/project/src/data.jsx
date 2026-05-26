// src/data.jsx
// Mock data for Soundings — a practice journal.
// Pieces, sessions, notes, sketches. Sounding-flavored microcopy.

const INSTRUMENTS = [
  { id: 'piano',   name: 'Piano',         latin: 'Pianoforte',     count: 4 },
  { id: 'guitar',  name: 'Classical Guitar', latin: 'Chitarra',     count: 2 },
  { id: 'voice',   name: 'Voice',         latin: 'Vox',            count: 1 },
  { id: 'compose', name: 'Composition',   latin: 'Compositio',     count: 3 },
];

/* ─── Pieces — the things you're learning ─────────────── */
const PIECES = [
  /* —— Piano —— */
  {
    id: 'chopin-9-2',
    instrument: 'piano',
    title: 'Nocturne in E♭ major',
    subtitle: 'Op. 9 No. 2',
    composer: 'Frédéric Chopin',
    year: 1832,
    key: 'E♭ major',
    meter: '12/8',
    tempo: { mark: 'Andante', bpm: 60 },
    duration: '4:32',
    measures: 34,
    depth: 'shallow', // surface | shallow | deep | mastered
    depthLabel: 'bathyal',
    started: '2026-02-14',
    lastTouched: '2026-05-19',
    progressPct: 0.62,
    minutesTotal: 1840,
    sessions: 47,
    streakDays: 12,
    tags: ['memorized', 'ornamentation', 'rubato'],
    plan: [
      { text: 'Hands-separate at 50 bpm through bar 16.', done: true },
      { text: 'Voice the inner triplets — light thumb, sing the top line.', done: true },
      { text: 'Bar 17–24 figuration: chunk into 4-note groups.', done: false, active: true },
      { text: 'Cadenza (bar 26) at 40 bpm with metronome on beat 1.', done: false },
      { text: 'Full run-through from memory by Friday.', done: false },
    ],
    sections: [
      { id: 's1', range: 'mm. 1–8',   label: 'Opening theme',          subtitle: 'cantabile, simple',          heat: 0.85, conf: 4, tempo: 'q=60', reps: 38 },
      { id: 's2', range: 'mm. 9–16',  label: 'Theme · ornamented',     subtitle: 'añadidos, the first turn',   heat: 0.62, conf: 3, tempo: 'q=60', reps: 29 },
      { id: 's3', range: 'mm. 17–24', label: 'Figuration variation',   subtitle: 'where the right hand opens', heat: 0.28, conf: 2, tempo: 'q=44', reps: 51, struggle: true, active: true },
      { id: 's4', range: 'mm. 25–28', label: 'Cadenza',                subtitle: 'the unmeasured run',         heat: 0.12, conf: 1, tempo: 'rubato', reps: 22, struggle: true },
      { id: 's5', range: 'mm. 29–34', label: 'Return & coda',          subtitle: 'fade to nothing',            heat: 0.74, conf: 4, tempo: 'q=58', reps: 18 },
    ],
    notes: [
      { when: '2026-05-19 · last session', body: 'Bar 21 LH leap — keep the elbow loose. Felt the connection finally when I stopped *aiming* at the bottom note.' },
      { when: '2026-05-17', body: 'Right-hand thirds in bar 14 are settling. Pedal change is now on beat 4 of the previous bar — much cleaner.' },
      { when: '2026-05-12', body: 'Recorded a run-through. Tempo drifts faster between bars 17 and 24 — every time. Probably tension.' },
      { when: '2026-05-04 · teacher', body: '“The rubato has to *breathe*, not lurch.” She demonstrated by singing the melody first, then playing what she sang.' },
    ],
    history: [
      { date: 'May 19', mins: 42 }, { date: 'May 18', mins: 28 }, { date: 'May 16', mins: 55 },
      { date: 'May 14', mins: 35 }, { date: 'May 13', mins: 22 }, { date: 'May 11', mins: 48 },
      { date: 'May 9',  mins: 30 }, { date: 'May 7',  mins: 40 }, { date: 'May 6',  mins: 18 },
    ],
  },
  {
    id: 'bach-prelude-cmaj',
    instrument: 'piano',
    title: 'Prelude in C major',
    subtitle: 'BWV 846 · WTC I',
    composer: 'Johann Sebastian Bach',
    year: 1722,
    key: 'C major',
    meter: '4/4',
    tempo: { mark: 'Moderato', bpm: 72 },
    duration: '2:15',
    measures: 35,
    depth: 'deep',
    depthLabel: 'mesopelagic',
    started: '2025-09-02',
    lastTouched: '2026-05-18',
    progressPct: 0.92,
    minutesTotal: 2620,
    sessions: 84,
    streakDays: 4,
    tags: ['memorized', 'voicing', 'recital ready'],
    plan: [
      { text: 'Maintain — one slow run weekly at 50 bpm.', done: false, active: true },
      { text: 'Schroeder voicing exercise: bring out the bass line.', done: false },
    ],
    sections: [
      { id: 's1', range: 'mm. 1–11',  label: 'Tonic ascent',  subtitle: 'broken chords climb', heat: 0.92, conf: 5, tempo: 'q=72', reps: 64 },
      { id: 's2', range: 'mm. 12–19', label: 'Modulation',    subtitle: 'the unsteady middle', heat: 0.74, conf: 4, tempo: 'q=68', reps: 48 },
      { id: 's3', range: 'mm. 20–27', label: 'Pedal point',   subtitle: 'D-pedal arrival',     heat: 0.88, conf: 5, tempo: 'q=72', reps: 39 },
      { id: 's4', range: 'mm. 28–35', label: 'Final cadence', subtitle: 'breath, breath, rest', heat: 0.95, conf: 5, tempo: 'q=66', reps: 41 },
    ],
    notes: [
      { when: '2026-05-18', body: 'Recital-ready. Played for J. — said the *D-pedal* finally lands.' },
      { when: '2026-04-22', body: 'Worked the voicing exercise: shape the line as if the bass is humming. Helps.' },
    ],
    history: [
      { date: 'May 18', mins: 12 }, { date: 'May 14', mins: 10 }, { date: 'May 7', mins: 15 }, { date: 'Apr 30', mins: 20 },
    ],
  },
  {
    id: 'debussy-clair',
    instrument: 'piano',
    title: 'Clair de lune',
    subtitle: 'Suite bergamasque · L. 75',
    composer: 'Claude Debussy',
    year: 1905,
    key: 'D♭ major',
    meter: '9/8',
    tempo: { mark: 'Andante très expressif', bpm: 50 },
    duration: '5:05',
    measures: 72,
    depth: 'shallow',
    depthLabel: 'mesopelagic',
    started: '2026-03-21',
    lastTouched: '2026-05-15',
    progressPct: 0.34,
    minutesTotal: 980,
    sessions: 22,
    streakDays: 0,
    tags: ['memorization', 'pedaling'],
    plan: [
      { text: 'Bars 1–14 from memory at 38 bpm.', done: true },
      { text: 'Map every pedal change in the middle section.', done: false, active: true },
      { text: 'Voice the inner moving line in mm. 27–35.', done: false },
    ],
    sections: [
      { id: 's1', range: 'mm. 1–14',  label: 'Opening',          subtitle: 'pp, sans rigueur',    heat: 0.62, conf: 3, tempo: 'q.=38', reps: 26 },
      { id: 's2', range: 'mm. 15–26', label: 'First arrival',     subtitle: 'animez peu à peu',    heat: 0.40, conf: 2, tempo: 'q.=46', reps: 18, struggle: true },
      { id: 's3', range: 'mm. 27–42', label: 'Middle current',    subtitle: 'inner voices, blurred', heat: 0.22, conf: 1, tempo: 'q.=50', reps: 11, struggle: true },
      { id: 's4', range: 'mm. 43–72', label: 'Return & dissolve', subtitle: '— not yet read —',     heat: 0.05, conf: 0, tempo: '—',     reps: 4 },
    ],
    notes: [
      { when: '2026-05-15', body: 'Re-read bars 27–35. Inner-voice phrasing is the *whole* thing. Slow it down.' },
    ],
    history: [
      { date: 'May 15', mins: 38 }, { date: 'May 13', mins: 22 }, { date: 'May 11', mins: 30 },
    ],
  },
  {
    id: 'satie-gymno-1',
    instrument: 'piano',
    title: 'Gymnopédie No. 1',
    subtitle: '',
    composer: 'Erik Satie',
    year: 1888,
    key: 'D major',
    meter: '3/4',
    tempo: { mark: 'Lent et douloureux', bpm: 60 },
    duration: '3:20',
    measures: 78,
    depth: 'deep',
    depthLabel: 'mesopelagic',
    started: '2025-11-04',
    lastTouched: '2026-05-10',
    progressPct: 0.88,
    minutesTotal: 1420,
    sessions: 58,
    streakDays: 0,
    tags: ['memorized', 'tone color'],
    plan: [],
    sections: [],
    notes: [],
    history: [{ date: 'May 10', mins: 14 }],
  },

  /* —— Guitar —— */
  {
    id: 'tarrega-recuerdos',
    instrument: 'guitar',
    title: 'Recuerdos de la Alhambra',
    subtitle: '',
    composer: 'Francisco Tárrega',
    year: 1899,
    key: 'A minor',
    meter: '3/4',
    tempo: { mark: 'Andante', bpm: 84 },
    duration: '4:45',
    measures: 86,
    depth: 'shallow',
    depthLabel: 'bathyal',
    started: '2026-01-08',
    lastTouched: '2026-05-19',
    progressPct: 0.48,
    minutesTotal: 1640,
    sessions: 39,
    streakDays: 8,
    tags: ['tremolo', 'right-hand stamina'],
    plan: [
      { text: 'Tremolo drill: p-a-m-i on open A, 80 bpm, four minutes.', done: true },
      { text: 'Bars 1–16: even tremolo, no rushing the *p*.', done: false, active: true },
      { text: 'Voice the bass thumb — let the melody float, don\'t shove.', done: false },
    ],
    sections: [
      { id: 's1', range: 'mm. 1–16',  label: 'A-minor opening',   subtitle: 'establish the tremolo', heat: 0.56, conf: 3, tempo: 'q=72', reps: 44 },
      { id: 's2', range: 'mm. 17–32', label: 'Modulation to A maj', subtitle: 'the sun comes out',  heat: 0.34, conf: 2, tempo: 'q=68', reps: 28, struggle: true },
      { id: 's3', range: 'mm. 33–48', label: 'Episode',            subtitle: 'tremolo over arpeggios', heat: 0.18, conf: 1, tempo: 'q=62', reps: 14, struggle: true },
      { id: 's4', range: 'mm. 49–86', label: 'Return',             subtitle: '— not started —',       heat: 0.03, conf: 0, tempo: '—',    reps: 0 },
    ],
    notes: [
      { when: '2026-05-19', body: 'Tremolo evenness improved when I *stopped* counting and just listened for the gap between *p* and *a*.' },
      { when: '2026-05-12', body: 'Right shoulder tension creeping back. Drop it before bar 17 every time.' },
    ],
    history: [
      { date: 'May 19', mins: 36 }, { date: 'May 17', mins: 42 }, { date: 'May 16', mins: 28 },
      { date: 'May 14', mins: 40 }, { date: 'May 12', mins: 25 },
    ],
  },
  {
    id: 'bach-bouree',
    instrument: 'guitar',
    title: 'Bourrée in E minor',
    subtitle: 'BWV 996',
    composer: 'J. S. Bach',
    year: 1712,
    key: 'E minor',
    meter: '2/2',
    tempo: { mark: 'Allegro', bpm: 92 },
    duration: '2:50',
    measures: 38,
    depth: 'deep',
    depthLabel: 'mesopelagic',
    started: '2025-08-12',
    lastTouched: '2026-05-13',
    progressPct: 0.81,
    minutesTotal: 1980,
    sessions: 72,
    streakDays: 0,
    tags: ['counterpoint', 'voicing'],
    plan: [],
    sections: [],
    notes: [],
    history: [{ date: 'May 13', mins: 18 }, { date: 'May 8', mins: 22 }],
  },

  /* —— Voice —— */
  {
    id: 'caldara-sebben',
    instrument: 'voice',
    title: 'Sebben, crudele',
    subtitle: 'aria · 24 Italian Songs',
    composer: 'Antonio Caldara',
    year: 1710,
    key: 'F minor',
    meter: '3/8',
    tempo: { mark: 'Andante', bpm: 72 },
    duration: '2:40',
    measures: 42,
    depth: 'shallow',
    depthLabel: 'mesopelagic',
    started: '2026-04-02',
    lastTouched: '2026-05-18',
    progressPct: 0.55,
    minutesTotal: 720,
    sessions: 18,
    streakDays: 2,
    tags: ['breath', 'italian diction'],
    plan: [],
    sections: [],
    notes: [],
    history: [{ date: 'May 18', mins: 22 }],
  },
];

/* ─── Composition / sketches ──────────────────────────── */
const SKETCHES = [
  {
    id: 'litany',
    title: 'Litany for a Falling Whale',
    subtitle: 'song cycle · in progress',
    instrument: 'compose',
    status: 'drafting',
    started: '2026-03-04',
    lastTouched: '2026-05-19',
    keyArea: 'D♭ → F♯ minor',
    meter: '6/8',
    duration: '~6:00',
    tags: ['cycle', 'piano + voice'],
    lyric:
`[verse 1]
Down past the sun line, past the cold,
past the place where the colors fold —
a body falls, an island slow,
feeding what we never know.

[chorus]
Litany of bone, litany of slow,
litany of names we do not know.
Eat. Eat. Eat.

[verse 2]
A hagfish, an isopod, a worm with a hat of pale gold,
the carrion at the bottom of the world.

[bridge — unfinished]
{ work in F♯ minor here?
  break the meter to 5/8 for two bars
  voice unaccompanied: *what was once an animal …* }

[chorus reprise]
Litany of bone, litany of slow —
                                        the litany goes.`,
    plan: [
      { text: 'Find the cadence for the chorus — V vs. ♭VI.', done: true },
      { text: 'Bridge: try 5/8, two bars, voice alone.', done: false, active: true },
      { text: 'Score the piano part for verse 2 — minimal.', done: false },
      { text: 'Demo by June 1.', done: false },
    ],
  },
  {
    id: 'song-blue-light',
    title: 'Blue Light, Blue Light',
    subtitle: 'song · early sketch',
    instrument: 'compose',
    status: 'sketching',
    started: '2026-04-29',
    lastTouched: '2026-05-12',
    keyArea: 'A♭ major',
    meter: '4/4',
    duration: '?',
    tags: ['solo voice', 'minimal'],
    lyric:
`[verse]
Blue light on the cup, blue light on the glass —
the kettle, the morning, the
                              — (chord?)
                              — (a long held A♭ over E♭, then drop to F minor)

[chorus stub]
Blue light, blue light —
hold me to the early hour.

(not sure about the title yet.)`,
    plan: [
      { text: 'Decide between strophic and verse/chorus form.', done: false, active: true },
      { text: 'Set the F-minor turn against the A♭ pedal.', done: false },
    ],
  },
  {
    id: 'piano-piece-fathom',
    title: 'Fathom (study)',
    subtitle: 'solo piano · etude',
    instrument: 'compose',
    status: 'finished draft',
    started: '2026-01-20',
    lastTouched: '2026-04-30',
    keyArea: 'C♯ minor',
    meter: 'free',
    duration: '3:30',
    tags: ['piano', 'etude', 'recorded'],
    lyric:
`[program note]
Six descending intervals, repeated and decayed.
The right hand starts at the top of the keyboard
and walks down one register at a time, the left
holding a single low C♯ as a pedal — like a sounding line
slowly paying out.

[structure]
A — 16 bars at the top register
B — modulate by descent (E → A → D → G → C)
A' — return, voice the very last note as a fermata

[recording notes]
Take 4 (Apr 30) was the keeper. Roll-off the high mics
to suggest the depth.`,
    plan: [
      { text: 'Engrave in Dorico.', done: true },
      { text: 'Send to M. for feedback.', done: false, active: true },
    ],
  },
];

/* ─── Today / queue ───────────────────────────────────── */
const TODAY_QUEUE = [
  { id: 'q1', pieceId: 'chopin-9-2',         label: 'Chopin · Nocturne E♭', sub: 'Bars 17–24, slow', mins: 25 },
  { id: 'q2', pieceId: 'tarrega-recuerdos',  label: 'Tárrega · Recuerdos',  sub: 'Tremolo drill + bars 17–32', mins: 30 },
  { id: 'q3', pieceId: 'debussy-clair',      label: 'Debussy · Clair de lune', sub: 'Pedaling map, mm. 27–42', mins: 20 },
  { id: 'q4', pieceId: 'litany',             label: 'Compose · Litany',     sub: 'Bridge — try 5/8', mins: 15 },
];

/* ─── Stats ───────────────────────────────────────────── */
// 53 weeks × 7 days heatmap, deterministic-ish
function buildHeatmap() {
  const cells = [];
  let seed = 9173;
  const rng = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let i = 0; i < 53 * 7; i++) {
    const day = Math.floor(i / 7);                    // overall day position
    const recent = day > 53*7 - 100;                  // last ~100 days denser
    const r = rng();
    let level;
    if (r < 0.34) level = 0;
    else if (r < 0.55) level = 1;
    else if (r < 0.78) level = 2;
    else if (r < 0.92) level = 3;
    else level = 4;
    if (!recent && r > 0.6) level = Math.max(0, level - 1);
    if (i > 53*7 - 4) level = 0; // upcoming days
    cells.push(level);
  }
  return cells;
}
const HEATMAP = buildHeatmap();

const TIME_BY_PIECE = [
  { name: 'Chopin — Nocturne E♭ Op. 9 No. 2',   who: 'piano',   pct: 0.92, mins: 1840 },
  { name: 'Tárrega — Recuerdos de la Alhambra', who: 'guitar',  pct: 0.82, mins: 1640 },
  { name: 'Litany for a Falling Whale',         who: 'compose', pct: 0.46, mins: 920 },
  { name: 'Debussy — Clair de lune',            who: 'piano',   pct: 0.49, mins: 980 },
  { name: 'Bach — Bourrée BWV 996',             who: 'guitar',  pct: 0.40, mins: 800 },
  { name: 'Satie — Gymnopédie No. 1',           who: 'piano',   pct: 0.36, mins: 720 },
  { name: 'Caldara — Sebben, crudele',          who: 'voice',   pct: 0.18, mins: 360 },
];

// Bars per day of the week, segments per instrument (mins)
const WEEK = [
  { day: 'Mon', date: 13, piano: 22, guitar: 12, compose: 8 },
  { day: 'Tue', date: 14, piano: 30, guitar: 28, compose: 0 },
  { day: 'Wed', date: 15, piano: 18, guitar: 22, compose: 14 },
  { day: 'Thu', date: 16, piano: 28, guitar: 0,  compose: 12 },
  { day: 'Fri', date: 17, piano: 42, guitar: 18, compose: 0 },
  { day: 'Sat', date: 18, piano: 12, guitar: 20, compose: 0 },
  { day: 'Sun', date: 19, piano: 42, guitar: 36, compose: 0, today: true },
];

const RECENT = [
  { when: 'today · 06:42', what: 'Tárrega · Recuerdos',    sub: 'guitar', mins: 36, mood: 4 },
  { when: 'today · 05:50', what: 'Chopin · Nocturne E♭',   sub: 'piano',  mins: 42, mood: 5 },
  { when: 'yest. · 18:10', what: 'Caldara · Sebben',       sub: 'voice',  mins: 22, mood: 3 },
  { when: 'yest. · 07:08', what: 'Bach · Bourrée',         sub: 'guitar', mins: 20, mood: 4 },
  { when: 'May 17 · 19:32', what: 'Debussy · Clair de lune', sub: 'piano', mins: 38, mood: 3 },
  { when: 'May 17 · 07:11', what: 'Tárrega · Recuerdos',   sub: 'guitar', mins: 42, mood: 4 },
  { when: 'May 16 · 18:45', what: 'Litany — bridge sketch', sub: 'compose', mins: 35, mood: 5 },
  { when: 'May 16 · 07:30', what: 'Chopin · Nocturne E♭',  sub: 'piano',  mins: 55, mood: 4 },
];

/* ─── Bioluminescent practice koans (random side quote) ── */
const QUOTES = [
  { text: 'Slow practice is a kind of listening. You sound the depth.', who: '— Field notes, 2026' },
  { text: 'A bar at half tempo costs nothing and pays for itself by Sunday.', who: '— Practice journal, II.4' },
  { text: 'If you cannot sing it, you cannot play it.', who: '— Attrib. Margaret Saunders' },
];

/* ─── Export to window ────────────────────────────────── */
Object.assign(window, {
  SOUND_DATA: {
    INSTRUMENTS, PIECES, SKETCHES, TODAY_QUEUE,
    HEATMAP, TIME_BY_PIECE, WEEK, RECENT, QUOTES,
  },
});
