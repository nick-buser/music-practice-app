"""MediaStore: hashing/dedupe/streaming semantics, and the /healthz contract.

No network, no services — `S3MediaStore` is exercised entirely against
botocore's `Stubber`, which intercepts calls before anything reaches the
socket layer. `Stubber`'s strict call-order/queue semantics (an unqueued call
raises immediately) are what let `test_put_stream_hashes_keys_and_dedupes`
prove "no second upload" without any wall-clock or call-count bookkeeping of
our own.
"""

from __future__ import annotations

import hashlib
import io
import os

import pytest
from botocore.response import StreamingBody
from botocore.stub import ANY, Stubber
from fastapi.testclient import TestClient

from app.deps import get_media_store
from app.main import app
from app.storage import BlobStat, MediaStore, MemoryMediaStore, S3MediaStore, content_key

_ENDPOINT = "http://garage.example.invalid:3900"
_REGION = "us-east-1"
_BUCKET = "soundings-test"
_ACCESS_KEY = "test-access-key-id"
_SECRET_KEY = "test-secret-access-key"


def _make_store() -> S3MediaStore:
    return S3MediaStore(
        endpoint=_ENDPOINT,
        region=_REGION,
        bucket=_BUCKET,
        access_key_id=_ACCESS_KEY,
        secret_access_key=_SECRET_KEY,
        force_path_style=True,
    )


@pytest.fixture
def s3_store() -> S3MediaStore:
    return _make_store()


# ─── S3MediaStore: construction / addressing ───────────────────────────────


def test_client_is_built_path_style_against_configured_endpoint(s3_store: S3MediaStore) -> None:
    config = s3_store.client.meta.config
    assert config.s3["addressing_style"] == "path"
    assert s3_store.client.meta.endpoint_url == _ENDPOINT


# ─── S3MediaStore: put_stream (hash, key, dedupe) ──────────────────────────


def test_put_stream_hashes_keys_and_dedupes(s3_store: S3MediaStore) -> None:
    payload = os.urandom(3 * 1024 * 1024)
    sha256 = hashlib.sha256(payload).hexdigest()
    key = content_key(sha256)
    assert key == f"media/{sha256[:2]}/{sha256}"

    stubber = Stubber(s3_store.client)
    # First put: object doesn't exist yet (HeadObject 404) → PutObject happens.
    stubber.add_client_error(
        "head_object",
        service_error_code="404",
        http_status_code=404,
        expected_params={"Bucket": _BUCKET, "Key": key},
    )
    stubber.add_response(
        "put_object",
        {},
        expected_params={
            "Bucket": _BUCKET,
            "Key": key,
            "Body": ANY,
            "ContentLength": len(payload),
            "ContentType": "audio/wav",
        },
    )
    # Second put of the *same bytes*: HeadObject now finds it, so no PutObject
    # is queued — if the code tried one anyway, Stubber raises on the spot.
    stubber.add_response(
        "head_object",
        {"ContentLength": len(payload), "ContentType": "audio/wav"},
        expected_params={"Bucket": _BUCKET, "Key": key},
    )

    with stubber:
        blob = s3_store.put_stream(io.BytesIO(payload), "audio/wav")
        assert blob.sha256 == sha256
        assert blob.storage_key == key
        assert blob.size_bytes == len(payload)
        assert blob.mime == "audio/wav"

        blob_again = s3_store.put_stream(io.BytesIO(payload), "audio/wav")
        assert blob_again == blob

        stubber.assert_no_pending_responses()


# ─── S3MediaStore: stat ─────────────────────────────────────────────────────


def test_stat_returns_none_for_missing_object(s3_store: S3MediaStore) -> None:
    stubber = Stubber(s3_store.client)
    stubber.add_client_error(
        "head_object",
        service_error_code="404",
        http_status_code=404,
        expected_params={"Bucket": _BUCKET, "Key": "media/zz/missing"},
    )
    with stubber:
        assert s3_store.stat("media/zz/missing") is None
    stubber.assert_no_pending_responses()


def test_stat_returns_blob_stat_for_existing_object(s3_store: S3MediaStore) -> None:
    stubber = Stubber(s3_store.client)
    stubber.add_response(
        "head_object",
        {"ContentLength": 42, "ContentType": "audio/wav"},
        expected_params={"Bucket": _BUCKET, "Key": "media/aa/exists"},
    )
    with stubber:
        result = s3_store.stat("media/aa/exists")
    assert result == BlobStat(size_bytes=42, mime="audio/wav")
    stubber.assert_no_pending_responses()


# ─── S3MediaStore: open_stream (GetObject) ─────────────────────────────────


def test_open_stream_streams_bytes_via_get_object(s3_store: S3MediaStore) -> None:
    payload = b"practice session audio bytes" * 10
    key = "media/aa/deadbeef"
    stubber = Stubber(s3_store.client)
    stubber.add_response(
        "get_object",
        {
            "Body": StreamingBody(io.BytesIO(payload), len(payload)),
            "ContentLength": len(payload),
            "ContentType": "audio/wav",
        },
        expected_params={"Bucket": _BUCKET, "Key": key},
    )
    with stubber, s3_store.open_stream(key) as stream:
        data = b"".join(stream)
    assert data == payload
    stubber.assert_no_pending_responses()


# ─── S3MediaStore: healthcheck (never raises, never hangs) ─────────────────


def test_healthcheck_ok_when_head_bucket_succeeds(s3_store: S3MediaStore) -> None:
    stubber = Stubber(s3_store.health_client)
    stubber.add_response("head_bucket", {}, expected_params={"Bucket": _BUCKET})
    with stubber:
        assert s3_store.healthcheck() == "ok"
    stubber.assert_no_pending_responses()


def test_healthcheck_error_when_head_bucket_raises(s3_store: S3MediaStore) -> None:
    stubber = Stubber(s3_store.health_client)
    stubber.add_client_error(
        "head_bucket",
        service_error_code="500",
        http_status_code=500,
        expected_params={"Bucket": _BUCKET},
    )
    with stubber:
        assert s3_store.healthcheck() == "error"
    stubber.assert_no_pending_responses()


def test_healthcheck_swallows_even_an_unstubbed_call(s3_store: S3MediaStore) -> None:
    """The regression guard for the crashloop hazard: nothing escapes this method.

    No response is queued at all, so `head_bucket` raises botocore's own
    "unexpected API call" error from inside the stub machinery.
    `healthcheck()`'s broad `except Exception` must still turn that into
    "error" rather than letting it propagate — exactly what must never happen
    against a real, misbehaving Garage.
    """
    stubber = Stubber(s3_store.health_client)
    with stubber:
        assert s3_store.healthcheck() == "error"


# ─── MemoryMediaStore ───────────────────────────────────────────────────────


def test_memory_store_hashes_keys_and_dedupes() -> None:
    store = MemoryMediaStore()
    payload = os.urandom(3 * 1024 * 1024)
    sha256 = hashlib.sha256(payload).hexdigest()
    key = content_key(sha256)

    blob = store.put_stream(io.BytesIO(payload), "audio/wav")
    assert blob.sha256 == sha256
    assert blob.storage_key == key
    assert blob.size_bytes == len(payload)
    assert store.put_count == 1

    blob_again = store.put_stream(io.BytesIO(payload), "audio/wav")
    assert blob_again.storage_key == key
    assert store.put_count == 1  # dedupe hit — no second "upload"


def test_memory_store_open_stream_roundtrip() -> None:
    store = MemoryMediaStore()
    payload = b"a short practice note recording"
    blob = store.put_stream(io.BytesIO(payload), "audio/wav")
    with store.open_stream(blob.storage_key) as stream:
        assert b"".join(stream) == payload


def test_memory_store_open_stream_missing_key_raises() -> None:
    store = MemoryMediaStore()
    with pytest.raises(FileNotFoundError), store.open_stream("media/00/nope"):
        pass


def test_memory_store_stat_and_delete() -> None:
    store = MemoryMediaStore()
    payload = b"x" * 10
    blob = store.put_stream(io.BytesIO(payload), "text/plain")
    assert store.stat(blob.storage_key) == BlobStat(size_bytes=10, mime="text/plain")
    store.delete(blob.storage_key)
    assert store.stat(blob.storage_key) is None


def test_memory_store_healthcheck_is_unconfigured() -> None:
    assert MemoryMediaStore().healthcheck() == "unconfigured"


def test_memory_store_satisfies_media_store_protocol() -> None:
    store: MediaStore = MemoryMediaStore()
    assert store.healthcheck() == "unconfigured"


# ─── /healthz: the crashloop-hazard regression guard ───────────────────────


def test_healthz_is_always_200_and_reports_unconfigured(client: TestClient) -> None:
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "storage": "unconfigured"}


def test_healthz_is_always_200_and_reports_ok(client: TestClient) -> None:
    store = _make_store()
    stubber = Stubber(store.health_client)
    stubber.add_response("head_bucket", {}, expected_params={"Bucket": _BUCKET})
    app.dependency_overrides[get_media_store] = lambda: store
    try:
        with stubber:
            r = client.get("/healthz")
    finally:
        app.dependency_overrides.pop(get_media_store, None)

    assert r.status_code == 200
    assert r.json() == {"status": "ok", "storage": "ok"}


def test_healthz_is_always_200_and_reports_error(client: TestClient) -> None:
    store = _make_store()
    stubber = Stubber(store.health_client)
    stubber.add_client_error(
        "head_bucket",
        service_error_code="500",
        http_status_code=500,
        expected_params={"Bucket": _BUCKET},
    )
    app.dependency_overrides[get_media_store] = lambda: store
    try:
        with stubber:
            r = client.get("/healthz")
    finally:
        app.dependency_overrides.pop(get_media_store, None)

    # The one assertion that matters most: a broken storage backend must never
    # turn into a non-2xx /healthz, or every api pod fails liveness at once.
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "storage": "error"}


# ─── stream_blob_response helper ───────────────────────────────────────────


def test_stream_blob_response_sets_headers_and_streams_body() -> None:
    from app.storage import stream_blob_response

    store = MemoryMediaStore()
    payload = b"idea asset bytes"
    blob = store.put_stream(io.BytesIO(payload), "audio/wav")
    stat = store.stat(blob.storage_key)
    assert stat is not None

    response = stream_blob_response(store, blob.storage_key, blob.sha256, stat)

    assert response.media_type == "audio/wav"
    assert response.headers["Content-Length"] == str(len(payload))
    assert response.headers["ETag"] == f'"{blob.sha256}"'

    async def _drain() -> list[bytes]:
        chunks: list[bytes] = []
        body_iterator = response.body_iterator
        async for chunk in body_iterator:
            chunks.append(chunk.encode() if isinstance(chunk, str) else bytes(chunk))
        return chunks

    import asyncio

    collected = asyncio.run(_drain())
    assert b"".join(collected) == payload
