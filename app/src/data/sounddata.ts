import type { Instrument, InstrumentId, Piece, QueueItem, Quote } from './schemas';

export const INSTRUMENTS: Instrument[] = [
  { id: 'piano', name: 'Piano', latin: 'Pianoforte', count: 4 },
  { id: 'guitar', name: 'Classical Guitar', latin: 'Chitarra', count: 2 },
  { id: 'voice', name: 'Voice', latin: 'Vox', count: 1 },
  { id: 'compose', name: 'Composition', latin: 'Compositio', count: 3 },
];

export const PIECES: Piece[] = [
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
    depth: 'shallow',
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
      { id: 's1', range: 'mm. 1–8',   label: 'Opening theme',         subtitle: 'cantabile, simple',          heat: 0.85, conf: 4, tempo: 'q=60',   reps: 38 },
      { id: 's2', range: 'mm. 9–16',  label: 'Theme · ornamented',    subtitle: 'añadidos, the first turn',   heat: 0.62, conf: 3, tempo: 'q=60',   reps: 29 },
      { id: 's3', range: 'mm. 17–24', label: 'Figuration variation',  subtitle: 'where the right hand opens', heat: 0.28, conf: 2, tempo: 'q=44',   reps: 51, struggle: true, active: true },
      { id: 's4', range: 'mm. 25–28', label: 'Cadenza',               subtitle: 'the unmeasured run',         heat: 0.12, conf: 1, tempo: 'rubato', reps: 22, struggle: true },
      { id: 's5', range: 'mm. 29–34', label: 'Return & coda',         subtitle: 'fade to nothing',            heat: 0.74, conf: 4, tempo: 'q=58',   reps: 18 },
    ],
    notes: [
      { when: '2026-05-19 · last session', body: 'Bar 21 LH leap — keep the elbow loose. Felt the connection finally when I stopped *aiming* at the bottom note.' },
      { when: '2026-05-17',                body: 'Right-hand thirds in bar 14 are settling. Pedal change is now on beat 4 of the previous bar — much cleaner.' },
      { when: '2026-05-12',                body: 'Recorded a run-through. Tempo drifts faster between bars 17 and 24 — every time. Probably tension.' },
      { when: '2026-05-04 · teacher',      body: '"The rubato has to *breathe*, not lurch." She demonstrated by singing the melody first, then playing what she sang.' },
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
    plan: [],
    sections: [],
    notes: [],
    history: [],
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
    history: [],
  },
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
    plan: [],
    sections: [],
    notes: [],
    history: [],
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
    history: [],
  },
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
    history: [],
  },
];

export const TODAY_QUEUE: QueueItem[] = [
  { id: 'q1', pieceId: 'chopin-9-2',        label: 'Chopin · Nocturne E♭',     sub: 'Bars 17–24, slow',           mins: 25 },
  { id: 'q2', pieceId: 'tarrega-recuerdos', label: 'Tárrega · Recuerdos',      sub: 'Tremolo drill + bars 17–32', mins: 30 },
  { id: 'q3', pieceId: 'debussy-clair',     label: 'Debussy · Clair de lune',  sub: 'Pedaling map, mm. 27–42',    mins: 20 },
  { id: 'q4', pieceId: 'chopin-9-2',        label: 'Compose · Litany',         sub: 'Bridge — try 5/8',           mins: 15 },
];

export const QUOTES: Quote[] = [
  { text: 'Slow practice is a kind of listening. You sound the depth.', who: '— Field notes, 2026' },
  { text: 'A bar at half tempo costs nothing and pays for itself by Sunday.', who: '— Practice journal, II.4' },
  { text: 'If you cannot sing it, you cannot play it.', who: '— Attrib. Margaret Saunders' },
];

export const TODAY_TOTAL_MIN = 78;
export const WEEK_TOTAL_MIN = 364;

/* ─── Stats data ──────────────────────────────────────── */

/** "Today" for the journal — fixed so the mock data is deterministic. */
export const JOURNAL_TODAY = new Date('2026-05-29');

export interface HeatDay {
  /** ISO date (yyyy-mm-dd). */
  date: string;
  /** Practice minutes, or null for days in the future. */
  minutes: number | null;
}

/**
 * 53 weeks of daily practice minutes ending on the week containing
 * JOURNAL_TODAY. Index 0 is a Sunday, so a calendar grid can place each day at
 * column = floor(i / 7), row = i % 7. Future days are null. Deterministic via a
 * tiny LCG so the chart is stable across reloads.
 */
function buildHeatmap(): HeatDay[] {
  const today = JOURNAL_TODAY;
  // This week's Sunday, then back 52 weeks → the grid's first Sunday.
  const start = new Date(today);
  start.setDate(start.getDate() - today.getDay() - 52 * 7);

  let seed = 9173;
  const rng = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const cells: HeatDay[] = [];
  for (let i = 0; i < 53 * 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = d.toISOString().slice(0, 10);

    if (d > today) {
      cells.push({ date: iso, minutes: null });
      continue;
    }
    // Recent ~100 days trend denser; older days thin out.
    const recent = i > 53 * 7 - 100;
    const r = rng();
    let minutes: number;
    if (r < 0.3) minutes = 0;
    else if (r < 0.55) minutes = Math.round(15 + r * 25);
    else if (r < 0.8) minutes = Math.round(40 + r * 35);
    else minutes = Math.round(75 + r * 60);
    if (!recent && r > 0.55) minutes = Math.round(minutes * 0.55);
    cells.push({ date: iso, minutes });
  }
  return cells;
}

export const HEATMAP: HeatDay[] = buildHeatmap();

export interface TimeByPiece {
  name: string;
  who: InstrumentId;
  mins: number;
}

export const TIME_BY_PIECE: TimeByPiece[] = [
  { name: 'Chopin — Nocturne E♭ Op. 9 No. 2',   who: 'piano',   mins: 1840 },
  { name: 'Tárrega — Recuerdos de la Alhambra', who: 'guitar',  mins: 1640 },
  { name: 'Litany for a Falling Whale',         who: 'compose', mins: 920 },
  { name: 'Debussy — Clair de lune',            who: 'piano',   mins: 980 },
  { name: 'Bach — Bourrée BWV 996',             who: 'guitar',  mins: 800 },
  { name: 'Satie — Gymnopédie No. 1',           who: 'piano',   mins: 720 },
  { name: 'Caldara — Sebben, crudele',          who: 'voice',   mins: 360 },
];

export interface WeekDay {
  day: string;
  date: number;
  piano: number;
  guitar: number;
  compose: number;
  today?: boolean;
}

export const WEEK: WeekDay[] = [
  { day: 'Mon', date: 23, piano: 22, guitar: 12, compose: 8 },
  { day: 'Tue', date: 24, piano: 30, guitar: 28, compose: 0 },
  { day: 'Wed', date: 25, piano: 18, guitar: 22, compose: 14 },
  { day: 'Thu', date: 26, piano: 28, guitar: 0,  compose: 12 },
  { day: 'Fri', date: 27, piano: 42, guitar: 18, compose: 0 },
  { day: 'Sat', date: 28, piano: 12, guitar: 20, compose: 0 },
  { day: 'Sun', date: 29, piano: 42, guitar: 36, compose: 0, today: true },
];

export interface RecentSession {
  when: string;
  what: string;
  sub: string;
  mins: number;
  mood: number;
}

export const RECENT: RecentSession[] = [
  { when: 'today · 06:42',  what: 'Tárrega · Recuerdos',     sub: 'guitar',   mins: 36, mood: 4 },
  { when: 'today · 05:50',  what: 'Chopin · Nocturne E♭',    sub: 'piano',    mins: 42, mood: 5 },
  { when: 'yest. · 18:10',  what: 'Caldara · Sebben',        sub: 'voice',    mins: 22, mood: 3 },
  { when: 'yest. · 07:08',  what: 'Bach · Bourrée',          sub: 'guitar',   mins: 20, mood: 4 },
  { when: 'May 27 · 19:32', what: 'Debussy · Clair de lune', sub: 'piano',    mins: 38, mood: 3 },
  { when: 'May 27 · 07:11', what: 'Tárrega · Recuerdos',     sub: 'guitar',   mins: 42, mood: 4 },
  { when: 'May 26 · 18:45', what: 'Litany — bridge sketch',  sub: 'compose',  mins: 35, mood: 5 },
  { when: 'May 26 · 07:30', what: 'Chopin · Nocturne E♭',    sub: 'piano',    mins: 55, mood: 4 },
];
