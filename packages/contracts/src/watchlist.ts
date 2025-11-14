import { z } from "zod";
import { mediaItemSchema } from "./media.js";

export const watchStatusSchema = z.enum([
    "PLANNED",
    "WATCHING",
    "COMPLETED",
    "ON_HOLD",
    "DROPPED",
]);

export type WatchStatus = z.infer<typeof watchStatusSchema>;

export const watchEntrySchema = z.object({
    id: z.string().min(1),
    userId: z.string().min(1),
    mediaItemId: z.string().min(1),
    status: watchStatusSchema,
    rating: z.number().int().min(1).max(10).nullable(),
    notes: z.string().nullable(),
    lastWatchedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    mediaItem: mediaItemSchema,
});

export type WatchEntry = z.infer<typeof watchEntrySchema>;

export const watchlistResponseSchema = z.object({
    items: z.array(watchEntrySchema),
});

export type WatchlistResponse = z.infer<typeof watchlistResponseSchema>;

export const addWatchlistRequestSchema = z.object({
    mediaItemId: z.string().min(1),
});

export type AddWatchlistRequest = z.infer<typeof addWatchlistRequestSchema>;

export const updateWatchlistRequestSchema = z.object({
    status: watchStatusSchema.optional(),
    rating: z.number().int().min(1).max(10).nullable().optional(),
    notes: z.string().nullable().optional(),
    lastWatchedAt: z.string().datetime().nullable().optional(),
});

export type UpdateWatchlistRequest = z.infer<
    typeof updateWatchlistRequestSchema
>;

