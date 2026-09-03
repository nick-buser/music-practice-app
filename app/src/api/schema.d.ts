/**
 * AUTO-GENERATED from backend/openapi.json by `npm run gen:api` — do not edit.
 * Regenerate when the backend contract changes; src/api/schema.drift.test.ts
 * fails if this file drifts from the committed openapi.json.
 */
export interface paths {
    "/healthz": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Healthz
         * @description Liveness — the process is up.
         *
         *     Wired to the startup, readiness, AND liveness probes for every api pod, so
         *     this handler must always return 200 no matter what storage is doing —
         *     `storage` in the body carries that state instead. `MediaStore.healthcheck()`
         *     is the contract that makes that safe (never raises, never hangs); this
         *     handler adds nothing on top that could break it.
         */
        get: operations["healthz_healthz_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/readyz": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Readyz
         * @description Readiness — the database is reachable.
         */
        get: operations["readyz_readyz_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/chords": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Chords */
        get: operations["list_chords_v1_chords_get"];
        put?: never;
        /** Create Chord */
        post: operations["create_chord_v1_chords_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/chords/{chord_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Chord */
        get: operations["get_chord_v1_chords__chord_id__get"];
        put?: never;
        post?: never;
        /** Delete Chord */
        delete: operations["delete_chord_v1_chords__chord_id__delete"];
        options?: never;
        head?: never;
        /** Update Chord */
        patch: operations["update_chord_v1_chords__chord_id__patch"];
        trace?: never;
    };
    "/v1/ideas": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Ideas */
        get: operations["list_ideas_v1_ideas_get"];
        put?: never;
        /** Create Idea */
        post: operations["create_idea_v1_ideas_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/ideas/{idea_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Idea */
        get: operations["get_idea_v1_ideas__idea_id__get"];
        put?: never;
        post?: never;
        /** Delete Idea */
        delete: operations["delete_idea_v1_ideas__idea_id__delete"];
        options?: never;
        head?: never;
        /** Update Idea */
        patch: operations["update_idea_v1_ideas__idea_id__patch"];
        trace?: never;
    };
    "/v1/ideas/{idea_id}/assets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Assets */
        get: operations["list_assets_v1_ideas__idea_id__assets_get"];
        put?: never;
        /** Upload Asset */
        post: operations["upload_asset_v1_ideas__idea_id__assets_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/ideas/{idea_id}/assets/{asset_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete Asset */
        delete: operations["delete_asset_v1_ideas__idea_id__assets__asset_id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/ideas/{idea_id}/assets/{asset_id}/content": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Download Asset */
        get: operations["download_asset_v1_ideas__idea_id__assets__asset_id__content_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/ideas/{idea_id}/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Export Idea Bundle */
        get: operations["export_idea_bundle_v1_ideas__idea_id__export_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/ideas/{idea_id}/links": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create Link */
        post: operations["create_link_v1_ideas__idea_id__links_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/ideas/{idea_id}/links/{link_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete Link */
        delete: operations["delete_link_v1_ideas__idea_id__links__link_id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/recording-cadences": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Recording Cadences */
        get: operations["list_recording_cadences_v1_recording_cadences_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/recording-cadences/{subject_kind}/{subject_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Put Recording Cadence */
        put: operations["put_recording_cadence_v1_recording_cadences__subject_kind___subject_id__put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/recordings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Recordings */
        get: operations["list_recordings_v1_recordings_get"];
        put?: never;
        /** Create Recording */
        post: operations["create_recording_v1_recordings_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/recordings/{recording_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Recording */
        get: operations["get_recording_v1_recordings__recording_id__get"];
        put?: never;
        post?: never;
        /** Delete Recording */
        delete: operations["delete_recording_v1_recordings__recording_id__delete"];
        options?: never;
        head?: never;
        /** Update Recording */
        patch: operations["update_recording_v1_recordings__recording_id__patch"];
        trace?: never;
    };
    "/v1/recordings/{recording_id}/tracks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Upload Track */
        post: operations["upload_track_v1_recordings__recording_id__tracks_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/recordings/{recording_id}/tracks/{track_id}/content": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Download Track */
        get: operations["download_track_v1_recordings__recording_id__tracks__track_id__content_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/runs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create Run */
        post: operations["create_run_v1_runs_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/runs/{run_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Run */
        get: operations["get_run_v1_runs__run_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Sessions */
        get: operations["list_sessions_v1_sessions_get"];
        put?: never;
        /** Create Session */
        post: operations["create_session_v1_sessions_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/sessions/{session_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Session */
        get: operations["get_session_v1_sessions__session_id__get"];
        put?: never;
        post?: never;
        /** Delete Session */
        delete: operations["delete_session_v1_sessions__session_id__delete"];
        options?: never;
        head?: never;
        /** Update Session */
        patch: operations["update_session_v1_sessions__session_id__patch"];
        trace?: never;
    };
    "/v1/subjects/{kind}/{subject_id}/properties": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Subject Properties */
        get: operations["list_subject_properties_v1_subjects__kind___subject_id__properties_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/subjects/{kind}/{subject_id}/runs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Subject Runs */
        get: operations["list_subject_runs_v1_subjects__kind___subject_id__runs_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** Alteration */
        Alteration: {
            /**
             * Change
             * @enum {string}
             */
            change: "#" | "b";
            /**
             * Degree
             * @enum {integer}
             */
            degree: 5 | 9 | 11 | 13;
        };
        /** Body_upload_asset_v1_ideas__idea_id__assets_post */
        Body_upload_asset_v1_ideas__idea_id__assets_post: {
            /** File */
            file: string;
            /**
             * Newrevision
             * @default false
             */
            newRevision?: boolean;
            /**
             * Role
             * @enum {string}
             */
            role: "melody" | "harmony" | "bass" | "drums" | "full" | "render" | "score" | "rpp" | "reference" | "image" | "other";
        };
        /** Body_upload_track_v1_recordings__recording_id__tracks_post */
        Body_upload_track_v1_recordings__recording_id__tracks_post: {
            /** File */
            file: string;
            /**
             * Kind
             * @enum {string}
             */
            kind: "audio" | "midi";
            /**
             * Offsetms
             * @default 0
             */
            offsetMs?: number;
        };
        /** ChordIdentity */
        ChordIdentity: {
            /** Alterations */
            alterations?: components["schemas"]["Alteration"][];
            /** Extensions */
            extensions?: (6 | 7 | 9 | 11 | 13)[];
            /**
             * Quality
             * @enum {string}
             */
            quality: "major" | "minor" | "dim" | "aug" | "sus2" | "sus4";
            root: components["schemas"]["Root"];
            /** Seventh */
            seventh?: ("maj7" | "min7" | "dim7") | null;
            voicing: components["schemas"]["Voicing"];
        };
        /**
         * ExtractedPropertyWithRun
         * @description A property plus the run that produced it — the lineage badge every
         *     provenance read carries ("tempo curve — beat-tracker v0.3 · Jul 12 take").
         */
        ExtractedPropertyWithRun: {
            /** Confidence */
            confidence: number | null;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Kind */
            kind: string;
            /** Payload */
            payload: {
                [key: string]: unknown;
            };
            run: components["schemas"]["ExtractionRunRead"];
            /** Timerange */
            timeRange: {
                [key: string]: unknown;
            } | null;
        };
        /** ExtractionRunRead */
        ExtractionRunRead: {
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            /** Error */
            error: string | null;
            /**
             * Executor
             * @enum {string}
             */
            executor: "worker" | "client" | "external";
            /** Extractor */
            extractor: string;
            /** Extractorversion */
            extractorVersion: string;
            /** Finishedat */
            finishedAt: string | null;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Inputsha256S */
            inputSha256s: string[];
            /** Modelref */
            modelRef: string | null;
            /** Params */
            params: {
                [key: string]: unknown;
            };
            /** Paramshash */
            paramsHash: string;
            /** Startedat */
            startedAt: string | null;
            /**
             * Status
             * @enum {string}
             */
            status: "queued" | "running" | "succeeded" | "failed";
            /** Subjectid */
            subjectId: string;
            /** Subjectkind */
            subjectKind: string;
            /**
             * Updatedat
             * Format: date-time
             */
            updatedAt: string;
        };
        /** HTTPValidationError */
        HTTPValidationError: {
            /** Detail */
            detail?: components["schemas"]["ValidationError"][];
        };
        /** IdeaAssetRead */
        IdeaAssetRead: {
            /** Bytes */
            bytes: number;
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            /** Filename */
            filename: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Ideaid
             * Format: uuid
             */
            ideaId: string;
            /** Mime */
            mime: string;
            /** Revision */
            revision: number;
            /**
             * Role
             * @enum {string}
             */
            role: "melody" | "harmony" | "bass" | "drums" | "full" | "render" | "score" | "rpp" | "reference" | "image" | "other";
            /** Runid */
            runId: string | null;
            /** Sha256 */
            sha256: string;
            /** Storagekey */
            storageKey: string;
            /**
             * Updatedat
             * Format: date-time
             */
            updatedAt: string;
        };
        /**
         * IdeaAssetRevisionGroup
         * @description One revision's attachment set, newest revision first — see the doc:
         *     "'Save to Sketchbook' from REAPER writes revision n+1, and earlier
         *     revisions stay." Pre-grouped so the idea page can render "attachments
         *     by revision" in one pass, the same reasoning `IdeaLinkEdge`
         *     (`app/schemas/idea.py`) gives for carrying the *other* idea's identity
         *     rather than making the frontend re-derive a shape the backend already
         *     knows.
         */
        IdeaAssetRevisionGroup: {
            /** Assets */
            assets: components["schemas"]["IdeaAssetRead"][];
            /** Revision */
            revision: number;
        };
        /** IdeaCreate */
        IdeaCreate: {
            /**
             * Body
             * @default
             */
            body?: string;
            /** Bpm */
            bpm?: number | null;
            /** Capturedat */
            capturedAt?: string | null;
            /** Id */
            id?: string | null;
            /** Key */
            key?: string | null;
            /** Kinds */
            kinds?: string[];
            /** Meter */
            meter?: string | null;
            /**
             * Status
             * @default inbox
             * @enum {string}
             */
            status?: "inbox" | "active" | "shelved" | "done";
            /** Tags */
            tags?: string[];
            /** Title */
            title?: string | null;
        };
        /** IdeaLinkCreate */
        IdeaLinkCreate: {
            /**
             * Kind
             * @enum {string}
             */
            kind: "derived_from" | "variant_of" | "resembles" | "might_fit_with" | "inspired_by" | "incorporated_into" | "responds_to" | "mentions";
            /** Note */
            note?: string | null;
            /**
             * Toid
             * Format: uuid
             */
            toId: string;
        };
        /**
         * IdeaLinkEdge
         * @description One edge as seen from an idea's own page — see the module docstring
         *     for why this carries the *other* idea's identity, not `from_id`/`to_id`.
         */
        IdeaLinkEdge: {
            /** Handle */
            handle: number;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Ideaid
             * Format: uuid
             */
            ideaId: string;
            /**
             * Kind
             * @enum {string}
             */
            kind: "derived_from" | "variant_of" | "resembles" | "might_fit_with" | "inspired_by" | "incorporated_into" | "responds_to" | "mentions";
            /** Note */
            note: string | null;
            /** Title */
            title: string | null;
        };
        /** IdeaRead */
        IdeaRead: {
            /** Body */
            body: string;
            /** Bpm */
            bpm: number | null;
            /**
             * Capturedat
             * Format: date-time
             */
            capturedAt: string;
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            /** Handle */
            handle: number;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Key */
            key: string | null;
            /** Kinds */
            kinds: string[];
            /** Linksin */
            linksIn: components["schemas"]["IdeaLinkEdge"][];
            /** Linksout */
            linksOut: components["schemas"]["IdeaLinkEdge"][];
            /** Meter */
            meter: string | null;
            /**
             * Status
             * @enum {string}
             */
            status: "inbox" | "active" | "shelved" | "done";
            /** Tags */
            tags: string[];
            /** Title */
            title: string | null;
            /**
             * Updatedat
             * Format: date-time
             */
            updatedAt: string;
        };
        /**
         * IdeaSummary
         * @description The list-view shape — no links, so `GET /v1/ideas` stays one query
         *     per page rather than N+1 (see `IdeaRead` for the single-idea shape that
         *     does carry them).
         */
        IdeaSummary: {
            /** Body */
            body: string;
            /** Bpm */
            bpm: number | null;
            /**
             * Capturedat
             * Format: date-time
             */
            capturedAt: string;
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            /** Handle */
            handle: number;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Key */
            key: string | null;
            /** Kinds */
            kinds: string[];
            /** Meter */
            meter: string | null;
            /**
             * Status
             * @enum {string}
             */
            status: "inbox" | "active" | "shelved" | "done";
            /** Tags */
            tags: string[];
            /** Title */
            title: string | null;
            /**
             * Updatedat
             * Format: date-time
             */
            updatedAt: string;
        };
        /** IdeaUpdate */
        IdeaUpdate: {
            /** Body */
            body?: string | null;
            /** Bpm */
            bpm?: number | null;
            /** Key */
            key?: string | null;
            /** Kinds */
            kinds?: string[] | null;
            /** Meter */
            meter?: string | null;
            /** Status */
            status?: ("inbox" | "active" | "shelved" | "done") | null;
            /** Tags */
            tags?: string[] | null;
            /** Title */
            title?: string | null;
        };
        /** Page[ExtractionRunRead] */
        Page_ExtractionRunRead_: {
            /** Items */
            items: components["schemas"]["ExtractionRunRead"][];
            /** Limit */
            limit: number;
            /** Offset */
            offset: number;
            /** Total */
            total: number;
        };
        /** Page[IdeaSummary] */
        Page_IdeaSummary_: {
            /** Items */
            items: components["schemas"]["IdeaSummary"][];
            /** Limit */
            limit: number;
            /** Offset */
            offset: number;
            /** Total */
            total: number;
        };
        /** Page[PracticeSessionRead] */
        Page_PracticeSessionRead_: {
            /** Items */
            items: components["schemas"]["PracticeSessionRead"][];
            /** Limit */
            limit: number;
            /** Offset */
            offset: number;
            /** Total */
            total: number;
        };
        /** Page[RecordingSummary] */
        Page_RecordingSummary_: {
            /** Items */
            items: components["schemas"]["RecordingSummary"][];
            /** Limit */
            limit: number;
            /** Offset */
            offset: number;
            /** Total */
            total: number;
        };
        /** Page[SavedChordRead] */
        Page_SavedChordRead_: {
            /** Items */
            items: components["schemas"]["SavedChordRead"][];
            /** Limit */
            limit: number;
            /** Offset */
            offset: number;
            /** Total */
            total: number;
        };
        /** PracticeSessionCreate */
        PracticeSessionCreate: {
            /** Bpm */
            bpm?: number | null;
            /**
             * Durationseconds
             * @default 0
             */
            durationSeconds?: number;
            /** Id */
            id?: string | null;
            /** Notes */
            notes?: string | null;
            /**
             * Startedat
             * Format: date-time
             */
            startedAt: string;
            /** Subjectid */
            subjectId: string;
        };
        /** PracticeSessionRead */
        PracticeSessionRead: {
            /** Bpm */
            bpm: number | null;
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            /** Durationseconds */
            durationSeconds: number;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Notes */
            notes: string | null;
            /**
             * Startedat
             * Format: date-time
             */
            startedAt: string;
            /** Subjectid */
            subjectId: string;
            /**
             * Updatedat
             * Format: date-time
             */
            updatedAt: string;
        };
        /** PracticeSessionUpdate */
        PracticeSessionUpdate: {
            /** Bpm */
            bpm?: number | null;
            /** Durationseconds */
            durationSeconds?: number | null;
            /** Notes */
            notes?: string | null;
        };
        /**
         * Problem
         * @description RFC 9457 (problem+json) error body.
         */
        Problem: {
            /**
             * Detail
             * @default null
             */
            detail?: string | null;
            /**
             * Instance
             * @default null
             */
            instance?: string | null;
            /** Status */
            status: number;
            /** Title */
            title: string;
            /**
             * Type
             * @default about:blank
             */
            type?: string;
        };
        /** PropertyIn */
        PropertyIn: {
            /** Confidence */
            confidence?: number | null;
            /** Kind */
            kind: string;
            /** Payload */
            payload: {
                [key: string]: unknown;
            };
            /** Timerange */
            timeRange?: {
                [key: string]: unknown;
            } | null;
        };
        /** RecordingCadenceRead */
        RecordingCadenceRead: {
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Intervaldays */
            intervalDays: number | null;
            /** Subjectid */
            subjectId: string;
            /** Subjectkind */
            subjectKind: string;
            /**
             * Updatedat
             * Format: date-time
             */
            updatedAt: string;
        };
        /**
         * RecordingCadenceUpdate
         * @description The `PUT .../{subject_kind}/{subject_id}` body — RC3. `None` is "off"
         *     (see `RecordingCadence`'s docstring in `app/models/recording.py` for why
         *     that, and not `0` or a DELETE, is the one representation); a set value
         *     is bounded the same way `RecordingCreate.duration_ms` bounds its field —
         *     a sane domain limit (≤ 10 years) keeps an absurd value a 422, not a
         *     silently-accepted row nothing will ever hit.
         */
        RecordingCadenceUpdate: {
            /** Intervaldays */
            intervalDays?: number | null;
        };
        /** RecordingCreate */
        RecordingCreate: {
            /**
             * Capturedat
             * Format: date-time
             */
            capturedAt: string;
            /** Durationms */
            durationMs?: number | null;
            /** Id */
            id?: string | null;
            /** Notes */
            notes?: string | null;
            /** Sessionid */
            sessionId?: string | null;
            /** Subjectid */
            subjectId?: string | null;
            /** Subjectkind */
            subjectKind?: string | null;
        };
        /** RecordingRead */
        RecordingRead: {
            /**
             * Capturedat
             * Format: date-time
             */
            capturedAt: string;
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            /** Durationms */
            durationMs: number | null;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Notes */
            notes: string | null;
            /** Sessionid */
            sessionId: string | null;
            /** Subjectid */
            subjectId: string | null;
            /** Subjectkind */
            subjectKind: string | null;
            /** Tracks */
            tracks: components["schemas"]["RecordingTrackRead"][];
            /**
             * Updatedat
             * Format: date-time
             */
            updatedAt: string;
        };
        /**
         * RecordingSummary
         * @description The list-view shape — no tracks, so `GET /v1/recordings` stays one
         *     query per page rather than N+1 (see `RecordingRead` for the
         *     single-recording shape that does carry them) — the same split
         *     `IdeaSummary`/`IdeaRead` use in `app/schemas/idea.py`, for the same
         *     reason.
         */
        RecordingSummary: {
            /**
             * Capturedat
             * Format: date-time
             */
            capturedAt: string;
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            /** Durationms */
            durationMs: number | null;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Notes */
            notes: string | null;
            /** Sessionid */
            sessionId: string | null;
            /** Subjectid */
            subjectId: string | null;
            /** Subjectkind */
            subjectKind: string | null;
            /**
             * Updatedat
             * Format: date-time
             */
            updatedAt: string;
        };
        /** RecordingTrackRead */
        RecordingTrackRead: {
            /** Bytes */
            bytes: number;
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Kind
             * @enum {string}
             */
            kind: "audio" | "midi";
            /** Mime */
            mime: string;
            /** Offsetms */
            offsetMs: number;
            /**
             * Recordingid
             * Format: uuid
             */
            recordingId: string;
            /** Sha256 */
            sha256: string;
            /** Storagekey */
            storageKey: string;
            /**
             * Updatedat
             * Format: date-time
             */
            updatedAt: string;
        };
        /** RecordingUpdate */
        RecordingUpdate: {
            /** Durationms */
            durationMs?: number | null;
            /** Notes */
            notes?: string | null;
        };
        /** Root */
        Root: {
            /**
             * Accidental
             * @enum {string}
             */
            accidental: "natural" | "sharp" | "flat";
            /**
             * Letter
             * @enum {string}
             */
            letter: "A" | "B" | "C" | "D" | "E" | "F" | "G";
        };
        /** RunCreate */
        RunCreate: {
            /** Error */
            error?: string | null;
            /**
             * Executor
             * @enum {string}
             */
            executor: "worker" | "client" | "external";
            /** Extractor */
            extractor: string;
            /** Extractorversion */
            extractorVersion: string;
            /** Inputsha256S */
            inputSha256s?: string[];
            /** Modelref */
            modelRef?: string | null;
            /** Params */
            params?: {
                [key: string]: unknown;
            };
            /** Properties */
            properties?: components["schemas"]["PropertyIn"][];
            /** Status */
            status?: ("succeeded" | "failed") | null;
            /** Subjectid */
            subjectId: string;
            /** Subjectkind */
            subjectKind: string;
        };
        /** SavedChordCreate */
        SavedChordCreate: {
            /** Id */
            id?: string | null;
            identity: components["schemas"]["ChordIdentity"];
            /** Label */
            label?: string | null;
        };
        /** SavedChordRead */
        SavedChordRead: {
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            identity: components["schemas"]["ChordIdentity"];
            /** Label */
            label: string | null;
            /**
             * Updatedat
             * Format: date-time
             */
            updatedAt: string;
        };
        /** SavedChordUpdate */
        SavedChordUpdate: {
            identity?: components["schemas"]["ChordIdentity"] | null;
            /** Label */
            label?: string | null;
        };
        /** ValidationError */
        ValidationError: {
            /** Context */
            ctx?: Record<string, never>;
            /** Input */
            input?: unknown;
            /** Location */
            loc: (string | number)[];
            /** Message */
            msg: string;
            /** Error Type */
            type: string;
        };
        /** Voicing */
        Voicing: {
            /**
             * Doubleroot
             * @default false
             */
            doubleRoot?: boolean;
            /**
             * Inversion
             * @default 0
             * @enum {integer}
             */
            inversion?: 0 | 1 | 2 | 3;
            /**
             * Rootoctave
             * @default 4
             */
            rootOctave?: number;
            /**
             * Type
             * @default block
             * @enum {string}
             */
            type?: "block" | "drop2" | "drop3";
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    healthz_healthz_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: string;
                    };
                };
            };
            /** @description Error (problem+json) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Error (problem+json) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    readyz_readyz_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: string;
                    };
                };
            };
            /** @description Error (problem+json) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Error (problem+json) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    list_chords_v1_chords_get: {
        parameters: {
            query?: {
                limit?: number;
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Page_SavedChordRead_"];
                };
            };
            /** @description Error (problem+json) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Error (problem+json) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    create_chord_v1_chords_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SavedChordCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SavedChordRead"];
                };
            };
            /** @description Error (problem+json) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Error (problem+json) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    get_chord_v1_chords__chord_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                chord_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SavedChordRead"];
                };
            };
            /** @description Error (problem+json) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Error (problem+json) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    delete_chord_v1_chords__chord_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                chord_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Error (problem+json) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Error (problem+json) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    update_chord_v1_chords__chord_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                chord_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SavedChordUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SavedChordRead"];
                };
            };
            /** @description Error (problem+json) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Error (problem+json) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    list_ideas_v1_ideas_get: {
        parameters: {
            query?: {
                status?: ("inbox" | "active" | "shelved" | "done") | null;
                kind?: string | null;
                tag?: string | null;
                q?: string | null;
                limit?: number;
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Page_IdeaSummary_"];
                };
            };
            /** @description Error (problem+json) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Error (problem+json) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    create_idea_v1_ideas_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["IdeaCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IdeaRead"];
                };
            };
            /** @description Error (problem+json) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Error (problem+json) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    get_idea_v1_ideas__idea_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                idea_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IdeaRead"];
                };
            };
            /** @description Error (problem+json) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Error (problem+json) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    delete_idea_v1_ideas__idea_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                idea_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Error (problem+json) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Error (problem+json) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    update_idea_v1_ideas__idea_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                idea_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["IdeaUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IdeaRead"];
                };
            };
            /** @description Error (problem+json) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Error (problem+json) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    list_assets_v1_ideas__idea_id__assets_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                idea_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IdeaAssetRevisionGroup"][];
                };
            };
            /** @description Error (problem+json) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Error (problem+json) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    upload_asset_v1_ideas__idea_id__assets_post: {
        parameters: {
            query?: never;
            header?: {
                "content-length"?: number | null;
            };
            path: {
                idea_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["Body_upload_asset_v1_ideas__idea_id__assets_post"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IdeaAssetRead"];
                };
            };
            /** @description Error (problem+json) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Error (problem+json) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    delete_asset_v1_ideas__idea_id__assets__asset_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                idea_id: string;
                asset_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Error (problem+json) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Error (problem+json) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    download_asset_v1_ideas__idea_id__assets__asset_id__content_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                idea_id: string;
                asset_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/octet-stream": unknown;
                };
            };
            /** @description Error (problem+json) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Error (problem+json) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    export_idea_bundle_v1_ideas__idea_id__export_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                idea_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/zip": unknown;
                };
            };
            /** @description Error (problem+json) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Error (problem+json) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    create_link_v1_ideas__idea_id__links_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                idea_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["IdeaLinkCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IdeaLinkEdge"];
                };
            };
            /** @description Error (problem+json) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Error (problem+json) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    delete_link_v1_ideas__idea_id__links__link_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                idea_id: string;
                link_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Error (problem+json) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Error (problem+json) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    list_recording_cadences_v1_recording_cadences_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordingCadenceRead"][];
                };
            };
            /** @description Error (problem+json) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Error (problem+json) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    put_recording_cadence_v1_recording_cadences__subject_kind___subject_id__put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                subject_kind: string;
                subject_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RecordingCadenceUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordingCadenceRead"];
                };
            };
            /** @description Error (problem+json) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Error (problem+json) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    list_recordings_v1_recordings_get: {
        parameters: {
            query?: {
                subjectKind?: string | null;
                subjectId?: string | null;
                limit?: number;
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Page_RecordingSummary_"];
                };
            };
            /** @description Error (problem+json) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Error (problem+json) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    create_recording_v1_recordings_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RecordingCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordingRead"];
                };
            };
            /** @description Error (problem+json) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Error (problem+json) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    get_recording_v1_recordings__recording_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                recording_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordingRead"];
                };
            };
            /** @description Error (problem+json) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Error (problem+json) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    delete_recording_v1_recordings__recording_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                recording_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Error (problem+json) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Error (problem+json) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    update_recording_v1_recordings__recording_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                recording_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RecordingUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordingRead"];
                };
            };
            /** @description Error (problem+json) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Error (problem+json) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    upload_track_v1_recordings__recording_id__tracks_post: {
        parameters: {
            query?: never;
            header?: {
                "content-length"?: number | null;
            };
            path: {
                recording_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["Body_upload_track_v1_recordings__recording_id__tracks_post"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordingTrackRead"];
                };
            };
            /** @description Error (problem+json) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Error (problem+json) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    download_track_v1_recordings__recording_id__tracks__track_id__content_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                recording_id: string;
                track_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/octet-stream": unknown;
                };
            };
            /** @description Error (problem+json) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Error (problem+json) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    create_run_v1_runs_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RunCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExtractionRunRead"];
                };
            };
            /** @description Error (problem+json) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Error (problem+json) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    get_run_v1_runs__run_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                run_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExtractionRunRead"];
                };
            };
            /** @description Error (problem+json) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Error (problem+json) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    list_sessions_v1_sessions_get: {
        parameters: {
            query?: {
                limit?: number;
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Page_PracticeSessionRead_"];
                };
            };
            /** @description Error (problem+json) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Error (problem+json) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    create_session_v1_sessions_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PracticeSessionCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PracticeSessionRead"];
                };
            };
            /** @description Error (problem+json) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Error (problem+json) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    get_session_v1_sessions__session_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                session_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PracticeSessionRead"];
                };
            };
            /** @description Error (problem+json) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Error (problem+json) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    delete_session_v1_sessions__session_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                session_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Error (problem+json) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Error (problem+json) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    update_session_v1_sessions__session_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                session_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PracticeSessionUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PracticeSessionRead"];
                };
            };
            /** @description Error (problem+json) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Error (problem+json) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    list_subject_properties_v1_subjects__kind___subject_id__properties_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                kind: string;
                subject_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExtractedPropertyWithRun"][];
                };
            };
            /** @description Error (problem+json) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Error (problem+json) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    list_subject_runs_v1_subjects__kind___subject_id__runs_get: {
        parameters: {
            query?: {
                limit?: number;
                offset?: number;
            };
            header?: never;
            path: {
                kind: string;
                subject_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Page_ExtractionRunRead_"];
                };
            };
            /** @description Error (problem+json) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Error (problem+json) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
}
