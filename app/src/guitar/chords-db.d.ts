// Hand-written type for the chords-db JSON so tsc doesn't deep-infer the (huge)
// literal type of the 2000-chord file.
declare module '@tombatossals/chords-db/lib/guitar.json' {
  interface DbPosition {
    frets: number[]; // 6 values, low-E first; -1 muted, 0 open, else fret (relative to baseFret)
    fingers: number[]; // 6 values, 0 = none
    baseFret: number;
    barres: number[];
    capo?: boolean;
    midi: number[];
  }
  interface DbChord {
    key: string;
    suffix: string;
    positions: DbPosition[];
  }
  const db: {
    keys: string[]; // display names, indexed by pitch class
    suffixes: string[];
    chords: Record<string, DbChord[]>;
  };
  export default db;
}
