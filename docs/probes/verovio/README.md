# Verovio 4.5.1 behaviour probes (F1 evidence)

Twenty-five small Node scripts (`exp01`–`exp21` from the review, `exp22`
from the critic pass) that pin how the installed Verovio toolkit
(`app/node_modules/verovio`, 4.5.1) actually behaves on MEI input: id
passthrough, timemap contents, ties, beaming, tempo units, key-signature
handling, hit-testing, snapshot determinism, `select()`, foreign-score id
stability. Every "verified 4.5.1" claim in
[`docs/score-substrate.md`](../../score-substrate.md) cites one of these by
file name.

Run from any cwd (no install, no network):

    sh docs/probes/verovio/run-all.sh      # rewrites results.txt beside the scripts

`results.txt` is committed so a Verovio bump can be diffed against the
behaviour the substrate doc assumes. Re-run after any `verovio` upgrade and
re-read the citing sections before trusting them.
