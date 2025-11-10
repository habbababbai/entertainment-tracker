import { z } from "zod";

export const mediaTypeSchema = z.enum(["MOVIE", "TV", "ANIME"]);

export const mediaItemSchema = z.object({
    id: z.string().min(1),
    externalId: z.string().min(1),
    source: z.string().min(1),
    title: z.string().min(1),
    description: z.string().nullable().optional(),
    posterUrl: z.string().url().nullable().optional(),
    backdropUrl: z.string().url().nullable().optional(),
    mediaType: mediaTypeSchema,
    totalSeasons: z.number().int().nonnegative().nullable().optional(),
    totalEpisodes: z.number().int().nonnegative().nullable().optional(),
    releaseDate: z.string().datetime().nullable().optional(),
    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional(),
});

export type MediaItem = z.infer<typeof mediaItemSchema>;

export const mediaListSchema = z.object({
    items: z.array(mediaItemSchema),
});

export type MediaList = z.infer<typeof mediaListSchema>;
