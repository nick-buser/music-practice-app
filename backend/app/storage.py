"""Content-addressed media storage — the `MediaStore` seam over Garage (S3).

Two workstreams (idea assets, recordings) both need to put bytes somewhere and
get them back later; this module is the one place that knows how. Storage is
content-addressed (`media/<sha256[:2]>/<sha256>`) so identical bytes uploaded
twice collapse to one object — cheap dedupe, and a natural integrity check on
the way back out (the key *is* the checksum).

`MediaStore` is a `Protocol`, not an ABC, so `MemoryMediaStore` (tests, and dev
boxes with no S3 reachable — this laptop included) and `S3MediaStore` (Garage
in the homelab) can be swapped in `app/deps.py` with zero conditional logic
anywhere else. `S3MediaStore` takes every bit of its configuration as
constructor arguments rather than reading the global `settings` — that is what
makes it constructible against a botocore `Stubber` in tests, and it is the
shape the next two stores (SB2, RC1) are expected to copy verbatim.
"""

from __future__ import annotations

import hashlib
import tempfile
from collections.abc import Generator, Iterator
from contextlib import AbstractContextManager, contextmanager
from dataclasses import dataclass
from typing import Any, BinaryIO, Literal, Protocol

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from fastapi.responses import StreamingResponse

# Read/hash in fixed-size chunks so a multi-GB recording never sits fully in
# memory — this bounds both `put_stream`'s hashing pass and `open_stream`'s
# download pass.
_CHUNK_SIZE = 1024 * 1024  # 1 MiB

# `put_stream` spools into memory up to this size before it would otherwise
# start touching disk. Practice recordings are small (seconds to low minutes
# of audio); this keeps the common case entirely in-RAM while still being safe
# for an outlier — `SpooledTemporaryFile` rolls to a real (auto-deleted) temp
# file past this point rather than growing without bound.
_SPOOL_MAX_BYTES = 8 * 1024 * 1024  # 8 MiB

HealthStatus = Literal["ok", "unconfigured", "error"]


def content_key(sha256: str) -> str:
    """The content-addressed object key for a given digest.

    Two hex characters of fan-out keeps any single "directory" from collecting
    every object Garage ever stores — a cheap habit borrowed from git's object
    store, useful again here for the same reason (namely: S3-compatible
    backends don't love one flat prefix with millions of keys in it).
    """
    return f"media/{sha256[:2]}/{sha256}"


@dataclass(frozen=True)
class StoredBlob:
    """What `put_stream` hands back: enough to record a DB row against."""

    storage_key: str
    sha256: str
    size_bytes: int
    mime: str


@dataclass(frozen=True)
class BlobStat:
    """What `stat` hands back for an existing object, or `None` if it's missing."""

    size_bytes: int
    mime: str


class MediaStore(Protocol):
    """The storage seam every route (eventually) talks to, never boto3 directly."""

    def put_stream(self, fileobj: BinaryIO, mime: str) -> StoredBlob:
        """Hash + upload `fileobj`. Re-uploading identical bytes is a no-op hit."""
        ...

    def open_stream(self, storage_key: str) -> AbstractContextManager[Iterator[bytes]]:
        """A context manager yielding the object's bytes in `_CHUNK_SIZE` pieces."""
        ...

    def stat(self, storage_key: str) -> BlobStat | None:
        """Metadata for an existing object, or `None` if it doesn't exist."""
        ...

    def delete(self, storage_key: str) -> None: ...

    def healthcheck(self) -> HealthStatus:
        """Report storage health for `/healthz`.

        MUST NOT raise and MUST NOT block for long — see `S3MediaStore.healthcheck`
        for why (short version: this backs the k8s liveness probe).
        """
        ...


# ─── S3 (Garage) ────────────────────────────────────────────────────────────

# Bounds for the client used by put/get/head/delete. Garage sits on the NAS as
# a plain HTTP endpoint with no load balancer in front of it — generous enough
# to ride out a slow disk on the NAS, but nowhere near boto3's ~60s defaults.
_DEFAULT_TIMEOUTS: dict[str, Any] = {
    "connect_timeout": 5,
    "read_timeout": 30,
    "retries": {"max_attempts": 2},
}

# Bounds for the client used *only* by healthcheck(). Deliberately far tighter
# than the general client — see the comment on healthcheck() for why.
_HEALTHCHECK_TIMEOUTS: dict[str, Any] = {
    "connect_timeout": 2,
    "read_timeout": 2,
    "retries": {"max_attempts": 1},
}


class S3MediaStore:
    """Garage-backed `MediaStore`: boto3 against a path-style S3 endpoint.

    Configuration is passed in, not read from `app.config.settings` — see the
    module docstring. `deps.py` is the only place that reads the global.

    `client` and `health_client` are deliberately public (not `_client`) rather
    than private: it's the seam tests attach a botocore `Stubber` to, and
    hiding it behind a leading underscore would just earn a pyright
    `reportPrivateUsage` on every test that needs it. Application code should
    still only ever call the five `MediaStore` methods below — reaching for
    `.client` outside a test is a smell.
    """

    def __init__(
        self,
        *,
        endpoint: str,
        region: str,
        bucket: str,
        access_key_id: str,
        secret_access_key: str,
        force_path_style: bool,
    ) -> None:
        self._bucket = bucket
        addressing_style = "path" if force_path_style else "auto"
        self.client: Any = self._build_client(
            endpoint, region, access_key_id, secret_access_key, addressing_style, _DEFAULT_TIMEOUTS
        )
        # A second, separately-configured client used only by healthcheck() —
        # built once here (not per-call) so a slow Garage never adds client
        # construction overhead on top of the request itself.
        self.health_client: Any = self._build_client(
            endpoint,
            region,
            access_key_id,
            secret_access_key,
            addressing_style,
            _HEALTHCHECK_TIMEOUTS,
        )

    @staticmethod
    def _build_client(
        endpoint: str,
        region: str,
        access_key_id: str,
        secret_access_key: str,
        addressing_style: str,
        timeouts: dict[str, Any],
    ) -> Any:
        # boto3 ships no type stubs (no `py.typed`), so under pyright strict a
        # *direct* `boto3.client(...)` call infers as partially "Unknown" from
        # boto3's own unannotated source — and that taint survives even an
        # explicit `: Any` on the assignment target, resurfacing at every later
        # use of the value. Going through `getattr` with a plain `str` name
        # (not a literal) sidesteps that: it resolves through typeshed's own
        # `getattr(o: object, name: str) -> Any` overload instead of boto3's
        # inferred one, so what comes back is a clean `Any` with nothing left
        # to leak. This is the one and only boundary in this module where
        # boto3's untyped-ness is absorbed — every public method below is
        # fully typed against that clean `Any`.
        factory_name: str = "client"
        client_factory = getattr(boto3, factory_name)
        config = Config(s3={"addressing_style": addressing_style}, **timeouts)
        client: Any = client_factory(
            "s3",
            endpoint_url=endpoint,
            region_name=region,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            config=config,
        )
        return client

    def put_stream(self, fileobj: BinaryIO, mime: str) -> StoredBlob:
        hasher = hashlib.sha256()
        size = 0
        with tempfile.SpooledTemporaryFile(max_size=_SPOOL_MAX_BYTES) as spool:
            for chunk in iter(lambda: fileobj.read(_CHUNK_SIZE), b""):
                hasher.update(chunk)
                spool.write(chunk)
                size += len(chunk)
            sha256 = hasher.hexdigest()
            key = content_key(sha256)
            # Content-addressed dedupe: identical bytes already live at this
            # key, so skip the upload entirely (a HeadObject is far cheaper
            # than re-shipping a multi-MB body to Garage).
            if self.stat(key) is None:
                spool.seek(0)
                self.client.put_object(
                    Bucket=self._bucket,
                    Key=key,
                    Body=spool,
                    ContentLength=size,
                    ContentType=mime,
                )
        return StoredBlob(storage_key=key, sha256=sha256, size_bytes=size, mime=mime)

    @contextmanager
    def open_stream(self, storage_key: str) -> Generator[Iterator[bytes], None, None]:
        response: Any = self.client.get_object(Bucket=self._bucket, Key=storage_key)
        body: Any = response["Body"]
        try:
            yield iter(lambda: body.read(_CHUNK_SIZE), b"")
        finally:
            body.close()

    def stat(self, storage_key: str) -> BlobStat | None:
        try:
            response: Any = self.client.head_object(Bucket=self._bucket, Key=storage_key)
        except ClientError as exc:
            if _is_missing(exc):
                return None
            raise
        size_bytes: int = response["ContentLength"]
        mime: str = response.get("ContentType") or "application/octet-stream"
        return BlobStat(size_bytes=size_bytes, mime=mime)

    def delete(self, storage_key: str) -> None:
        self.client.delete_object(Bucket=self._bucket, Key=storage_key)

    def healthcheck(self) -> HealthStatus:
        # `/healthz` is wired to the startup, readiness, AND liveness probes
        # for every api pod (see the MD1 ticket). If a Garage outage made this
        # raise or hang, every pod in both slots would fail liveness and
        # crashloop — a self-inflicted outage from a dependency that isn't
        # even on the critical path yet. So: never raise (the broad `except`
        # below is deliberate — do not narrow it), and never hang (the health
        # client is built with a 2s/2s timeout and a single retry, well inside
        # any probe period). Do not "clean this up" without re-reading why.
        try:
            self.health_client.head_bucket(Bucket=self._bucket)
        except Exception:
            return "error"
        return "ok"


def _is_missing(exc: ClientError) -> bool:
    response: Any = exc.response
    code = response.get("Error", {}).get("Code", "")
    status = response.get("ResponseMetadata", {}).get("HTTPStatusCode")
    return status == 404 or code in {"404", "NoSuchKey", "NotFound"}


# ─── In-memory (tests, dev without S3 reachable) ───────────────────────────


@dataclass
class _MemoryObject:
    data: bytes
    mime: str


class MemoryMediaStore:
    """Process-local `MediaStore` — no network, no disk, gone on process exit.

    This is what `deps.py` hands out when S3 isn't configured, which is every
    dev box on this laptop (Garage isn't reachable from here) and the whole
    test suite. `healthcheck()` always reports "unconfigured": that's simply a
    true fact about this store — it never claims to be real storage — not a
    read of `app.config.settings` (this class touches no global state at all).
    """

    def __init__(self) -> None:
        self._objects: dict[str, _MemoryObject] = {}
        # Exposed for tests to assert the dedupe path took no second write.
        self.put_count = 0

    def put_stream(self, fileobj: BinaryIO, mime: str) -> StoredBlob:
        hasher = hashlib.sha256()
        chunks: list[bytes] = []
        size = 0
        for chunk in iter(lambda: fileobj.read(_CHUNK_SIZE), b""):
            hasher.update(chunk)
            chunks.append(chunk)
            size += len(chunk)
        sha256 = hasher.hexdigest()
        key = content_key(sha256)
        if key not in self._objects:
            self._objects[key] = _MemoryObject(data=b"".join(chunks), mime=mime)
            self.put_count += 1
        return StoredBlob(storage_key=key, sha256=sha256, size_bytes=size, mime=mime)

    @contextmanager
    def open_stream(self, storage_key: str) -> Generator[Iterator[bytes], None, None]:
        obj = self._objects.get(storage_key)
        if obj is None:
            raise FileNotFoundError(storage_key)
        yield iter([obj.data])

    def stat(self, storage_key: str) -> BlobStat | None:
        obj = self._objects.get(storage_key)
        if obj is None:
            return None
        return BlobStat(size_bytes=len(obj.data), mime=obj.mime)

    def delete(self, storage_key: str) -> None:
        self._objects.pop(storage_key, None)

    def healthcheck(self) -> HealthStatus:
        return "unconfigured"


# ─── Streaming download helper ─────────────────────────────────────────────


def stream_blob_response(
    store: MediaStore, storage_key: str, sha256: str, stat: BlobStat
) -> StreamingResponse:
    """Build a `StreamingResponse` for an already-`stat`'d blob.

    Takes the `BlobStat` rather than calling `store.stat()` itself so the
    caller (a future router) owns the 404 path with its own error handling —
    this module stays free of a dependency on `app.errors`. No route consumes
    this yet (SB2 and RC1 will be the first); it lives here so both copy the
    same Content-Length/ETag handling instead of reinventing it twice.
    """

    def body() -> Iterator[bytes]:
        with store.open_stream(storage_key) as stream:
            yield from stream

    headers = {
        "Content-Length": str(stat.size_bytes),
        # Quoted per RFC 9110 §8.8.3 — the digest is a strong validator since
        # the key it names is itself content-addressed by this same hash.
        "ETag": f'"{sha256}"',
    }
    return StreamingResponse(body(), media_type=stat.mime, headers=headers)
