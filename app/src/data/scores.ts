/**
 * ABC-notation openings for each piece in the library.
 * Rendered by Verovio as inline score thumbnails / detail views.
 * Kept deliberately short — first 2–4 bars only.
 */

export const ABC_BY_PIECE: Record<string, string> = {
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
[V:1] B3 G3 F3 G3 | B3 G3 F3 G3 | B3 G3 F3 G3 | (B3 G3) (F3 G3) |
       e3 c3 (Bc) cB | (3eef g3 B3 d3 | A3 F3 E3 F3 | A3 F3 E3 F3 |
[V:2] E,,B,,E,G, z3 z3 F,,C,F,A, z3 z3 | E,,B,,E,G, z3 z3 F,,C,F,A, z3 z3 |
       E,,B,,E,G, z3 z3 F,,C,F,A, z3 z3 | E,,B,,E,G, z3 z3 F,,C,F,A, z3 z3 |
       C,G,,C,E, z3 z3 A,,E,,A,,C, z3 z3 | C,G,,C,E, z3 z3 G,,D,,G,,B, z3 z3 |
       F,,C,F,A, z3 z3 G,,D,G,B, z3 z3 | F,,C,F,A, z3 z3 G,,D,G,B, z3 z3 |`,

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
[V:1] CEGc eGce CEGc eGce | CDFA dFAd CDFA dFAd |
       BDGB dGBd BDGB dGBd | CEGc eGce CEGc eGce |
[V:2] C,,C,2 z2 z4 z8 | C,,C,2 z2 z4 z8 |
       C,,B,,2 z2 z4 z8 | C,,C,2 z2 z4 z8 |`,

  'debussy-clair': `X:1
T:Clair de lune
C:C. Debussy
M:9/8
L:1/8
Q:3/8=50
K:Db
%%score 1 2
V:1 clef=treble
V:2 clef=bass
[V:1] (3FAc f3 c3 | (3GBd g3 d3 |
[V:2] D,,A,,D, z3 z3 | E,,B,,E, z3 z3 |`,

  'satie-gymno-1': `X:1
T:Gymnopédie No. 1
C:E. Satie
M:3/4
L:1/4
Q:1/4=60
K:D
%%score 1 2
V:1 clef=treble
V:2 clef=bass
[V:1] z f e | z f d | z e c | z d c |
[V:2] D,,A,, F, | D,,A,, F, | A,,,E,, A, | A,,,E,, A, |`,

  'tarrega-recuerdos': `X:1
T:Recuerdos de la Alhambra
C:F. Tárrega
M:3/4
L:1/16
Q:3/8=84
K:Am
A2A2A2 B2B2B2 c2c2c2 | A2A2A2 B2B2B2 d2d2d2 |`,

  'bach-bouree': `X:1
T:Bourrée in E minor, BWV 996
C:J. S. Bach
M:2/2
L:1/8
Q:1/2=46
K:Em
B2 e2 dB AG | FA d2 cA Bc | dB GB AG FE | E4 z4 :|`,

  'caldara-sebben': `X:1
T:Sebben, crudele
C:A. Caldara
M:3/8
L:1/8
Q:3/8=72
K:Fm
F2 G | A2 B | c3 | c B A | B A G | F3 |`,
};
