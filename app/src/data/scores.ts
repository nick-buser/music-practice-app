/**
 * ABC-notation openings for each piece in the library.
 * Rendered by Verovio as inline thumbnails, full-piece engravings on the piece
 * detail (with section heatmap overlays), and looped opening for the session.
 *
 * Coverage choices:
 * - chopin-9-2 and bach-prelude-cmaj are extended to cover every section in
 *   their `sections` data (34 / 35 bars) so heatmap overlays paint across the
 *   full piece — including the bars 17–24 "Figuration variation" and the
 *   mm. 25–28 cadenza that previously had no engraving to land on.
 * - The remaining pieces are extended to ~16 bars: enough to show a real
 *   passage and give selections something to anchor to, without writing out a
 *   full transcription.
 *
 * Content is musically plausible (correct meter, in key) but not a faithful
 * transcription — the point is paintable bars, not engraving competition with
 * the publisher.
 *
 * ABC conventions used here:
 * - `%` starts a single-line comment (NOT `%%`, which is a directive prefix).
 * - Notes in square brackets `[...]` form a chord struck together; without
 *   brackets they're sequential. Bass chord blocks like `[E,,B,,E,G,]6` are
 *   half-bar held chords (6 eighths in 12/8) sized to align with the melody.
 */

export const ABC_BY_PIECE: Record<string, string> = {
  // ─── Chopin · Nocturne in E♭ major, Op. 9 No. 2 — 34 bars ─────────
  'chopin-9-2': `X:1
T:Nocturne in E♭ major, Op. 9 No. 2
C:F. Chopin
M:12/8
L:1/8
Q:1/4=60
K:Eb
%%score (1 2)
V:1 clef=treble
V:2 clef=bass
% mm. 1–8 — Opening theme
[V:1] B3 G3 F3 G3 | B3 G3 F3 G3 | B3 G3 F3 G3 | B3 G3 F3 G3 |
[V:1] e3 c3 B3 G3 | f3 g3 B3 d3 | A3 F3 E3 F3 | A3 F3 E3 F3 |
[V:2] [E,,B,,E,G,]6 [F,,C,F,A,]6 | [E,,B,,E,G,]6 [F,,C,F,A,]6 |
[V:2] [E,,B,,E,G,]6 [F,,C,F,A,]6 | [E,,B,,E,G,]6 [F,,C,F,A,]6 |
[V:2] [C,G,,C,E,]6 [A,,E,,A,,C,]6 | [C,G,,C,E,]6 [G,,D,G,B,]6 |
[V:2] [F,,C,F,A,]6 [G,,D,G,B,]6 | [F,,C,F,A,]6 [G,,D,G,B,]6 |
% mm. 9–16 — Theme ornamented
[V:1] B2 c d2 G F2 e G3 | B3 c2 d G2 F A2 G | B2 c B2 G F2 G G3 | B3 G2 d F2 e G3 |
[V:1] e3 c3 B2 c d2 B | f3 g3 B3 d3 | A2 G F2 G E2 F G3 | A3 F3 E3 F3 |
[V:2] [E,,B,,E,G,]6 [F,,C,F,A,]6 | [E,,B,,E,G,]6 [F,,C,F,A,]6 |
[V:2] [E,,B,,E,G,]6 [F,,C,F,A,]6 | [E,,B,,E,G,]6 [F,,C,F,A,]6 |
[V:2] [C,G,,C,E,]6 [A,,E,,A,,C,]6 | [C,G,,C,E,]6 [G,,D,G,B,]6 |
[V:2] [F,,C,F,A,]6 [G,,D,G,B,]6 | [F,,C,F,A,]6 [G,,D,G,B,]6 |
% mm. 17–24 — Figuration variation (busier)
[V:1] B c d c B G f e d c B A | d c B c d e f g a g f e |
[V:1] g a g f e d c B A G F E | D F A c e g f e d c B A |
[V:1] B c d c B A G F E F G A | B c d e f g a g f e d c |
[V:1] e d c B A G F E D E F G | A B c d e f g f e d c B |
[V:2] [B,,F,B,D]6 [C,G,C,E]6 | [B,,F,B,D]6 [C,G,C,E]6 |
[V:2] [A,,E,A,C]6 [D,A,,D,F]6 | [G,,D,G,B,]6 [C,G,C,E]6 |
[V:2] [F,,C,F,A,]6 [B,,F,B,D]6 | [E,,B,,E,G,]6 [A,,E,A,C]6 |
[V:2] [D,A,,D,F]6 [G,,D,G,B,]6 | [C,G,C,E]6 [F,,C,F,A,]6 |
% mm. 25–28 — Cadenza
[V:1] e g b c' e g b c' e g b c' | d f a b d f a b d f a b |
[V:1] B c d e f g a b c' d' e' f' | g' f' e' d' c' b a g f e d c |
[V:2] [B,,F,B,]12 | [B,,F,B,]12 |
[V:2] [B,,F,B,]12 | [B,,F,B,]12 |
% mm. 29–34 — Return + coda
[V:1] B3 G3 F3 G3 | B3 G3 F3 G3 | e3 c3 B3 G3 |
[V:1] F3 E3 D3 E3 | B,3 G,3 E,3 F,3 | E,3 z3 z6 |
[V:2] [E,,B,,E,G,]6 [F,,C,F,A,]6 | [E,,B,,E,G,]6 [F,,C,F,A,]6 |
[V:2] [C,G,,C,E,]6 [G,,D,G,B,]6 | [F,,C,F,A,]6 [B,,F,B,D]6 |
[V:2] [E,,B,,E,G,]6 [F,,C,F,A,]6 | [E,,B,,E,G,]12 |`,

  // ─── Bach · Prelude in C major, BWV 846 — 35 bars ─────────────────
  // The whole piece is a single broken-chord pattern: 16 sixteenths per bar,
  // played twice. We vary only the chord per bar.
  'bach-prelude-cmaj': `X:1
T:Prelude in C major, BWV 846
C:J. S. Bach
M:4/4
L:1/16
Q:1/4=72
K:C
%%score (1 2)
V:1 clef=treble
V:2 clef=bass
% mm. 1–11 — Tonic ascent
[V:1] CEGc eGce CEGc eGce | CDFA dFAd CDFA dFAd |
[V:1] BDGB dGBd BDGB dGBd | CEGc eGce CEGc eGce |
[V:1] CEAc eAce CEAc eAce | CDF^A dFAd CDFAd FAd |
[V:1] BDGB dGBd BDGB dGBd | CDFA dFAd CDFA dFAd |
[V:1] BDGc dGBc BDGc dGBc | CDFA dFAd CDFA dFAd |
[V:1] BDGB dGBd BDGB dGBd |
[V:2] [C,,C,]16 | [C,,C,]16 |
[V:2] [C,,B,,]16 | [C,,C,]16 |
[V:2] [C,,A,,]16 | [D,,D,]16 |
[V:2] [G,,B,,]16 | [D,,D,]16 |
[V:2] [G,,B,,]16 | [D,,D,]16 |
[V:2] [G,,B,,]16 |
% mm. 12–19 — Modulation
[V:1] CEFA cFAc CEFA cFAc | DEFA dFAd DEFA dFAd |
[V:1] CEGB dGBd CEGB dGBd | DFA^c eAce DFAc eAce |
[V:1] DG_BC eGBe DGBC eGBe | CEAC eACe CEAC eACe |
[V:1] DGAC eGAe DGAC eGAe | DG^Bd fBdf DGBd fBdf |
[V:2] [F,,F,]16 | [D,,D,]16 |
[V:2] [E,,G,]16 | [A,,^F,]16 |
[V:2] [G,,G,]16 | [A,,A,]16 |
[V:2] [F,,F,]16 | [G,,G,]16 |
% mm. 20–27 — Pedal point on D
[V:1] CFGA cFGc CFGA cFGc | DGB^c eGBe DGBc eGBe |
[V:1] CEGB dGBd CEGB dGBd | DFA^c eAce DFAc eAce |
[V:1] DFA^c eAce DFAc eAce | CEG_B dGBd CEGB dGBd |
[V:1] CDFA dFAd CDFA dFAd | BDGB dGBd BDGB dGBd |
[V:2] [D,,D,]16 | [D,,D,]16 |
[V:2] [D,,D,]16 | [D,,D,]16 |
[V:2] [D,,D,]16 | [D,,D,]16 |
[V:2] [C,,C,]16 | [G,,G,,]16 |
% mm. 28–35 — Final cadence
[V:1] CEGc eGce CEGc eGce | CFAc fAcf CFAc fAcf |
[V:1] BDGB dGBd BDGB dGBd | CEGc eGce CEGc eGce |
[V:1] CDFA dFAd CDFA dFAd | BDGB dGBd BDGB dGBd |
[V:1] CEGc eGce CEGc eGce | [CEGc]16 |
[V:2] [C,,C,]16 | [F,,F,,]16 |
[V:2] [G,,G,,]16 | [C,,C,]16 |
[V:2] [C,,C,]16 | [G,,G,,]16 |
[V:2] [C,,C,]16 | [C,,C,]16 |`,

  // ─── Debussy · Clair de lune — 16 bars ────────────────────────────
  'debussy-clair': `X:1
T:Clair de lune
C:C. Debussy
M:9/8
L:1/8
Q:3/8=50
K:Db
%%score (1 2)
V:1 clef=treble
V:2 clef=bass
[V:1] f3 c3 _A3 | f3 c3 _A3 | g3 _e3 c3 | g3 _e3 c3 |
[V:1] f3 _A3 G3 | f3 _A3 G3 | _e3 c3 _A3 | _e3 c3 _A3 |
[V:1] f3 c3 _A3 | f3 c3 _A3 | g3 d3 _B3 | g3 d3 _B3 |
[V:1] a3 e3 c3 | a3 e3 c3 | g3 _e3 c3 | f3 c3 _A3 |
[V:2] [D,,_A,,D,]9 | [D,,_A,,D,]9 | [_E,,_B,,_E,]9 | [_E,,_B,,_E,]9 |
[V:2] [D,,_A,,D,]9 | [D,,_A,,D,]9 | [_A,,_E,_A,]9 | [_A,,_E,_A,]9 |
[V:2] [D,,_A,,D,]9 | [D,,_A,,D,]9 | [_E,,_B,,_E,]9 | [_E,,_B,,_E,]9 |
[V:2] [F,C,F,]9 | [F,C,F,]9 | [_A,,_E,_A,]9 | [D,,_A,,D,]9 |`,

  // ─── Satie · Gymnopédie No. 1 — 16 bars ───────────────────────────
  'satie-gymno-1': `X:1
T:Gymnopédie No. 1
C:E. Satie
M:3/4
L:1/4
Q:1/4=60
K:D
%%score (1 2)
V:1 clef=treble
V:2 clef=bass
[V:1] z f e | z f d | z e c | z d c |
[V:1] z f e | z g f | z e d | z c B, |
[V:1] z d c | z A G | z B A | z c B |
[V:1] z d c | z f e | z g f | z3 |
[V:2] D,, A,, F, | D,, A,, F, | A,,, E,, A, | A,,, E,, A, |
[V:2] D,, A,, F, | D,, A,, F, | A,,, E,, A, | A,,, E,, A, |
[V:2] G,, D,, B, | G,, D,, B, | F,, C,, A, | F,, C,, A, |
[V:2] D,, A,, F, | D,, A,, F, | A,,, E,, A, | D,, A,, F, |`,

  // ─── Tárrega · Recuerdos de la Alhambra — 16 bars ─────────────────
  // Tremolo simplified to repeated upper-note pattern over a bass line.
  'tarrega-recuerdos': `X:1
T:Recuerdos de la Alhambra
C:F. Tárrega
M:3/4
L:1/16
Q:3/8=84
K:Am
%%score (1 2)
V:1 clef=treble
V:2 clef=bass
[V:1] AAAA AAAA AAAA | BBBB BBBB BBBB | cccc cccc cccc | BBBB BBBB BBBB |
[V:1] AAAA AAAA AAAA | dddd dddd dddd | cccc cccc cccc | BBBB BBBB BBBB |
[V:1] AAAA AAAA AAAA | eeee eeee eeee | dddd dddd dddd | cccc cccc cccc |
[V:1] BBBB BBBB BBBB | AAAA AAAA AAAA | GGGG GGGG GGGG | A12 |
[V:2] A,,12 | E,12 | A,,12 | E,12 |
[V:2] A,,12 | D,12 | A,,12 | E,12 |
[V:2] A,,12 | A,12 | D,12 | A,,12 |
[V:2] E,12 | A,,12 | E,12 | A,,12 |`,

  // ─── Bach · Bourrée in E minor, BWV 996 — 16 bars ────────────────
  'bach-bouree': `X:1
T:Bourrée in E minor, BWV 996
C:J. S. Bach
M:2/2
L:1/8
Q:1/2=46
K:Em
%%score (1 2)
V:1 clef=treble
V:2 clef=bass
[V:1] B2 e2 dB AG | FA d2 cA Bc | dB GB AG FE | E8 |
[V:1] G2 B2 AG FE | DF B2 AF GA | BG ^DF GF EA | A8 |
[V:1] e2 g2 fe dc | Bd g2 fd ec | dB G^F GA Be | e8 |
[V:1] B2 A2 GF ED | CE A2 GE FG | AF DE FE DC | C8 |
[V:2] E,8 | A,,8 | B,,8 | E,8 |
[V:2] G,8 | D,8 | E,8 | A,,8 |
[V:2] E,8 | A,,8 | B,,8 | E,8 |
[V:2] G,8 | D,8 | A,,8 | C,8 |`,

  // ─── Caldara · Sebben, crudele — 16 bars ──────────────────────────
  'caldara-sebben': `X:1
T:Sebben, crudele
C:A. Caldara
M:3/8
L:1/8
Q:3/8=72
K:Fm
F2 G | A2 B | c3 | c B A | B A G | F3 |
G2 A | B2 c | d3 | d c B | c B A | G3 |
F2 G | A2 B | c2 d | F3 |`,
};
