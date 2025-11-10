import {
    mediaListSchema,
    type MediaItem,
} from "@entertainment-tracker/contracts";
import Constants from "expo-constants";
import { NativeModules } from "react-native";

export type { MediaItem } from "@entertainment-tracker/contracts";

const API_BASE_URL = resolveApiBaseUrl();

export interface FetchMediaOptions {
    query: string;
    limit?: number;
}

export async function fetchMedia({
    query,
    limit = 20,
}: FetchMediaOptions): Promise<MediaItem[]> {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
        throw new Error("Search query cannot be empty.");
    }

    const url = new URL("/api/v1/media", API_BASE_URL);
    url.searchParams.set("query", trimmedQuery);
    url.searchParams.set("limit", String(limit));

    const response = await fetch(url.toString());

    if (!response.ok) {
        const message = await response.text();
        throw new Error(
            message || `Failed to fetch media (status ${response.status})`
        );
    }

    const data = mediaListSchema.parse(await response.json());
    const unique = new Map<string, MediaItem>();
    for (const item of data.items) {
        if (!unique.has(item.id)) {
            unique.set(item.id, item);
        }
    }
    return Array.from(unique.values());
}

function resolveApiBaseUrl(): string {
    const explicit = process.env.EXPO_PUBLIC_API_URL?.trim();
    if (explicit) {
        return explicit;
    }

    const hostUri =
        Constants.expoGoConfig?.hostUri ??
        Constants.expoConfig?.hostUri ??
        Constants.manifest?.hostUri ??
        Constants.manifest2?.extra?.expoGo?.developer?.host ??
        null;

    if (hostUri) {
        const host = hostUri.split(":")[0];
        if (host) {
            return `http://${host}:3000`;
        }
    }

    const scriptURL: string | undefined = NativeModules?.SourceCode?.scriptURL;
    if (scriptURL) {
        const hostPort = scriptURL.split("://")[1]?.split("/")[0] ?? "";
        const host = hostPort.split(":")[0];
        if (host) {
            return `http://${host}:3000`;
        }
    }

    return "http://127.0.0.1:3000";
}
