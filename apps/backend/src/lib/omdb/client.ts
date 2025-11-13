import type { FastifyInstance } from "fastify";

import { env } from "../../env.js";

const OMDB_BASE_URL = "https://www.omdbapi.com/";

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
