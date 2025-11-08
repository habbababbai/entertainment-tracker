import {
    mediaListSchema,
    type MediaItem,
} from "@entertainment-tracker/contracts";

export type { MediaItem } from "@entertainment-tracker/contracts";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export async function fetchMedia(limit = 20): Promise<MediaItem[]> {
    const url = new URL("/api/v1/media", API_BASE_URL);
    url.searchParams.set("limit", String(limit));

    const response = await fetch(url.toString());

    if (!response.ok) {
        const message = await response.text();
        throw new Error(
            message || `Failed to fetch media (status ${response.status})`
        );
    }

    const data = mediaListSchema.parse(await response.json());
    return data.items;
}
