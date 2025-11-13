import {
    mediaListSchema,
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

export function extractHostSegment(value?: string | null): string | null {
    if (!value) {
        return null;
    }

    const host = value.split(":")[0]?.trim();
    return host ? host : null;
}

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
