"""`ChordIdentity` — the canonical chord shape.

This mirrors the TypeScript `ChordIdentity` (app/src/data/chord-identity.ts) and
is the *server-owned* source of truth: the frontend type should be generated
from this via OpenAPI, so the two can't drift. The server validates the shape;
it does not (yet) re-derive engravings — that logic stays single-source in TS
until there's a concrete reason to render server-side.
"""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from app.schemas.base import CamelModel

RootLetter = Literal["A", "B", "C", "D", "E", "F", "G"]
RootAccidental = Literal["natural", "sharp", "flat"]
TriadQuality = Literal["major", "minor", "dim", "aug", "sus2", "sus4"]
SeventhType = Literal["maj7", "min7", "dim7"]
Extension = Literal[6, 7, 9, 11, 13]
AlterationDegree = Literal[5, 9, 11, 13]
AlterationChange = Literal["#", "b"]
VoicingType = Literal["block", "drop2", "drop3"]
Inversion = Literal[0, 1, 2, 3]


class Root(CamelModel):
    letter: RootLetter
    accidental: RootAccidental


class Alteration(CamelModel):
    degree: AlterationDegree
    change: AlterationChange


class Voicing(CamelModel):
    type: VoicingType = "block"
    inversion: Inversion = 0
    root_octave: int = 4
    double_root: bool = False


class ChordIdentity(CamelModel):
    root: Root
    quality: TriadQuality
    seventh: SeventhType | None = None
    extensions: list[Extension] = Field(default_factory=list[Extension])
    alterations: list[Alteration] = Field(default_factory=list[Alteration])
    voicing: Voicing
