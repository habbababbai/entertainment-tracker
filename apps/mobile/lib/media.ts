import {
    mediaItemSchema,
    mediaListSchema,
    type MediaItem,
    type MediaList,
} from "@entertainment-tracker/contracts";
import Constants from "expo-constants";
import { NativeModules } from "react-native";

export type { MediaItem, MediaList } from "@entertainment-tracker/contracts";

interface ExpoConstantsLike {
    expoGoConfig?: { hostUri?: string | null } | null;
    expoConfig?: { hostUri?: string | null } | null;
    manifest?: { hostUri?: string | null } | null;
    manifest2?: {
        extra?: {
            expoGo?: {
                developer?: {
                    host?: string | null;
                } | null;
            } | null;
        } | null;
    } | null;
}

interface NativeModulesLike {
    SourceCode?: { scriptURL?: string } | null;
}

const API_BASE_URL = resolveApiBaseUrl();

export interface FetchMediaOptions {
    query: string;
    limit?: number;
    page?: number;
}

/**
 * Fetches a paginated list of media items from the API based on a search query.
 *
 * @param options - The search options
 * @param options.query - The search query string (will be trimmed)
 * @param options.limit - Maximum number of items per page (default: 15)
 * @param options.page - Page number to fetch (default: 1)
 * @returns A promise that resolves to a MediaList containing items and pagination info
 * @throws {Error} If the query is empty or the API request fails
 *
 * @example
 * ```ts
 * const results = await fetchMedia({
 *   query: "Spirited Away",
 *   limit: 20,
 *   page: 1
 * });
 * console.log(results.items); // Array of media items
 * console.log(results.hasMore); // Whether more pages exist
 * ```
 */
export async function fetchMedia({
    query,
    limit = 15,
    page = 1,
}: FetchMediaOptions): Promise<MediaList> {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
        throw new Error("Search query cannot be empty.");
    }

    const url = new URL("/api/v1/media", API_BASE_URL);
    url.searchParams.set("query", trimmedQuery);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("page", String(page));

    const response = await fetch(url.toString());

    if (!response.ok) {
        const message = await response.text();
        throw new Error(
            message || `Failed to fetch media (status ${response.status})`
        );
    }

    return mediaListSchema.parse(await response.json());
}

/**
 * Fetches a single media item by its external ID (e.g., IMDb ID).
 *
 * @param id - The external ID of the media item (e.g., "tt0133093" for The Matrix)
 * @returns A promise that resolves to the MediaItem
 * @throws {Error} If the ID is empty, the item is not found (404), or the API request fails
 *
 * @example
 * ```ts
 * const movie = await fetchMediaItem("tt0133093");
 * console.log(movie.title); // "The Matrix"
 * console.log(movie.mediaType); // "MOVIE"
 * ```
 */
export async function fetchMediaItem(id: string): Promise<MediaItem> {
    const trimmedId = id.trim();

    if (!trimmedId) {
        throw new Error("Media id cannot be empty.");
    }

    const url = new URL(
        `/api/v1/media/${encodeURIComponent(trimmedId)}`,
        API_BASE_URL
    );
    const response = await fetch(url.toString());

    if (response.status === 404) {
        throw new Error("Media item not found.");
    }

    if (!response.ok) {
        const message = await response.text();
        throw new Error(
            message || `Failed to fetch media item (status ${response.status})`
        );
    }

    return mediaItemSchema.parse(await response.json());
}

/**
 * Extracts the host segment from a URL or host:port string.
 * Removes the port number and any trailing path segments.
 *
 * @param value - The URL or host:port string to extract from (e.g., "localhost:8081" or "192.168.1.1:3000")
 * @returns The host segment without port, or `null` if the value is empty or invalid
 *
 * @example
 * ```ts
 * extractHostSegment("localhost:8081"); // "localhost"
 * extractHostSegment("192.168.1.1:3000"); // "192.168.1.1"
 * extractHostSegment(null); // null
 * ```
 */
export function extractHostSegment(value?: string | null): string | null {
    if (!value) {
        return null;
    }

    const host = value.split(":")[0]?.trim();
    return host ? host : null;
}

/**
 * Resolves the API base URL using multiple fallback strategies.
 * This function attempts to determine the correct API endpoint based on:
 * 1. Explicit `EXPO_PUBLIC_API_URL` environment variable
 * 2. Expo Go configuration (hostUri from various manifest sources)
 * 3. Native module script URL (for development servers)
 * 4. Default localhost fallback
 *
 * @param constants - Expo constants object (defaults to `Constants`)
 * @param nativeModules - React Native native modules (defaults to `NativeModules`)
 * @param env - Environment variables object (defaults to `process.env`)
 * @returns The resolved API base URL (e.g., "http://localhost:3000" or "http://192.168.1.1:3000")
 *
 * @example
 * ```ts
 * // Uses default parameters
 * const apiUrl = resolveApiBaseUrl();
 *
 * // Or with custom parameters for testing
 * const apiUrl = resolveApiBaseUrl(mockConstants, mockNativeModules, { EXPO_PUBLIC_API_URL: "https://api.example.com" });
 * ```
 */
export function resolveApiBaseUrl(
    constants: ExpoConstantsLike = Constants,
    nativeModules: NativeModulesLike = NativeModules,
    env: Partial<NodeJS.ProcessEnv> = process.env
): string {
    const explicit = env.EXPO_PUBLIC_API_URL?.trim();
    if (explicit) {
        return explicit;
    }

    const hostUri =
        constants.expoGoConfig?.hostUri ??
        constants.expoConfig?.hostUri ??
        constants.manifest?.hostUri ??
        constants.manifest2?.extra?.expoGo?.developer?.host ??
        null;

    const hostFromExpo = extractHostSegment(hostUri);
    if (hostFromExpo) {
        return `http://${hostFromExpo}:3000`;
    }

    const scriptURL: string | undefined = nativeModules?.SourceCode?.scriptURL;
    if (scriptURL) {
        const hostPort = scriptURL.split("://")[1]?.split("/")[0] ?? "";
        const host = extractHostSegment(hostPort);
        if (host) {
            return `http://${host}:3000`;
        }
    }

    return "http://127.0.0.1:3000";
}
