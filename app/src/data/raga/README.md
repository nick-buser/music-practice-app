# Raga notation model

A small, tradition-aware AST for **Indian classical music** (Hindustani +
Carnatic) plus the seed teaching content built on it. We render this with our
own SVG layer (`components/raga/`) rather than a third-party engraver — no
first-class JS library exists for sargam/swara notation, so staff-notation
tools (Verovio, VexFlow) don't fit.

This whole layer is frontend-only seed data, exactly like `data/scales/` — it
ships in the backend-free Cloudflare build. User-authored compositions and
practice tracking can later persist through the existing CRUD API, gated by
`backendEnabled`.

## The model, bottom-up

| Module | Concept | Notes |
| --- | --- | --- |
| `swara.ts` | **Swara** (note) | scale degree + variant + register. Movable-Sa. |
| `tala.ts` | **Tala** (metre) | a cycle of beats grouped into marked sections. |
| `raga.ts` | **Raga** (mode) | aroha / avaroha / pakad + placement metadata. |
| `composition.ts` | **Composition** | swaras laid on the tala grid, in sections. |

### Swara

`{ name, variant, register }` where `name` is one of `S R G M P D N`,
`variant` is `shuddha | komal | tivra`, and `register` is
`mandra | madhya | taar` (lower / middle / upper octave). `swaraSemitones()`
collapses that to semitones above middle Sa, which is all playback needs — bind
Sa to a frequency and every swara has a pitch.

A compact ASCII spelling keeps seed data readable (`parseSwara` / `parsePhrase`):

```
S   madhya Sa        r  komal Re        R  shuddha Re
m   shuddha Ma       M  tivra Ma        .P mandra Pa
S'  taar Sa
```

### Tala

A cycle is an ordered list of sections, each with a beat count (`matras`) and a
marker. Hindustani sections are `tali` (clap) or `khali` (wave); Carnatic
sections are `laghu` / `drutam` / `anudrutam`. Beat one of the cycle is the
**sam** — implicit (always the first beat), since both traditions share it.
Seeded: Tīntāl, Jhaptāl, Keharwā (Hindustani) and Ādi (Carnatic).

### Composition

Cells on the tala grid, one matra each: a `swara` (or several, a subdivision), a
`sustain` (`−`, hold the previous note), or a `rest` (`~`). `parseCells` reads
the same compact spelling, with `|` as a visual barline and `,` joining a
subdivided matra. `assertCycleAligned` checks a section is a whole number of
cycles.

## Known simplifications (v1)

- **Carnatic swarasthana labels.** We mark komal/tivra, not the finer
  `R1/R2/R3` indices. Mayamalavagowla maps cleanly onto komal/shuddha, so it is
  correct today; full `Rn/Gn` subscript labelling is a future refinement.
- **Ornaments (gamaka, meend, kan).** Not modelled yet — the cell is a bare
  swara. The `Cell` union is the natural place to add an `ornament` annotation.
- **Microtonal shruti.** Pitches are 12-TET; true shruti tuning is out of scope.

## Seed content

- **Yaman** (Hindustani, Kalyan thaat) + an original sargam exercise in Tīntāl.
- **Māyāmāḷavagowḷa** (Carnatic, 15th melakarta) + the first two sarali varisai
  in Ādi tala — canonical beginner exercises.
