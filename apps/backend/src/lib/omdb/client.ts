import type { FastifyInstance } from "fastify";

import { env } from "../../env.js";

const OMDB_BASE_URL = "https://www.omdbapi.com/";

/**
 * Makes an HTTP request to the OMDb API.
 * Automatically includes the API key from environment variables.
 * Logs errors to the Fastify logger if the request fails.
 *
 * @param app - The Fastify instance (used for logging)
 * @param params - Query parameters to send to the OMDb API (e.g., `{ i: "tt1234567" }` or `{ s: "Inception" }`)
 * @returns A promise that resolves to the parsed JSON response
 * @throws {Error} If the HTTP request fails or returns a non-OK status
 *
 * @example
 * ```ts
 * const detail = await requestOmdb<OmdbDetailResponse>(app, {
 *   i: "tt1375666",
 *   plot: "short"
 * });
 * ```
 */
export async function requestOmdb<T>(
    app: FastifyInstance,
    params: Record<string, string>
): Promise<T> {
    const url = new URL(OMDB_BASE_URL);
    url.searchParams.set("apikey", env.OMDB_API_KEY);

    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
        const message = await response.text();
        app.log.error(
            { status: response.status, message },
            "OMDb request failed"
        );
        throw new Error(`OMDb request failed with status ${response.status}`);
    }

    return (await response.json()) as T;
}
