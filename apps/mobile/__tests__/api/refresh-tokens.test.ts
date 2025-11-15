import type { AuthResponse } from "../../lib/types";
import { refreshTokens } from "../../lib/api/refresh-tokens";

const originalFetch = globalThis.fetch;
const fetchMock = jest.fn();
let originalApiUrl: string | undefined;

jest.mock("../../lib/media", () => ({
    resolveApiBaseUrl: jest.fn(() => {
        return process.env.EXPO_PUBLIC_API_URL || "https://api.example.test";
    }),
}));

function buildAuthResponse(): AuthResponse {
    return {
        user: {
            id: "user-123",
            email: "user@example.com",
            username: "user123",
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-02T00:00:00.000Z",
        },
        accessToken: "access-token",
        refreshToken: "refresh-token",
    };
}

beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
    process.env.EXPO_PUBLIC_API_URL = "https://api.example.test";
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

describe("refreshTokens", () => {
    it("refreshes tokens and returns parsed auth payload", async () => {
        const response = buildAuthResponse();

        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => response,
        });

        const result = await refreshTokens("refresh-token");

        expect(result).toEqual(response);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        const [requestedUrl, options] = fetchMock.mock.calls[0] as [
            string,
            RequestInit
        ];
        expect(requestedUrl).toBe(
            "https://api.example.test/api/v1/auth/refresh"
        );
        expect(options?.method).toBe("POST");
        expect(options?.body).toBe(
            JSON.stringify({ refreshToken: "refresh-token" })
        );
    });

    it("surfaces error message from JSON response", async () => {
        fetchMock.mockResolvedValue({
            ok: false,
            status: 401,
            headers: {
                get: () => "application/json",
            },
            json: async () => ({
                message: "Refresh token expired",
            }),
        });

        await expect(refreshTokens("refresh-token")).rejects.toThrow(
            "Refresh token expired"
        );
    });

    it("surfaces error field when message is missing", async () => {
        fetchMock.mockResolvedValue({
            ok: false,
            status: 401,
            headers: {
                get: () => "application/json",
            },
            json: async () => ({
                error: "Unauthorized",
            }),
        });

        await expect(refreshTokens("refresh-token")).rejects.toThrow(
            "Unauthorized"
        );
    });

    it("surfaces error from plain text response", async () => {
        fetchMock.mockResolvedValue({
            ok: false,
            status: 500,
            headers: {
                get: () => "text/plain",
            },
            text: async () => "Internal server error",
        });

        await expect(refreshTokens("refresh-token")).rejects.toThrow(
            "Internal server error"
        );
    });

    it("surfaces error from plain text with whitespace", async () => {
        fetchMock.mockResolvedValue({
            ok: false,
            status: 500,
            headers: {
                get: () => "text/plain",
            },
            text: async () => "  Internal server error  ",
        });

        await expect(refreshTokens("refresh-token")).rejects.toThrow(
            "Internal server error"
        );
    });

    it("surfaces error from empty text response", async () => {
        fetchMock.mockResolvedValue({
            ok: false,
            status: 500,
            headers: {
                get: () => null,
            },
            text: async () => "",
        });

        await expect(refreshTokens("refresh-token")).rejects.toThrow(
            "Request failed with status 500"
        );
    });

    it("falls back to status code when error response parsing fails", async () => {
        fetchMock.mockResolvedValue({
            ok: false,
            status: 500,
            headers: {
                get: () => "application/json",
            },
            json: async () => {
                throw new Error("JSON parse error");
            },
            text: async () => {
                throw new Error("Text parse error");
            },
        });

        await expect(refreshTokens("refresh-token")).rejects.toThrow(
            "Request failed with status 500"
        );
    });

    it("throws error when response is not valid JSON", async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => {
                throw new Error("Invalid JSON");
            },
        });

        await expect(refreshTokens("refresh-token")).rejects.toThrow(
            "Response payload is not valid JSON"
        );
    });

    it("throws error when auth response is not an object", async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => "not an object",
        });

        await expect(refreshTokens("refresh-token")).rejects.toThrow(
            "Auth response is not an object"
        );
    });

    it("throws error when auth response is null", async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => null,
        });

        await expect(refreshTokens("refresh-token")).rejects.toThrow(
            "Auth response is not an object"
        );
    });

    it("throws error when user payload is missing", async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({
                accessToken: "token",
                refreshToken: "refresh",
            }),
        });

        await expect(refreshTokens("refresh-token")).rejects.toThrow(
            "User payload is missing"
        );
    });

    it("throws error when user payload is not an object", async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({
                user: "not an object",
                accessToken: "token",
                refreshToken: "refresh",
            }),
        });

        await expect(refreshTokens("refresh-token")).rejects.toThrow(
            "User payload is missing"
        );
    });

    it("throws error when accessToken is missing", async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({
                user: {
                    id: "user-123",
                    email: "user@example.com",
                    username: "user123",
                    createdAt: "2024-01-01T00:00:00.000Z",
                    updatedAt: "2024-01-02T00:00:00.000Z",
                },
                refreshToken: "refresh",
            }),
        });

        await expect(refreshTokens("refresh-token")).rejects.toThrow(
            "accessToken must be a non-empty string"
        );
    });

    it("throws error when refreshToken is missing", async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({
                user: {
                    id: "user-123",
                    email: "user@example.com",
                    username: "user123",
                    createdAt: "2024-01-01T00:00:00.000Z",
                    updatedAt: "2024-01-02T00:00:00.000Z",
                },
                accessToken: "token",
            }),
        });

        await expect(refreshTokens("refresh-token")).rejects.toThrow(
            "refreshToken must be a non-empty string"
        );
    });

    it("throws error when user field is missing", async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({
                user: {
                    email: "user@example.com",
                    username: "user123",
                    createdAt: "2024-01-01T00:00:00.000Z",
                    updatedAt: "2024-01-02T00:00:00.000Z",
                },
                accessToken: "token",
                refreshToken: "refresh",
            }),
        });

        await expect(refreshTokens("refresh-token")).rejects.toThrow(
            "user.id must be a non-empty string"
        );
    });

    it("throws error when parser throws non-Error", async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({
                user: null,
                accessToken: "token",
                refreshToken: "refresh",
            }),
        });

        await expect(refreshTokens("refresh-token")).rejects.toThrow(
            "Malformed auth response"
        );
    });
});
