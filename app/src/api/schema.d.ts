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
        /** HTTPValidationError */
        HTTPValidationError: {
            /** Detail */
            detail?: components["schemas"]["ValidationError"][];
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
}
