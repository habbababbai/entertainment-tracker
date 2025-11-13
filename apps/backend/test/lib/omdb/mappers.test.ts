import { describe, expect, it } from "vitest";

import {
    mapOmdbDetail,
    mapSearchFallback,
    requestOmdb,
} from "../../../src/lib/omdb/index.js";

describe("omdb helpers", () => {
    it("returns null when OMDb detail response signals failure", () => {
        const result = mapOmdbDetail({
            Response: "False",
            Error: "Something went wrong",
            Title: "Unavailable",
            imdbID: "ttUnavailable",
        });

        expect(result).toBeNull();
    });

    it("exposes helper exports through the omdb index", () => {
        expect(typeof mapOmdbDetail).toBe("function");
        expect(typeof mapSearchFallback).toBe("function");
        expect(typeof requestOmdb).toBe("function");
    });
});


