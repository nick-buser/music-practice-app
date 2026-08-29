# Vendored: "your sketchbook owns the ideas; REAPER is one editor" (2026-08-29)

Verbatim import of a design conversation Nick had on 2026-08-29 about where
musical *ideas* (motifs, harmony fragments, prose thoughts, references,
versions) should live, and why REAPER is the wrong system of record for
them. Kept as source material; the house design that incorporates it into
Soundings, the homelab, and the REAPER/VST work is
[sketchbook.md](sketchbook.md). Nothing below is edited — argue with it
there, not here.

---

Yes. **REAPER is probably the wrong tool to make the system of record.** It is very good at manipulating and rendering musical material, but the thing you're describing is much closer to a **musical research notebook / personal knowledge graph / versioned idea repository** that happens to understand MIDI and audio.

The clean separation is:

> **Your sketchbook owns the ideas. REAPER is one editor/runtime for those ideas.**

That gets you out of fighting the DAW's fundamental ontology of `project → tracks → items`.

## The object you actually want

An idea should probably be something like:

```text
Idea: chorus-hook-017
────────────────────────────────────

Title:
  "ascending chorus with delayed tonic"

Status:
  fragment / exploring

Kinds:
  melody, harmony, chorus

Tags:
  jpop, bright, yearning, ascending-bass

Notes:
  The interesting bit isn't actually the melody.
  It's that the melody sits on scale degree 5 while
  the harmony keeps moving underneath it...

Inspiration:
  - song X @ 1:14
  - thing I improvised Aug 28

Musical assets:
  melody.mid
  chords.mid
  bass.mid

Renders:
  piano.mp3
  trio.mp3

Analysis:
  I → V/vi → vi → IV → iv
  peak note delayed until bar 7

Connections:
  derived-from → motif-042
  resembles → harmony-019
  might-fit-with → prechorus-007

Versions:
  v1 original
  ├── v2 reharmonized
  │   └── v4 trio arrangement
  └── v3 melody simplified
```

That's enormously closer to your mental model than a REAPER region.

And importantly, **most of the information isn't MIDI**.

The MIDI is an attachment to the thought.

---

# I think your DIY app instinct is good

Especially because this is one of those cases where a fairly modest CRUD app gets you 80% of a genuinely unusual specialized tool.

I would not start by building a DAW.

Build a **musical object manager**.

Something like:

```text
                     MUSICAL SKETCHBOOK
                            │
             ┌──────────────┼──────────────┐
             │              │              │
          thoughts        assets       relationships
             │              │              │
        Markdown/text      MIDI         derived-from
        analyses           audio        responds-to
        references         image        variation-of
        annotations        score        inspiration
                           RPP          might-fit
```

Then outsource playback/editing/rendering to existing tools.

---

# I'd make NAS/object storage the blob layer

Your proposed setup is almost exactly what I'd do, with one modification:

### Don't make rendered MP3s canonical.

Treat them as **derived previews**.

Canonical-ish material:

```text
idea/
    manifest.json
    notes.md

    assets/
        melody.mid
        harmony.mid
        bass.mid

    optional/
        sketch.rpp
        score.musicxml
```

Generated:

```text
renders/
    piano-v3.mp3
    trio-v3.mp3
    thumbnail.png
```

If you lose `piano-v3.mp3`, who cares?

Regenerate it.

If you lose the MIDI + notes + provenance, you've actually lost the idea.

For your homelab, this maps very naturally onto:

```text
Postgres
    metadata
    graph edges
    versions
    tags
    search/indexing

NAS / S3-compatible object storage
    .mid
    .wav
    .mp3
    .rpp
    images
    PDFs
    reference snippets

Git
    textual representations
    manifests
    scripts
    optionally MIDI
```

You could even skip Git initially and model versions explicitly in Postgres.

---

# VCS is where this gets particularly interesting

I wouldn't necessarily map your musical thinking directly onto **Git branches**.

Git's model is useful, but you're really describing a DAG of creative derivations:

```text
                 M017
              original motif
               /        \
              /          \
      M017-A              M017-B
    reharmonized        rhythm altered
         │                  │
         │                  ├── used in Piece 4
         ▼
    M017-A2
    bass added
```

That's semantically:

```text
derived_from
variant_of
forked_from
incorporated_into
```

Those relationships should exist **inside the application**.

Then Git can sit underneath where useful.

Why?

Because otherwise you end up abusing Git:

```text
git checkout jpop-m17-weird-reharm-v3
```

just to hear a chord experiment.

That's not really what Git's interface is optimized for.

### Better UI

On an idea:

```text
Versions

● Original
├── A: modal interchange
│   └── A2: added bass
├── B: rhythmic displacement
└── C: simplified melody
```

Click any node → audition it.

Click **Fork** → make another child.

That's Git-like semantics with a music-native interface.

---

# And you can still literally back it with Git

One potentially excellent architecture is:

```text
UI
 │
 ▼
Application DB ───── full-text / metadata / graph queries
 │
 ├───────────────► object storage / NAS
 │                   MIDI/audio/etc
 │
 ▼
Git workspace
    ideas/
      M017/
        manifest.yaml
        notes.md
```

Your database becomes an **index and interaction layer**, while the actual intellectual content remains portable.

That avoids building yourself an opaque database prison.

For example:

```yaml
id: M017
title: Delayed tonic chorus
type:
  - melody
  - section

tags:
  - jpop
  - chorus
  - ascending

derived_from:
  - M004

related:
  - H013
  - R008

assets:
  melody: assets/melody.mid
  harmony: assets/harmony.mid
```

And then:

```markdown
# Notes

The thing I like is the contrast between the fairly static
top-line and increasingly active harmonic rhythm.

Possible experiment:

- hold scale degree 5 another two beats
- make bass 1-3-4-#4-5
- try borrowed iv immediately before chorus
```

Now even if your app disappears ten years from now, the repository is still comprehensible.

That is a **huge advantage**.

---

# The UI I'd want

Not a spreadsheet.

Not a DAW timeline.

I'd have several simultaneous projections over the same objects.

### 1. Stream / journal

Probably your default view:

```text
AUG 28

15:24
M017 — little chorus melody
▶ 0:08

"Could be interesting if the bass moves while
melody stays nearly static..."

15:37
H026 — progression
▶ 0:12

Possibly combine with M017.

15:42
thought

J-pop prechoruses seem to often create energy by...
```

This gives you the **stream-of-consciousness notebook** you want.

Some entries don't even have musical files.

That's important.

---

### 2. Idea page

Deep structured view:

```text
M017

[play piano] [play trio] [open MIDI] [open REAPER]

NOTES
...

MATERIAL
melody.mid
harmony.mid

VERSIONS
...

RELATIONSHIPS
→ H026
→ J007
← Piece 003

INSPIRATIONS
...
```

---

### 3. Graph

Something like:

```text
                M017
              /  │  \
             /   │   \
          H026  R03  REF12
             \
              \
              Piece07
```

Not because graphs are intrinsically magic, but because **creative provenance actually is graph-shaped**.

---

### 4. Collections

Loose intentional groupings:

```text
"Things that might become Piece A"

M017
H026
B011
REF22
some prose thought
voice memo 003
```

Crucially, membership should not imply ownership.

The same motif can appear in five collections.

---

### 5. Search

This gets extremely valuable after six months.

Queries like:

```text
tag:jpop type:harmony
```

or:

```text
"borrowed iv"
```

or:

```text
ideas related to M017
```

or:

```text
unused chorus fragments
```

or perhaps eventually:

```text
key:E tempo:130..170 tag:energetic
```

That's something a DAW is just not designed to give you.

---

# REAPER then becomes a very good subordinate tool

This is where I would keep it.

Imagine clicking:

**Open in REAPER**

Your application generates or maintains a scratch project:

```text
Idea M017

Melody
Harmony
Bass
Drums

→ shared piano VST
→ shared bass VST
→ shared drum VST
```

You edit it.

Then hit a custom REAPER command:

> **Save to Sketchbook**

A small ReaScript could send your local app:

```text
idea=M017

new assets:
    melody.mid
    harmony.mid
    bass.mid

render:
    piano.wav

notes:
    optional
```

The app creates a new revision:

```text
M017 v3
```

Now REAPER is doing what REAPER is good at:

* recording MIDI
* editing notes
* VST hosting
* routing
* mixing
* rendering
* performance capture

and none of what it is bad at:

* knowledge organization
* annotation
* semantic relationships
* provenance
* branching
* browsing hundreds of unrelated ideas.

---

# You may not even need `.rpp` files for most ideas

I'd distinguish three levels.

### Tiny idea

```text
notes.md
melody.mid
preview.mp3
```

No REAPER project.

### Developed sketch

```text
notes.md
melody.mid
harmony.mid
bass.mid
drums.mid
preview.mp3
```

Still possibly no persistent RPP.

Generate a scratch REAPER project whenever you open it.

### Actual composition

Now it gets:

```text
composition.rpp
```

because you've reached the point where detailed automation, plugin state, mixing, routing, articulations, etc. are part of the artifact.

This substantially reduces project hell.

---

# I'd also support "ideas containing ideas"

This is important given what you described earlier.

Your primitive doesn't need to be only:

```text
Idea
```

You could have:

```text
Thought
Reference
Motif
Harmony
Rhythm
Texture
Section
Sketch
Composition
Analysis
Collection
```

But don't enforce a strict ontology.

Something can simply start as:

```text
THING-183
```

and later acquire:

```text
type = [harmony, transition]
```

Your system should support:

> **capture first, structure later.**

That's probably the difference between a notebook you actually use and one that becomes another administration chore.

---

# The killer feature might actually be "don't make me classify this"

Imagine hitting one global hotkey and getting:

```text
Quick Capture

[____________________________]

Attach:
[MIDI] [audio] [file] [reference]

[Save]
```

You type:

> Melody I hit while noodling. Sounds vaguely like a chorus. Maybe sequence ending downward instead.

Record ten seconds of MIDI.

Done.

Later the inbox says:

```text
UNPROCESSED — 17
```

and you can optionally turn it into:

```text
M017
tags: chorus,jpop
related: H008
```

That matches the **messy-but-retentive** thinking process you're describing much better than requiring a well-formed object every time.

---

# I would build the MVP surprisingly small

Given your existing web/backend experience, I would resist the temptation to build "Notion for musicians" immediately.

### Phase 1

Just:

```text
Create idea
Edit markdown
Attach files
Play audio
Download/open MIDI
Tags
Links between ideas
Timeline
Search
```

Postgres + your normal web stack + NAS/object storage.

### Phase 2

Add:

```text
fork idea
version history
collections
backlinks
graph view
render variants
```

### Phase 3

REAPER bridge:

```text
Open in REAPER
Save revision from REAPER
Render piano
Render trio
```

### Much later

Potentially:

```text
MIDI visualization
piano roll in browser
automatic harmonic analysis
MusicXML rendering
waveforms
audio/MIDI embeddings
"find similar ideas"
automatic key/chord detection
LLM-assisted analysis
```

But none of that is necessary to make the basic concept excellent.

---

## The architecture I'd choose

Something approximately:

```text
                        Browser
                           │
                           ▼
                 Composition Notebook
                  React/TS or whatever
                           │
            ┌──────────────┼───────────────┐
            ▼              ▼               ▼
        Postgres       Object store       Git
       metadata          / NAS         portable text
       versions          MIDI          + manifests
       graph             audio
       search             RPP
            │
            │ local API
            ▼
        REAPER bridge
            │
      ┌─────┼─────┐
      ▼     ▼     ▼
    VSTs   MIDI  render
```

The really important conceptual decision is:

> **The musical thought is the primary object. MIDI, audio, scores, DAW projects, analyses and prose are representations or attachments to it.**

REAPER fundamentally makes the **project** the primary object.

That's the mismatch you've been running into.

So yes: given what you're describing now, I think your instinct toward a homelab-hosted musical notebook is substantially better than trying to contort REAPER into one. **I'd keep REAPER deeply integrated, but demote it from "where my musical knowledge lives" to "one of the editors I can launch on a musical object."**
