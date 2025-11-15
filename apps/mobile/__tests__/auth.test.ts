import type { AuthResponse, RegisterRequest } from "../lib/types";

const originalFetch = globalThis.fetch;
const fetchMock = jest.fn();
let originalApiUrl: string | undefined;

jest.mock("@react-native-async-storage/async-storage", () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    multiGet: jest.fn(),
    multiSet: jest.fn(),
    clear: jest.fn(),
    getAllKeys: jest.fn(),
    multiRemove: jest.fn(),
}));

const mockGetState = jest.fn();

jest.mock("../lib/store/auth", () => {
    const actual = jest.requireActual("../lib/store/auth");
    return {
        ...actual,
        useAuthStore: {
            ...actual.useAuthStore,
            getState: mockGetState,
        },
    };
});

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
    const authModule =
        jest.requireActual<typeof import("../lib/auth")>("../lib/auth");
    return authModule;
}

beforeEach(() => {
    fetchMock.mockReset();
    mockGetState.mockReset();
    mockGetState.mockReturnValue({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
    });
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

    it("logs in a user and surfaces HTTP errors with message field", async () => {
        const { loginUser } = await loadModule();

        fetchMock.mockResolvedValue({
            ok: false,
            status: 401,
            headers: {
                get: (name: string) => {
                    if (name === "content-type") {
                        return "application/json";
                    }
                    return null;
                },
            },
            json: async () => ({
                statusCode: 401,
                error: "Unauthorized",
                message: "Invalid credentials",
            }),
        });

        await expect(
            loginUser({ email: "nope@example.com", password: "wrong" })
        ).rejects.toThrow("Invalid credentials");
    });

    it("surfaces HTTP errors with error field when message is missing", async () => {
        const { loginUser } = await loadModule();

        fetchMock.mockResolvedValue({
            ok: false,
            status: 401,
            headers: {
                get: (name: string) => {
                    if (name === "content-type") {
                        return "application/json";
                    }
                    return null;
                },
            },
            json: async () => ({
                statusCode: 401,
                error: "Unauthorized",
            }),
        });

        await expect(
            loginUser({ email: "nope@example.com", password: "wrong" })
        ).rejects.toThrow("Unauthorized");
    });

    it("surfaces HTTP errors from plain text responses", async () => {
        const { loginUser } = await loadModule();

        fetchMock.mockResolvedValue({
            ok: false,
            status: 401,
            headers: {
                get: (name: string) => {
                    if (name === "content-type") {
                        return "text/plain";
                    }
                    return null;
                },
            },
            text: async () => "Invalid credentials",
        });

        await expect(
            loginUser({ email: "nope@example.com", password: "wrong" })
        ).rejects.toThrow("Invalid credentials");
    });

    it("surfaces HTTP errors from plain text with whitespace", async () => {
        const { loginUser } = await loadModule();

        fetchMock.mockResolvedValue({
            ok: false,
            status: 401,
            headers: {
                get: (name: string) => {
                    if (name === "content-type") {
                        return "text/plain";
                    }
                    return null;
                },
            },
            text: async () => "  Invalid credentials  ",
        });

        await expect(
            loginUser({ email: "nope@example.com", password: "wrong" })
        ).rejects.toThrow("Invalid credentials");
    });

    it("surfaces HTTP errors from empty text response", async () => {
        const { loginUser } = await loadModule();

        fetchMock.mockResolvedValue({
            ok: false,
            status: 401,
            headers: {
                get: (name: string) => {
                    if (name === "content-type") {
                        return "text/plain";
                    }
                    return null;
                },
            },
            text: async () => "   ",
        });

        await expect(
            loginUser({ email: "nope@example.com", password: "wrong" })
        ).rejects.toThrow("Request failed with status 401");
    });

    it("surfaces HTTP errors when JSON error response has no message or error field", async () => {
        const { loginUser } = await loadModule();

        fetchMock.mockResolvedValue({
            ok: false,
            status: 500,
            headers: {
                get: (name: string) => {
                    if (name === "content-type") {
                        return "application/json";
                    }
                    return null;
                },
            },
            json: async () => ({
                statusCode: 500,
            }),
        });

        await expect(
            loginUser({ email: "test@example.com", password: "password" })
        ).rejects.toThrow("Request failed with status 500");
    });

    it("falls back to status message when response body cannot be read", async () => {
        const { registerUser } = await loadModule();

        fetchMock.mockResolvedValue({
            ok: false,
            status: 503,
            headers: {
                get: (name: string) => {
                    if (name === "content-type") {
                        return "application/json";
                    }
                    return null;
                },
            },
            json: async () => {
                throw new Error("stream error");
            },
            text: async () => {
                throw new Error("stream error");
            },
        });

        await expect(
            registerUser({
                email: "user@example.com",
                password: "Password123!",
                username: "user123",
            })
        ).rejects.toThrow("Request failed with status 503");
    });

    it("rejects when auth response payload is not JSON", async () => {
        const { loginUser } = await loadModule();

        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => {
                throw new Error("bad json");
            },
        });

        await expect(
            loginUser({ email: "user@example.com", password: "Password123!" })
        ).rejects.toThrow("Response payload is not valid JSON.");
    });

    it("rejects when auth response is not an object", async () => {
        const { refreshTokens } = await loadModule();

        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => "not-an-object",
        });

        await expect(refreshTokens("refresh-token")).rejects.toThrow(
            "Auth response is not an object"
        );
    });

    it("falls back to unknown parser error for non-error parser failures", async () => {
        const { __testUtils } = await loadModule();

        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ should: "parse" }),
        });

        await expect(
            __testUtils.postJsonForTests("/api/v1/auth/register", {}, () => {
                throw undefined;
            })
        ).rejects.toThrow("Malformed auth response: Unknown parser error");
    });

    it.each([
        [{}, /User payload is missing/],
        [{ user: {}, accessToken: "token" }, /Malformed auth response/],
        [
            {
                user: {
                    id: "",
                    email: "user@example.com",
                    username: "user",
                    createdAt: "2024-01-01",
                    updatedAt: "2024-01-01",
                },
                accessToken: "token",
                refreshToken: "refresh",
            },
            /Malformed auth response: user.id must be a non-empty string/,
        ],
    ])(
        "rejects when auth response has invalid fields (%p)",
        async (responsePayload, errorMatch) => {
            const { refreshTokens } = await loadModule();

            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => responsePayload,
            });

            await expect(refreshTokens("refresh-token")).rejects.toThrow(
                errorMatch
            );
        }
    );

    it("throws when logout response omits success flag", async () => {
        const { logoutUser } = await loadModule();

        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({}),
        });

        await expect(logoutUser("refresh-token")).rejects.toThrow(
            /Logout response missing success flag/
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

    describe("resetPasswordForLoggedInUser", () => {
        const mockUser = {
            id: "user-123",
            email: "user@example.com",
            username: "user123",
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-02T00:00:00.000Z",
        };

        beforeEach(() => {
            mockGetState.mockReturnValue({
                user: mockUser,
                accessToken: "access-token",
                refreshToken: "refresh-token",
                isAuthenticated: true,
            });
        });

        afterEach(() => {
            mockGetState.mockClear();
        });

        it("resets password for logged-in user using forgot-password and reset-password endpoints", async () => {
            const { resetPasswordForLoggedInUser } = await loadModule();

            fetchMock
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        message: "Reset token generated",
                        resetToken: "reset-token-123",
                    }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        success: true,
                        message: "Password has been reset successfully",
                    }),
                });

            const result = await resetPasswordForLoggedInUser("newPassword123");

            expect(result).toEqual({
                success: true,
                message: "Password has been reset successfully",
            });

            expect(fetchMock).toHaveBeenCalledTimes(2);

            const firstCall = fetchMock.mock.calls[0];
            expect(firstCall[0]).toBe(
                "https://api.example.test/api/v1/auth/forgot-password"
            );
            const firstBody = firstCall[1] as RequestInit;
            expect(firstBody?.body).toBeDefined();
            expect(JSON.parse(firstBody.body as string)).toEqual({
                email: "user@example.com",
            });

            const secondCall = fetchMock.mock.calls[1];
            expect(secondCall[0]).toBe(
                "https://api.example.test/api/v1/auth/reset-password"
            );
            const secondBody = secondCall[1] as RequestInit;
            expect(secondBody?.body).toBeDefined();
            expect(JSON.parse(secondBody.body as string)).toEqual({
                resetToken: "reset-token-123",
                newPassword: "newPassword123",
            });
        });

        it("throws error when user is not logged in", async () => {
            mockGetState.mockReturnValue({
                user: null,
                accessToken: null,
                refreshToken: null,
                isAuthenticated: false,
            });

            const { resetPasswordForLoggedInUser } = await loadModule();

            await expect(
                resetPasswordForLoggedInUser("newPassword123")
            ).rejects.toThrow("User must be logged in to reset password");

            expect(fetchMock).not.toHaveBeenCalled();
        });

        it("throws error when forgot-password does not return resetToken", async () => {
            const { resetPasswordForLoggedInUser } = await loadModule();

            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    message: "Reset token generated",
                }),
            });

            await expect(
                resetPasswordForLoggedInUser("newPassword123")
            ).rejects.toThrow(
                "Failed to generate reset token. Please try again."
            );

            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it("surfaces errors from forgot-password endpoint", async () => {
            const { resetPasswordForLoggedInUser } = await loadModule();

            fetchMock.mockResolvedValueOnce({
                ok: false,
                status: 500,
                headers: {
                    get: (name: string) => {
                        if (name === "content-type") {
                            return "application/json";
                        }
                        return null;
                    },
                },
                json: async () => ({
                    statusCode: 500,
                    error: "Internal Server Error",
                    message: "Database error",
                }),
            });

            await expect(
                resetPasswordForLoggedInUser("newPassword123")
            ).rejects.toThrow("Database error");
        });

        it("surfaces errors from reset-password endpoint", async () => {
            const { resetPasswordForLoggedInUser } = await loadModule();

            fetchMock
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        message: "Reset token generated",
                        resetToken: "reset-token-123",
                    }),
                })
                .mockResolvedValueOnce({
                    ok: false,
                    status: 400,
                    headers: {
                        get: (name: string) => {
                            if (name === "content-type") {
                                return "application/json";
                            }
                            return null;
                        },
                    },
                    json: async () => ({
                        statusCode: 400,
                        error: "Bad Request",
                        message: "Reset token has expired",
                    }),
                });

            await expect(
                resetPasswordForLoggedInUser("newPassword123")
            ).rejects.toThrow("Reset token has expired");
        });

        it("rejects when forgot-password response is not valid JSON", async () => {
            const { resetPasswordForLoggedInUser } = await loadModule();

            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: async () => {
                    throw new Error("bad json");
                },
            });

            await expect(
                resetPasswordForLoggedInUser("newPassword123")
            ).rejects.toThrow("Response payload is not valid JSON.");
        });

        it("rejects when reset-password response is not valid JSON", async () => {
            const { resetPasswordForLoggedInUser } = await loadModule();

            fetchMock
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        message: "Reset token generated",
                        resetToken: "reset-token-123",
                    }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => {
                        throw new Error("bad json");
                    },
                });

            await expect(
                resetPasswordForLoggedInUser("newPassword123")
            ).rejects.toThrow("Response payload is not valid JSON.");
        });
    });
});
