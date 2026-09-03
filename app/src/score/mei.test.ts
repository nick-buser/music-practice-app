import { describe, expect, it } from 'vitest';

import {
  fMajorSpelling,
  fiveEightGrouped,
  gMajorSpelling,
  grandStaffExercise,
  pickupAndComplement,
  POSITIVE_FIXTURES,
  sixEight,
  unevenTriplet,
} from './__fixtures__';
import { beatGroups, keySigAttr, toMei } from './mei';
import { formatFraction } from './fraction';

describe('toMei — determinism', () => {
  it.each(POSITIVE_FIXTURES)('%s is byte-identical across two runs', (_name, make) => {
    // Two independently built documents, so this catches an id or an iteration
    // order that depends on anything but the model.
    expect(toMei(make())).toBe(toMei(make()));
  });

  it.each(POSITIVE_FIXTURES)('%s matches its committed snapshot', (name, make) => {
    expect(toMei(make())).toMatchSnapshot(name);
  });
});

describe('toMei — document frame', () => {
  const mei = toMei(grandStaffExercise());

  it('always emits a meiHead — Verovio warns without one (exp19)', () => {
    expect(mei).toContain('<meiHead>');
    expect(mei).toContain('<title>Grand staff exercise</title>');
  });

  it('gives the five document-level elements their fixed ids', () => {
    expect(mei).toContain('<mdiv xml:id="mdiv">');
    expect(mei).toContain('<score xml:id="score">');
    expect(mei).toContain('<scoreDef xml:id="sdef"');
    expect(mei).toContain('<staffGrp xml:id="sg"');
    expect(mei).toContain('<section xml:id="sec">');
  });

  it('puts the initial key, meter and tempo on the first scoreDef', () => {
    expect(mei).toContain(
      '<scoreDef xml:id="sdef" midi.bpm="96" keysig="1s" key.mode="major" meter.count="4" meter.unit="4">',
    );
  });

  it('braces the grand staff and gives each staffDef the StaffDef id', () => {
    const doc = grandStaffExercise();
    expect(mei).toContain('symbol="brace" bar.thru="true"');
    expect(mei).toContain(`<staffDef xml:id="${doc.staves[0].id}" n="1" lines="5" clef.shape="G" clef.line="2"/>`);
    expect(mei).toContain(`<staffDef xml:id="${doc.staves[1].id}" n="2" lines="5" clef.shape="F" clef.line="4"/>`);
  });
});

describe('keySigAttr', () => {
  it('is `{n}s`, `{n}f` or `0`', () => {
    expect(keySigAttr({ fifths: 0, mode: 'major' })).toBe('0');
    expect(keySigAttr({ fifths: 1, mode: 'major' })).toBe('1s');
    expect(keySigAttr({ fifths: 7, mode: 'minor' })).toBe('7s');
    expect(keySigAttr({ fifths: -1, mode: 'major' })).toBe('1f');
    expect(keySigAttr({ fifths: -7, mode: 'minor' })).toBe('7f');
  });
});

describe('toMei — derived ids', () => {
  const doc = grandStaffExercise();
  const mei = toMei(doc);

  it('names every staff `${measure}-s{n}`', () => {
    expect(mei).toContain(`<staff xml:id="${doc.measures[0].id}-s1" n="1">`);
    expect(mei).toContain(`<staff xml:id="${doc.measures[0].id}-s2" n="2">`);
  });

  it('names the tie after its start note', () => {
    const start = doc.measures[1].staves[0].voices[0].events[2];
    const stop = doc.measures[2].staves[0].voices[0].events[0];
    expect(mei).toContain(`<tie xml:id="${start.id}-tie" startid="#${start.id}" endid="#${stop.id}"/>`);
  });

  it('names the beam after its first member', () => {
    const first = doc.measures[0].staves[0].voices[0].events[0];
    expect(mei).toContain(`<beam xml:id="${first.id}-beam">`);
  });

  it('names the tempo, system break and change scoreDef after their measure', () => {
    const m5 = doc.measures[4];
    expect(mei).toContain(`<sb xml:id="${m5.id}-sb"/>`);
    expect(mei).toContain(`<scoreDef xml:id="${m5.id}-sdef"`);
    expect(mei).toContain(`<tempo xml:id="${m5.id}-tempo"`);
  });

  it('names articulations and fingerings after their owner', () => {
    const staccato = doc.measures[1].staves[0].voices[0].events[1];
    expect(mei).toContain(`<artic xml:id="${staccato.id}-a0" artic="stacc"/>`);
    const fingered = doc.measures[0].staves[0].voices[0].events[0];
    expect(mei).toContain(`<fing xml:id="${fingered.id}-fing" staff="1" startid="#${fingered.id}">1</fing>`);
  });
});

describe('toMei — pitch and accidentals', () => {
  it('emits accid.ges on every altered note, printed or not (exp12)', () => {
    const doc = grandStaffExercise();
    const mei = toMei(doc);
    // F#5 in G major prints nothing but must still sound as 78.
    const fSharp = doc.measures[1].staves[0].voices[0].events[0];
    expect(fSharp.kind).toBe('tuplet');
    if (fSharp.kind === 'tuplet') {
      const line = mei.split('\n').find((l) => l.includes(`xml:id="${fSharp.events[0].id}"`)) as string;
      expect(line).toContain('accid.ges="s"');
      expect(line).not.toContain(' accid="');
    }
  });

  it('uses the gestural vocabulary s|ss|f|ff and never x (exp22 C)', () => {
    const g = toMei(gMajorSpelling());
    const f = toMei(fMajorSpelling());
    for (const mei of [g, f]) {
      expect(mei).not.toMatch(/accid\.ges="x"/);
    }
    expect(g).toContain('accid="x" accid.ges="ss"'); // F##
    expect(g).toContain('accid="ff" accid.ges="ff"'); // Bbb
    expect(f).toContain('accid="n"'); // B natural against a flat key signature
  });

  it('puts a cautionary accidental in an <accid> child and nothing on the note (exp22 B)', () => {
    const doc = gMajorSpelling();
    const mei = toMei(doc);
    const courtesy = doc.measures[1].staves[0].voices[0].events[0];
    const start = mei.indexOf(`xml:id="${courtesy.id}"`);
    const noteTag = mei.slice(mei.lastIndexOf('<', start), mei.indexOf('>', start) + 1);
    expect(noteTag).not.toContain('accid');
    expect(mei).toContain(
      `<accid xml:id="${courtesy.id}-acc" accid="s" accid.ges="s" func="caution" enclose="paren"/>`,
    );
  });
});

describe('toMei — beaming (exp09: Verovio beams nothing itself)', () => {
  const beamsIn = (mei: string): number => (mei.match(/<beam /g) ?? []).length;

  it('beams the four eighths of a 4/4 beat pair as two beams', () => {
    const doc = grandStaffExercise();
    const mei = toMei(doc);
    const m1 = mei.slice(mei.indexOf(`<measure xml:id="${doc.measures[0].id}"`), mei.indexOf(`<measure xml:id="${doc.measures[1].id}"`));
    // G A B C are two quarter-beat groups → two beams, not one.
    expect(beamsIn(m1)).toBe(2);
  });

  it('beams 6/8 in dotted-quarter groups', () => {
    const mei = toMei(sixEight());
    expect(beatGroups({ count: 6, unit: 8 }).map(formatFraction)).toEqual(['0', '3/2']);
    // Bar 1: six eighths → two beams. Bar 2: a dotted quarter then three
    // eighths spanning the second group → one beam.
    expect(beamsIn(mei)).toBe(3);
  });

  it('follows TimeSig.grouping in 5/8', () => {
    expect(beatGroups({ count: 5, unit: 8, grouping: [2, 3] }).map(formatFraction)).toEqual(['0', '1']);
    expect(beatGroups({ count: 7, unit: 8, grouping: [3, 2, 2] }).map(formatFraction)).toEqual(['0', '3/2', '5/2']);
    const mei = toMei(fiveEightGrouped());
    // Bar 1: 2 + 3 eighths → two beams. Bar 2: a quarter then three eighths
    // that all fall in the second group → one beam.
    expect(beamsIn(mei)).toBe(3);
  });

  it('leaves a lone sub-quarter event flagged rather than in a one-member beam (exp22 I)', () => {
    const doc = sixEight();
    const mei = toMei(doc);
    // Bar 2's RH is a dotted quarter then three eighths: the dotted quarter is
    // not beamable and must not open a beam of its own.
    const m2 = mei.slice(mei.indexOf(`<measure xml:id="${doc.measures[1].id}"`));
    expect(beamsIn(m2)).toBe(1);
  });

  it('nests beams inside the tuplet, not the other way round', () => {
    const doc = unevenTriplet();
    const mei = toMei(doc);
    const tuplet = doc.measures[0].staves[0].voices[0].events[0];
    const open = mei.indexOf(`<tuplet xml:id="${tuplet.id}"`);
    const beam = mei.indexOf('<beam ', open);
    expect(open).toBeGreaterThan(-1);
    expect(beam).toBeGreaterThan(open);
    expect(mei.slice(0, open)).not.toContain(`<beam xml:id="${tuplet.id}`);
  });
});

describe('toMei — measures, meters and marks', () => {
  it('marks a pickup and its complement metcon="false" and numbers the pickup 0', () => {
    const doc = pickupAndComplement();
    const mei = toMei(doc);
    expect(mei).toContain(`<measure xml:id="${doc.measures[0].id}" n="0" metcon="false">`);
    expect(mei).toContain(`<measure xml:id="${doc.measures[1].id}" n="1">`);
    expect(mei).toContain(`<measure xml:id="${doc.measures[3].id}" n="3" metcon="false">`);
    // exp22 H: an mRest in a short measure is timed as a full bar, so those
    // measures carry explicit rests.
    expect(mei.slice(0, mei.indexOf(`<measure xml:id="${doc.measures[1].id}"`))).not.toContain('<mRest');
  });

  it('numbers measures from 1 when there is no pickup', () => {
    const doc = grandStaffExercise();
    expect(toMei(doc)).toContain(`<measure xml:id="${doc.measures[0].id}" n="1">`);
  });

  it('re-declares only what changed at a key change', () => {
    const doc = grandStaffExercise();
    const mei = toMei(doc);
    const sdef = mei.split('\n').find((l) => l.includes(`xml:id="${doc.measures[4].id}-sdef"`)) as string;
    expect(sdef).toContain('keysig="1f"');
    expect(sdef).toContain('key.mode="major"');
    expect(sdef).not.toContain('meter.count');
  });

  it('normalizes tempo to quarter-note terms and composes the visible text (exp17, exp22 E)', () => {
    const mei = toMei(sixEight());
    // ♩. = 60 is 90 quarter-notes per minute; without midi.bpm Verovio would
    // time a dotted mm.unit as 4/3 and run it at 80.
    expect(mei).toContain('midi.bpm="90" mm="60" mm.unit="4" mm.dots="1"');
    expect(mei).toContain('Allegretto <rend fontfam="smufl">&#xECA5;&#xECB7;</rend> = 60');
    expect(mei).toContain('<scoreDef xml:id="sdef" midi.bpm="90"');
  });

  it('sets stem.dir only where two voices share a staff', () => {
    const doc = grandStaffExercise();
    const mei = toMei(doc);
    const m7 = mei.slice(mei.indexOf(`<measure xml:id="${doc.measures[6].id}"`), mei.indexOf(`<measure xml:id="${doc.measures[7].id}"`));
    expect(m7).toContain('stem.dir="up"');
    expect(m7).toContain('stem.dir="down"');
    const m8 = mei.slice(mei.indexOf(`<measure xml:id="${doc.measures[7].id}"`));
    expect(m8).not.toContain('stem.dir');
  });

  it('hoists spanners and dynamics to measure level (exp01)', () => {
    const doc = grandStaffExercise();
    const mei = toMei(doc);
    const slur = doc.measures[0].spanners[0];
    const dyn = doc.measures[0].directions[0];
    expect(mei).toContain(`<slur xml:id="${slur.id}" startid="#${slur.startId}" endid="#${slur.endId}"/>`);
    expect(mei).toContain(`<dynam xml:id="${dyn.id}" staff="1" startid="#${dyn.at}">mf</dynam>`);
    const hairpin = doc.measures[3].spanners[0];
    expect(mei).toContain(
      `<hairpin xml:id="${hairpin.id}" staff="1" form="cres" startid="#${hairpin.startId}" endid="#${hairpin.endId}"/>`,
    );
    // …and that they sit after the </staff> of the measure they belong to.
    const measureStart = mei.indexOf(`<measure xml:id="${doc.measures[0].id}"`);
    expect(mei.indexOf(`<slur xml:id="${slur.id}"`)).toBeGreaterThan(mei.indexOf('</staff>', measureStart));
  });
});
