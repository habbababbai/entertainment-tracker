import type { MediaList } from "../lib/media";

jest.mock("expo-constants", () => ({
    expoGoConfig: undefined,
    expoConfig: undefined,
    manifest: undefined,
    manifest2: { extra: { expoGo: { developer: { host: undefined } } } },
    default: {},
}));

jest.mock(
    "react-native",
    () => ({
        NativeModules: {
            SourceCode: {
                scriptURL: "http://127.0.0.1:8081/index.bundle?platform=ios",
            },
        },
    }),
    { virtual: true }
);

const originalFetch = globalThis.fetch;
const fetchMock = jest.fn();
let originalApiUrl: string | undefined;

function createSampleList(): MediaList {
    return {
        items: [
            {
                id: "media-1",
                externalId: "tt1234567",
                source: "OMDB",
                title: "Sample Title",
                description: "Sample description",
                posterUrl: null,
                backdropUrl: null,
                mediaType: "MOVIE",
                totalSeasons: null,
                totalEpisodes: null,
                releaseDate: "2023-01-01T00:00:00.000Z",
                createdAt: "2023-01-01T00:00:00.000Z",
                updatedAt: "2023-01-02T00:00:00.000Z",
            },
        ],
        hasMore: false,
        nextPage: null,
    };
}

async function loadModule() {
    jest.resetModules();
    return jest.requireActual<typeof import("../lib/media")>("../lib/media");
}

beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
    delete process.env.EXPO_PUBLIC_API_URL;
});

afterEach(() => {
    if (originalApiUrl === undefined) {
        delete process.env.EXPO_PUBLIC_API_URL;
    } else {
        process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
    }
});

afterAll(() => {
    if (originalFetch) {
        globalThis.fetch = originalFetch;
    } else {
        delete (globalThis as { fetch?: typeof fetch }).fetch;
    }
});

describe("fetchMedia", () => {
    it("trims the query and requests default pagination", async () => {
        process.env.EXPO_PUBLIC_API_URL = "https://api.example.test";
        const { fetchMedia } = await loadModule();
        const responsePayload = createSampleList();

        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => responsePayload,
        });

        const result = await fetchMedia({ query: "  Spirited Away  " });

        expect(fetchMock).toHaveBeenCalledTimes(1);

        const [requestedUrl] = fetchMock.mock.calls[0] as [string];
        const parsed = new URL(requestedUrl);

        expect(parsed.origin + parsed.pathname).toBe(
            "https://api.example.test/api/v1/media"
        );
        expect(parsed.searchParams.get("query")).toBe("Spirited Away");
        expect(parsed.searchParams.get("limit")).toBe("15");
        expect(parsed.searchParams.get("page")).toBe("1");
        expect(result).toEqual(responsePayload);
    });

    it("throws when the response is not ok", async () => {
        process.env.EXPO_PUBLIC_API_URL = "https://api.example.test";
        const { fetchMedia } = await loadModule();

        fetchMock.mockResolvedValue({
            ok: false,
            status: 500,
            text: async () => "Internal failure",
        });

        await expect(
            fetchMedia({ query: "Fullmetal Alchemist" })
        ).rejects.toThrow("Internal failure");
    });

    it("rejects when the query is empty after trimming", async () => {
        const { fetchMedia } = await loadModule();

        await expect(fetchMedia({ query: "   " })).rejects.toThrow(
            "Search query cannot be empty."
        );
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
