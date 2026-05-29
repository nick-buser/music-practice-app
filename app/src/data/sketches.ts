import type { Sketch } from './schemas';

/**
 * Engraved chorus harmony for "Litany" — a grand-staff whole-note reduction of
 * i — VI — v — iv — i⁶ in F♯ minor, rendered by Verovio under the harmony tab.
 */
const LITANY_HARMONY_ABC = `X:1
T:Chorus harmony
M:4/4
L:1
K:F#min
%%score (1 2)
V:1 clef=treble
V:2 clef=bass
[V:1] [FAc] [FAce] [EGB] [^def] [FAc] |
[V:2] F, D, C, B,, A,, |`;

export const SKETCHES: Sketch[] = [
  {
    id: 'litany',
    title: 'Litany for a Falling Whale',
    subtitle: 'song cycle · in progress',
    status: 'drafting',
    started: '2026-03-04',
    lastTouched: '2026-05-19',
    keyArea: 'D♭ → F♯ minor',
    meter: '6/8',
    duration: '~6:00',
    tags: ['cycle', 'piano + voice'],
    lyric: `[verse 1]
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
  voice unaccompanied: what was once an animal … }

[chorus reprise]
Litany of bone, litany of slow —
                                        the litany goes.`,
    plan: [
      { text: 'Find the cadence for the chorus — V vs. ♭VI.', done: true },
      { text: 'Bridge: try 5/8, two bars, voice alone.', done: false, active: true },
      { text: 'Score the piano part for verse 2 — minimal.', done: false },
      { text: 'Demo by June 1.', done: false },
    ],
    harmony: [
      { symbol: 'F♯m', roman: 'i' },
      { symbol: 'D maj9', roman: 'VI' },
      { symbol: 'C♯m7', roman: 'v' },
      { symbol: 'B add4', roman: 'iv' },
      { symbol: 'F♯m / A', roman: 'i⁶' },
    ],
    harmonyAbc: LITANY_HARMONY_ABC,
  },
  {
    id: 'song-blue-light',
    title: 'Blue Light, Blue Light',
    subtitle: 'song · early sketch',
    status: 'sketching',
    started: '2026-04-29',
    lastTouched: '2026-05-12',
    keyArea: 'A♭ major',
    meter: '4/4',
    duration: '?',
    tags: ['solo voice', 'minimal'],
    lyric: `[verse]
Blue light on the cup, blue light on the glass —
the kettle, the morning, the
                              — (chord?)
                              — (a long held A♭ over E♭, then drop to F minor)

[chorus stub]
Blue light, blue light —
hold me to the early hour.

{ not sure about the title yet. }`,
    plan: [
      { text: 'Decide between strophic and verse/chorus form.', done: false, active: true },
      { text: 'Set the F-minor turn against the A♭ pedal.', done: false },
    ],
  },
  {
    id: 'piano-piece-fathom',
    title: 'Fathom (study)',
    subtitle: 'solo piano · etude',
    status: 'finished draft',
    started: '2026-01-20',
    lastTouched: '2026-04-30',
    keyArea: 'C♯ minor',
    meter: 'free',
    duration: '3:30',
    tags: ['piano', 'etude', 'recorded'],
    lyric: `[program note]
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

export const ARCHIVED_SKETCHES = [
  { title: 'Vellichor (study)', sub: 'piano · march' },
  { title: 'Threnody for the Last Vaquita', sub: 'voice + strings' },
  { title: 'Song without a name', sub: 'unfinished' },
  { title: 'Étude in C♯', sub: 'shelved' },
];

export interface ScratchIdea {
  when: string;
  what: string;
  tags: string[];
}

export const SCRATCH_IDEAS: ScratchIdea[] = [
  { when: 'tue · 23:14', what: 'A countermelody for the *Litany* chorus — sing the bass line up an octave, like an answering voice.', tags: ['litany', 'arrangement'] },
  { when: 'sat · 07:02', what: 'Title idea: *the great sea-shell*. Maybe a piano nocturne.', tags: ['title'] },
  { when: 'thu · 18:40', what: 'Form sketch: ABA with a *void* in the middle — 8 bars of held silence, then return.', tags: ['form', 'experiment'] },
  { when: 'wed · 06:55', what: 'The chord *F♯m add9 over E* — could be the bridge for *Blue Light*.', tags: ['blue-light'] },
  { when: 'mon · 22:11', what: 'Try setting the Mary Oliver poem fragment — *the world offers itself.*', tags: ['lyric'] },
];

export const VOICE_MEMOS = [
  { when: 'today · 19:02', label: 'humming the bridge — F♯m to A', len: '0:34', keeper: true },
  { when: 'mon · 22:18',  label: 'verse 1 / piano only',          len: '1:22', keeper: false },
  { when: 'sun · 08:11',  label: 'chorus alt. melody (rejected)', len: '0:48', keeper: false },
  { when: 'sat · 15:32',  label: 'first sketch · the whole shape', len: '3:04', keeper: false },
];
