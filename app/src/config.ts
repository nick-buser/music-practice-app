/**
 * Runtime capability config.
 *
 * One codebase ships in two shapes:
 *  - **Public** (Cloudflare Pages): no backend. The whole app runs on bundled
 *    static data + client-side Verovio. `VITE_API_BASE_URL` is unset, so
 *    `backendEnabled` is false and nothing ever calls — or hints at — a server.
 *  - **Local**: a backend is running. Point `VITE_API_BASE_URL` at its origin
 *    and backend-only features (persistence, saved chords, sync…) light up.
 *
 * Anything that needs the server MUST gate on `backendEnabled`, so the public
 * build stays backend-free (no multitenancy or cost centre exposed).
 */

/** Normalise the configured API base: trim, drop trailing slashes, empty → null. */
export function resolveApiBaseUrl(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, '');
}

/** The backend origin, or null on the public/static build. */
export const API_BASE_URL: string | null = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

/** True only when a backend origin is configured (the local build). */
export const backendEnabled: boolean = API_BASE_URL !== null;
