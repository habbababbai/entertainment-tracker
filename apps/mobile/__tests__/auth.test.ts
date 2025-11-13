import type { AuthResponse, LoginRequest, RegisterRequest } from "../lib/types";

const originalFetch = globalThis.fetch;
const fetchMock = jest.fn();
let originalApiUrl: string | undefined;

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

async function loadModule() {
    jest.resetModules();
    return jest.requireActual<typeof import("../lib/auth")>("../lib/auth");
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

describe("auth helpers", () => {
    it("registers a user and returns parsed auth payload", async () => {
        const { registerUser } = await loadModule();
        const response = buildAuthResponse();

        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => response,
        });

        const body: RegisterRequest = {
            email: "new@example.com",
            password: "Password123!",
            username: "newuser",
        };

        const result = await registerUser(body);

        expect(result).toEqual(response);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        const [requestedUrl, options] = fetchMock.mock.calls[0] as [
            string,
            RequestInit
        ];
        expect(requestedUrl).toBe(
            "https://api.example.test/api/v1/auth/register"
        );
        expect(options?.method).toBe("POST");
        expect(options?.headers).toMatchObject({
            "Content-Type": "application/json",
        });
        expect(options?.body).toBe(JSON.stringify(body));
    });

    it("logs in a user and surfaces HTTP errors", async () => {
        const { loginUser } = await loadModule();

        fetchMock.mockResolvedValue({
            ok: false,
            status: 401,
            text: async () => "Invalid credentials",
        });

        await expect(
            loginUser({ email: "nope@example.com", password: "wrong" })
        ).rejects.toThrow("Invalid credentials");
    });

    it("rejects when auth response is missing fields", async () => {
        const { refreshTokens } = await loadModule();

        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({
                user: {},
                accessToken: "token",
            }),
        });

        await expect(refreshTokens("refresh-token")).rejects.toThrow(
            /Malformed auth response/
        );
    });

    it("logs out the user when backend confirms success", async () => {
        const { logoutUser } = await loadModule();

        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ success: true }),
        });

        await expect(logoutUser("refresh-token")).resolves.toBeUndefined();
        expect(fetchMock).toHaveBeenCalledWith(
            "https://api.example.test/api/v1/auth/logout",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({ refreshToken: "refresh-token" }),
            })
        );
    });

    it("rejects logout when backend returns failure", async () => {
        const { logoutUser } = await loadModule();

        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ success: false }),
        });

        await expect(logoutUser("refresh-token")).rejects.toThrow(
            /Logout failed/
        );
    });
});

