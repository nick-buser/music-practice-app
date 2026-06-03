/**
 * The swara (note) model for Indian classical notation.
 *
 * A swara is a scale degree (Sa Re Ga Ma Pa Dha Ni) + a variant (which of the
 * twelve chromatic positions it occupies) + a register (octave — saptak). The
 * model is *movable-Sa*: everything is relative to a chosen tonic, so a phrase
 * stays playable at any pitch once Sa is bound to a concrete frequency.
 *
 * Hindustani names inflections komal / shuddha / tivra. Carnatic names finer
 * swarasthanas (R1/R2/R3 …) that still land on these same twelve positions, so
 * one semitone model carries both traditions — the finer Carnatic labelling is
 * a display concern layered on top (see README), not a different pitch model.
 */

/** Which classical tradition a piece of notation belongs to. */
export type MusicSystem = 'hindustani' | 'carnatic';

export const SWARA_NAMES = ['S', 'R', 'G', 'M', 'P', 'D', 'N'] as const;
/** The seven scale degrees: Sa Re Ga Ma Pa Dha Ni. */
export type SwaraName = (typeof SWARA_NAMES)[number];

/** komal = flat (R G D N), tivra = sharp (only Ma), shuddha = natural. */
export type SwaraVariant = 'shuddha' | 'komal' | 'tivra';

export const REGISTERS = ['mandra', 'madhya', 'taar'] as const;
/** Lower / middle / upper octave (saptak). Dots below or above the glyph. */
export type Register = (typeof REGISTERS)[number];

export interface Swara {
  name: SwaraName;
  variant: SwaraVariant;
  register: Register;
}

/** Semitone of each *shuddha* swara above Sa (the bilaval / major reference). */
const SHUDDHA_SEMITONES: Record<SwaraName, number> = {
  S: 0,
  R: 2,
  G: 4,
  M: 5,
  P: 7,
  D: 9,
  N: 11,
};

/** Which variants each swara is allowed to take. Sa and Pa are fixed (achala). */
const ALLOWED_VARIANTS: Record<SwaraName, readonly SwaraVariant[]> = {
  S: ['shuddha'],
  R: ['shuddha', 'komal'],
  G: ['shuddha', 'komal'],
  M: ['shuddha', 'tivra'],
  P: ['shuddha'],
  D: ['shuddha', 'komal'],
  N: ['shuddha', 'komal'],
};

const REGISTER_OFFSET: Record<Register, number> = {
  mandra: -12,
  madhya: 0,
  taar: 12,
};

export function isValidSwara(name: SwaraName, variant: SwaraVariant): boolean {
  return ALLOWED_VARIANTS[name].includes(variant);
}

/**
 * Semitones above madhya (middle-octave) Sa. komal lowers a swara by one,
 * tivra raises Ma by one, and the register shifts by whole octaves — so taar
 * Sa is +12 and mandra Pa is −5.
 */
export function swaraSemitones(swara: Swara): number {
  const { name, variant, register } = swara;
  if (!isValidSwara(name, variant)) {
    throw new Error(`invalid swara: ${variant} ${name}`);
  }
  let semis = SHUDDHA_SEMITONES[name];
  if (variant === 'komal') semis -= 1;
  if (variant === 'tivra') semis += 1;
  return semis + REGISTER_OFFSET[register];
}

/** Structured glyph info for the renderer: base letter + accidental + register. */
export interface SwaraGlyph {
  /** Base letter, always upper-case (komal/tivra are marks, not letters). */
  letter: SwaraName;
  komal: boolean;
  tivra: boolean;
  register: Register;
}

export function swaraGlyph(swara: Swara): SwaraGlyph {
  return {
    letter: swara.name,
    komal: swara.variant === 'komal',
    tivra: swara.variant === 'tivra',
    register: swara.register,
  };
}

// ── Compact ASCII spelling ──────────────────────────────────────────────────
// Seed data reads more naturally as text than as object literals. The grammar
// for a single swara token:
//   • a letter picks the swara + variant (case matters, see LETTER below)
//   • a leading "."  drops it to the mandra (lower) octave
//   • a trailing "'" raises it to the taar (upper) octave
// e.g.  "S" madhya Sa · "r" komal Re · "M" tivra Ma · "m" shuddha Ma ·
//       ".P" mandra Pa · "S'" taar Sa.

const LETTER: Record<string, { name: SwaraName; variant: SwaraVariant }> = {
  S: { name: 'S', variant: 'shuddha' },
  r: { name: 'R', variant: 'komal' },
  R: { name: 'R', variant: 'shuddha' },
  g: { name: 'G', variant: 'komal' },
  G: { name: 'G', variant: 'shuddha' },
  m: { name: 'M', variant: 'shuddha' },
  M: { name: 'M', variant: 'tivra' },
  P: { name: 'P', variant: 'shuddha' },
  d: { name: 'D', variant: 'komal' },
  D: { name: 'D', variant: 'shuddha' },
  n: { name: 'N', variant: 'komal' },
  N: { name: 'N', variant: 'shuddha' },
};

export function parseSwara(token: string): Swara {
  let register: Register = 'madhya';
  let body = token;
  if (body.startsWith('.')) {
    register = 'mandra';
    body = body.slice(1);
  }
  if (body.endsWith("'")) {
    register = 'taar';
    body = body.slice(0, -1);
  }
  const entry = LETTER[body];
  if (!entry || body.length !== 1) {
    throw new Error(`unparseable swara token: "${token}"`);
  }
  return { name: entry.name, variant: entry.variant, register };
}

/** Parse a space-separated phrase, e.g. ".N R G M D N S'" (Yaman aroha). */
export function parsePhrase(src: string): Swara[] {
  return src
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map(parseSwara);
}
