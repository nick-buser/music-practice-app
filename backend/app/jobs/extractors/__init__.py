"""Registration point for every concrete extractor.

`app/jobs/registry.py`'s `get_extractor` looks extractors up by name at
execute time, and `app/jobs/worker.py` deliberately never imports a
concrete extractor module itself (see that module's docstring) — the
worker only ever knows a bare string (`ExtractionRun.extractor`). Something
still has to *import* each extractor module once so its `register()` call
at module scope actually runs, and this package is that one place:
`app/main.py` imports this package (not any extractor module directly) as
part of app startup, so every built-in extractor is registered before the
embedded worker thread's first poll — and before any test that boots the
app, since every test imports `app.main` transitively (`tests/conftest.py`).

Adding another extractor later means adding its import here — never
touching `app/jobs/worker.py` or (for extractor imports specifically)
`app/main.py` again.
"""

from __future__ import annotations

from app.jobs.extractors.midi_features import MidiFeatures as MidiFeatures
