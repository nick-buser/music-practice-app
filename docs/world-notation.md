# World Notation

A dedicated area for music traditions that **don't live on the staff**. The
first tradition family is Indian classical — Hindustani and Carnatic — rendered
in native sargam/swara notation with study material and playable exercises.

It's reachable from the sidebar (the **World** destination) and ships in the
public, backend-free Cloudflare build: everything here is frontend seed data and
a custom renderer, exactly like `data/scales/`.

## Why we built our own AST + renderer

We surveyed the landscape before writing a line of code. There is **no
first-class JS/TS library** for sargam/swara notation:

- The closest renderer, `srikumarks/carnot` (Carnatic), is self-described
  ALPHA, DOM-scraping `<pre>` text, and not an npm package.
- Hindustani tooling is apps and fonts (Swara Notebook, swarlipi.app), not
  embeddable libraries; the literature notes Bhatkhande glyphs are hard enough
  that some editors ship one image per diacritic.
- Western engravers (Verovio, VexFlow) model the staff, not a tala grid.

So we model the notation ourselves and draw it with inline SVG. That keeps the
data declarative and testable, and the rendering themeable and crisp.

## Architecture

```
data/raga/            the notation model (AST) + seed content   ← see its README
  swara.ts  tala.ts  raga.ts  composition.ts
components/raga/
  RagaScore.tsx       custom SVG renderer (PhraseLine, CompositionScore)
  playback.ts         buildTimeline() + useSwaraPlayback() (Web Audio)
  CompositionPlayer.tsx  play/stop/loop transport over a section
views/
  WorldNotationView.tsx  the area: tradition toggle, raga reference, legend
```

Four layers, bottom-up:

1. **Model** — a movable-Sa swara (degree + variant + register), a cyclic tala
   (marked sections), a raga (aroha/avaroha/pakad + placement), and a
   composition (swaras on the matra grid). Detailed in
   [`app/src/data/raga/README.md`](../app/src/data/raga/README.md).
2. **Renderer** — inline SVG on a fixed matra grid: swara letters with
   komal/tivra marks and octave dots, vibhag dividers, sam/tali/khali (or
   laghu/drutam) markers, optional lyrics, and an active-matra cursor.
3. **Playback** — `buildTimeline()` turns cells into pitched tone events;
   `useSwaraPlayback()` schedules them on the Web Audio clock (the same
   two-clock lookahead as the metronome) and reports the active matra so the
   cursor tracks the sound. Sa is movable, so a piece plays at any pitch, in
   either equal temperament or a 5-limit just-intonation (shruti) tuning.
4. **Area** — a top-level view with a tradition toggle, a per-raga reference,
   playable exercises, and a how-to-read legend.

## Authoring new content

All content is plain TypeScript seed data — no backend required.

**Add a tala** (`data/raga/tala.ts`): append a `Tala` whose `sections` sum to
the cycle length; mark each section `tali`/`khali` (Hindustani) or
`laghu`/`drutam`/`anudrutam` (Carnatic). The sam is implicit (beat one).

**Add a raga** (`data/raga/raga.ts`): append a `Raga`, writing `aroha`,
`avaroha`, and `pakad` with `parsePhrase(...)`. The ASCII spelling is
case-sensitive — `r` is komal Re, `R` shuddha Re, `m` shuddha Ma, `M` tivra Ma,
`.P` mandra Pa, `S'` taar Sa.

**Add a composition** (`data/raga/composition.ts`): append a `Composition`
referencing a `ragaId` + `talaId`, with sections built from `parseCells(...)`.
Use `|` as a visual barline, `-` to sustain, `~` to rest, and `S,R` for a
subdivided matra. A `seed data integrity` test asserts every section is a whole
number of tala cycles, so misaligned content fails fast.

**Ornament a swara** anywhere it's spelled: `G~` for a gamaka (oscillation),
`(R)S` for a kan (grace note), and `D>` for a meend (glide into the next swara).
Ornaments are drawn but not sounded, and never change the matra count.

The new raga/composition shows up in the area automatically (the view derives
its lists from the seed arrays) and is immediately playable.

## Scope today, and next

**In:** Hindustani + Carnatic; native sargam rendering; movable-Sa playback;
two ragas (Yaman, Māyāmāḷavagowḷa) with an original Yaman sargam exercise and
the first two Carnatic sarali varisai.

Carnatic ragas are labelled with their finer **swarasthana** index (R₁/G₃/M₂ …),
derived from each swara's variant so the printed label always matches the pitch.

Swaras can be ornamented — **gamaka** (`G~`), **kan** grace (`(R)S`) and **meend**
glide (`D>`) — drawn by the renderer but not yet sounded by playback.

Playback can sound either **equal temperament** or a 5-limit **just-intonation
(shruti)** tuning, chosen from the header.

**Deliberately not yet** (the model leaves room for each):

- Sounding the ornaments (gamaka pitch-bend, kan as a real grace tone).
- The full 22-shruti, raga-dependent intonation (just intonation approximates it).
- Backend persistence for user-authored compositions, via the existing CRUD
  contract gated by `backendEnabled`.
