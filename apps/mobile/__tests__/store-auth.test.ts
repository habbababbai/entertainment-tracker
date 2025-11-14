/* eslint-disable @typescript-eslint/no-require-imports */
import { act, renderHook } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { useAuthStore } from "../lib/store/auth";
import type { AuthUser, AuthTokens, AuthResponse } from "../lib/types";

const isNativePlatform = Platform.OS === "ios" || Platform.OS === "android";

jest.mock("expo-secure-store", () => ({
    getItemAsync: jest.fn(),
    setItemAsync: jest.fn(),
    deleteItemAsync: jest.fn(),
}));

jest.mock("../lib/utils/env", () => ({
    isTestEnv: jest.fn(() => true),
}));

const mockGetItem = SecureStore.getItemAsync as jest.MockedFunction<
    typeof SecureStore.getItemAsync
>;
const mockSetItem = SecureStore.setItemAsync as jest.MockedFunction<
    typeof SecureStore.setItemAsync
>;

const mockUser: AuthUser = {
    id: "user-123",
    email: "test@example.com",
    username: "testuser",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
};

const mockTokens: AuthTokens = {
    accessToken: "access-token-123",
    refreshToken: "refresh-token-456",
};

describe("useAuthStore", () => {
    beforeEach(async () => {
        if (!isNativePlatform) {
            return;
        }
        jest.clearAllMocks();
        mockGetItem.mockResolvedValue(null);
        mockSetItem.mockResolvedValue(undefined);
        await act(async () => {
            await useAuthStore.getState().clearAuth();
        });
    });

    (isNativePlatform ? it : it.skip)(
        "initializes with null auth state",
        () => {
            const { result } = renderHook(() => useAuthStore());

            expect(result.current.user).toBeNull();
            expect(result.current.accessToken).toBeNull();
            expect(result.current.refreshToken).toBeNull();
            expect(result.current.isAuthenticated).toBe(false);
        }
    );

    (isNativePlatform ? it : it.skip)(
        "sets auth state with user and tokens",
        async () => {
            const { result } = renderHook(() => useAuthStore());

            await act(async () => {
                await result.current.setAuth(mockUser, mockTokens);
            });

            expect(result.current.user).toEqual(mockUser);
            expect(result.current.accessToken).toBe(mockTokens.accessToken);
            expect(result.current.refreshToken).toBe(mockTokens.refreshToken);
            expect(result.current.isAuthenticated).toBe(true);
        }
    );

    (isNativePlatform ? it : it.skip)(
        "sets auth state from AuthResponse (backend response)",
        async () => {
            const { result } = renderHook(() => useAuthStore());

            const authResponse: AuthResponse = {
                user: mockUser,
                ...mockTokens,
            };

            await act(async () => {
                await result.current.setAuthFromResponse(authResponse);
            });

            expect(result.current.user).toEqual(mockUser);
            expect(result.current.accessToken).toBe(mockTokens.accessToken);
            expect(result.current.refreshToken).toBe(mockTokens.refreshToken);
            expect(result.current.isAuthenticated).toBe(true);
        }
    );

    (isNativePlatform ? it : it.skip)("clears auth state", async () => {
        const { result } = renderHook(() => useAuthStore());

        await act(async () => {
            await result.current.setAuth(mockUser, mockTokens);
        });

        expect(result.current.isAuthenticated).toBe(true);

        await act(async () => {
            await result.current.clearAuth();
        });

        expect(result.current.user).toBeNull();
        expect(result.current.accessToken).toBeNull();
        expect(result.current.refreshToken).toBeNull();
        expect(result.current.isAuthenticated).toBe(false);
    });

    (isNativePlatform ? it : it.skip)(
        "updates user when user exists",
        async () => {
            const { result } = renderHook(() => useAuthStore());

            await act(async () => {
                await result.current.setAuth(mockUser, mockTokens);
            });

            act(() => {
                result.current.updateUser({ username: "newusername" });
            });

            expect(result.current.user?.username).toBe("newusername");
            expect(result.current.user?.email).toBe(mockUser.email);
            expect(result.current.user?.id).toBe(mockUser.id);
        }
    );

    (isNativePlatform ? it : it.skip)(
        "does not update user when user is null",
        () => {
            const { result } = renderHook(() => useAuthStore());

            act(() => {
                result.current.updateUser({ username: "newusername" });
            });

            expect(result.current.user).toBeNull();
        }
    );

    (isNativePlatform ? it : it.skip)(
        "persists auth state to SecureStore",
        async () => {
            const { result } = renderHook(() => useAuthStore());

            await act(async () => {
                await result.current.setAuth(mockUser, mockTokens);
            });

            expect(mockSetItem).toHaveBeenCalledWith(
                "auth-access-token",
                mockTokens.accessToken
            );
            expect(mockSetItem).toHaveBeenCalledWith(
                "auth-refresh-token",
                mockTokens.refreshToken
            );
        }
    );

    (isNativePlatform ? it : it.skip)(
        "handles SecureStore errors gracefully",
        async () => {
            mockGetItem.mockRejectedValueOnce(
                new Error("SecureStore unavailable")
            );
            mockSetItem.mockRejectedValueOnce(
                new Error("SecureStore unavailable")
            );

            const { result } = renderHook(() => useAuthStore());

            await act(async () => {
                await result.current.setAuth(mockUser, mockTokens);
            });

            expect(result.current.user).toEqual(mockUser);
            expect(result.current.isAuthenticated).toBe(true);
        }
    );

    (isNativePlatform ? it : it.skip)(
        "clears SecureStore when clearing auth",
        async () => {
            const mockDeleteItem =
                SecureStore.deleteItemAsync as jest.MockedFunction<
                    typeof SecureStore.deleteItemAsync
                >;

            const { result } = renderHook(() => useAuthStore());

            await act(async () => {
                await result.current.setAuth(mockUser, mockTokens);
            });

            await act(async () => {
                await result.current.clearAuth();
            });

            expect(mockDeleteItem).toHaveBeenCalledWith("auth-access-token");
            expect(mockDeleteItem).toHaveBeenCalledWith("auth-refresh-token");
            expect(result.current.isAuthenticated).toBe(false);
            expect(result.current.user).toBeNull();
        }
    );

    (isNativePlatform ? it : it.skip)(
        "handles getItem errors gracefully",
        async () => {
            mockGetItem.mockRejectedValueOnce(
                new Error("SecureStore getItem failed")
            );

            const { result } = renderHook(() => useAuthStore());

            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 100));
            });

            expect(result.current.isAuthenticated).toBe(false);
            expect(result.current.user).toBeNull();
        }
    );

    (isNativePlatform ? it : it.skip)(
        "handles removeItem errors gracefully",
        async () => {
            const mockDeleteItem =
                SecureStore.deleteItemAsync as jest.MockedFunction<
                    typeof SecureStore.deleteItemAsync
                >;

            mockDeleteItem.mockRejectedValueOnce(
                new Error("SecureStore deleteItem failed")
            );

            const { result } = renderHook(() => useAuthStore());

            await act(async () => {
                await result.current.setAuth(mockUser, mockTokens);
            });

            await act(async () => {
                await result.current.clearAuth();
            });

            expect(result.current.isAuthenticated).toBe(false);
        }
    );

    (isNativePlatform ? it : it.skip)(
        "updates multiple user fields at once",
        async () => {
            const { result } = renderHook(() => useAuthStore());

            await act(async () => {
                await result.current.setAuth(mockUser, mockTokens);
            });

            act(() => {
                result.current.updateUser({
                    username: "newusername",
                    email: "newemail@example.com",
                });
            });

            expect(result.current.user?.username).toBe("newusername");
            expect(result.current.user?.email).toBe("newemail@example.com");
            expect(result.current.user?.id).toBe(mockUser.id);
            expect(result.current.user?.createdAt).toBe(mockUser.createdAt);
        }
    );

    (isNativePlatform ? it : it.skip)("updates all user fields", async () => {
        const { result } = renderHook(() => useAuthStore());

        await act(async () => {
            await result.current.setAuth(mockUser, mockTokens);
        });

        const updatedUser: Partial<AuthUser> = {
            id: "user-456",
            email: "updated@example.com",
            username: "updateduser",
            createdAt: "2024-02-01T00:00:00.000Z",
            updatedAt: "2024-02-02T00:00:00.000Z",
        };

        act(() => {
            result.current.updateUser(updatedUser);
        });

        expect(result.current.user).toEqual({
            ...mockUser,
            ...updatedUser,
        });
    });

    (isNativePlatform ? it : it.skip)(
        "setAuth and setAuthFromResponse produce equivalent state",
        async () => {
            const { result: result1 } = renderHook(() => useAuthStore());
            const { result: result2 } = renderHook(() => useAuthStore());

            const authResponse: AuthResponse = {
                user: mockUser,
                ...mockTokens,
            };

            await act(async () => {
                await Promise.all([
                    result1.current.setAuth(mockUser, mockTokens),
                    result2.current.setAuthFromResponse(authResponse),
                ]);
            });

            expect(result1.current.user).toEqual(result2.current.user);
            expect(result1.current.accessToken).toBe(
                result2.current.accessToken
            );
            expect(result1.current.refreshToken).toBe(
                result2.current.refreshToken
            );
            expect(result1.current.isAuthenticated).toBe(
                result2.current.isAuthenticated
            );
        }
    );

    (isNativePlatform ? it : it.skip)(
        "maintains tokens when updating user",
        async () => {
            const { result } = renderHook(() => useAuthStore());

            await act(async () => {
                await result.current.setAuth(mockUser, mockTokens);
            });

            act(() => {
                result.current.updateUser({ username: "newusername" });
            });

            expect(result.current.accessToken).toBe(mockTokens.accessToken);
            expect(result.current.refreshToken).toBe(mockTokens.refreshToken);
            expect(result.current.isAuthenticated).toBe(true);
        }
    );

    (isNativePlatform ? it : it.skip)(
        "handles empty user update object",
        async () => {
            const { result } = renderHook(() => useAuthStore());

            await act(async () => {
                await result.current.setAuth(mockUser, mockTokens);
            });

            act(() => {
                result.current.updateUser({});
            });

            expect(result.current.user).toEqual(mockUser);
        }
    );

    (isNativePlatform ? it : it.skip)(
        "loadTokens loads tokens when user exists",
        async () => {
            mockGetItem.mockReset();
            mockGetItem.mockImplementation((key: string) => {
                if (key === "auth-access-token") {
                    return Promise.resolve(mockTokens.accessToken);
                }
                if (key === "auth-refresh-token") {
                    return Promise.resolve(mockTokens.refreshToken);
                }
                return Promise.resolve(null);
            });

            const { result } = renderHook(() => useAuthStore());

            act(() => {
                useAuthStore.setState({
                    user: mockUser,
                    accessToken: null,
                    refreshToken: null,
                    isAuthenticated: false,
                });
            });

            await act(async () => {
                await result.current.loadTokens();
            });

            expect(result.current.accessToken).toBe(mockTokens.accessToken);
            expect(result.current.refreshToken).toBe(mockTokens.refreshToken);
            expect(result.current.isAuthenticated).toBe(true);
        }
    );

    (isNativePlatform ? it : it.skip)(
        "loadTokens clears tokens when tokens don't exist",
        async () => {
            const { result } = renderHook(() => useAuthStore());

            await act(async () => {
                await result.current.setAuth(mockUser, mockTokens);
            });

            mockGetItem.mockResolvedValue(null);

            await act(async () => {
                await result.current.loadTokens();
            });

            expect(result.current.accessToken).toBeNull();
            expect(result.current.refreshToken).toBeNull();
            expect(result.current.isAuthenticated).toBe(false);
        }
    );

    (isNativePlatform ? it : it.skip)(
        "loadTokens clears tokens when only access token exists",
        async () => {
            const { result } = renderHook(() => useAuthStore());

            await act(async () => {
                await result.current.setAuth(mockUser, mockTokens);
            });

            mockGetItem.mockImplementation((key: string) => {
                if (key === "auth-access-token") {
                    return Promise.resolve(mockTokens.accessToken);
                }
                return Promise.resolve(null);
            });

            await act(async () => {
                await result.current.loadTokens();
            });

            expect(result.current.accessToken).toBeNull();
            expect(result.current.refreshToken).toBeNull();
            expect(result.current.isAuthenticated).toBe(false);
        }
    );

    (isNativePlatform ? it : it.skip)(
        "loadTokens clears tokens when only refresh token exists",
        async () => {
            const { result } = renderHook(() => useAuthStore());

            await act(async () => {
                await result.current.setAuth(mockUser, mockTokens);
            });

            mockGetItem.mockImplementation((key: string) => {
                if (key === "auth-refresh-token") {
                    return Promise.resolve(mockTokens.refreshToken);
                }
                return Promise.resolve(null);
            });

            await act(async () => {
                await result.current.loadTokens();
            });

            expect(result.current.accessToken).toBeNull();
            expect(result.current.refreshToken).toBeNull();
            expect(result.current.isAuthenticated).toBe(false);
        }
    );

    (isNativePlatform ? it : it.skip)(
        "loadTokens does not update state when tokens exist but user is null",
        async () => {
            const { result } = renderHook(() => useAuthStore());

            act(() => {
                useAuthStore.setState({
                    user: null,
                    accessToken: null,
                    refreshToken: null,
                    isAuthenticated: false,
                });
            });

            mockGetItem.mockImplementation((key: string) => {
                if (key === "auth-access-token") {
                    return Promise.resolve(mockTokens.accessToken);
                }
                if (key === "auth-refresh-token") {
                    return Promise.resolve(mockTokens.refreshToken);
                }
                return Promise.resolve(null);
            });

            await act(async () => {
                await result.current.loadTokens();
            });

            expect(result.current.user).toBeNull();
            expect(result.current.accessToken).toBeNull();
            expect(result.current.refreshToken).toBeNull();
            expect(result.current.isAuthenticated).toBe(false);
        }
    );

    describe("error logging in development", () => {
        let originalDev: boolean | undefined;

        beforeEach(() => {
            if (!isNativePlatform) {
                return;
            }
            originalDev = (global as unknown as { __DEV__?: boolean }).__DEV__;
            (global as unknown as { __DEV__: boolean }).__DEV__ = true;
        });

        afterEach(() => {
            if (!isNativePlatform) {
                return;
            }
            if (originalDev !== undefined) {
                (global as unknown as { __DEV__: boolean }).__DEV__ =
                    originalDev;
            } else {
                delete (global as unknown as { __DEV__?: boolean }).__DEV__;
            }
        });

        (isNativePlatform ? it : it.skip)(
            "logs warning when getItem fails in development",
            async () => {
                const consoleWarnSpy = jest
                    .spyOn(console, "warn")
                    .mockImplementation(() => {});

                jest.resetModules();
                jest.doMock("../lib/utils/env", () => ({
                    isTestEnv: false,
                }));
                const SecureStoreModule = require("expo-secure-store");
                SecureStoreModule.getItemAsync.mockImplementation(
                    (key: string) => {
                        if (key === "auth-storage") {
                            return Promise.resolve(null);
                        }
                        return Promise.reject(
                            new Error("SecureStore getItem failed")
                        );
                    }
                );

                const {
                    secureStorage: testStorage,
                } = require("../lib/store/auth");

                await testStorage.getItem("test-key");

                expect(consoleWarnSpy).toHaveBeenCalledWith(
                    expect.stringContaining(
                        '[AuthStore] Failed to get item "test-key"'
                    ),
                    expect.any(Error)
                );

                consoleWarnSpy.mockRestore();
            }
        );

        (isNativePlatform ? it : it.skip)(
            "logs error when setItem fails in development",
            async () => {
                const consoleErrorSpy = jest
                    .spyOn(console, "error")
                    .mockImplementation(() => {});

                jest.resetModules();
                jest.doMock("../lib/utils/env", () => ({
                    isTestEnv: false,
                }));
                const SecureStoreModule = require("expo-secure-store");
                SecureStoreModule.getItemAsync.mockResolvedValue(null);
                SecureStoreModule.setItemAsync.mockImplementation(
                    (key: string) => {
                        if (key === "auth-storage") {
                            return Promise.resolve();
                        }
                        return Promise.reject(
                            new Error("SecureStore setItem failed")
                        );
                    }
                );

                const {
                    secureStorage: testStorage,
                } = require("../lib/store/auth");

                await testStorage.setItem("test-key", "test-value");

                expect(consoleErrorSpy).toHaveBeenCalledWith(
                    expect.stringContaining(
                        '[AuthStore] Failed to persist item "test-key"'
                    ),
                    expect.any(Error)
                );

                consoleErrorSpy.mockRestore();
            }
        );

        (isNativePlatform ? it : it.skip)(
            "logs warning when removeItem fails in development",
            async () => {
                const consoleWarnSpy = jest
                    .spyOn(console, "warn")
                    .mockImplementation(() => {});

                jest.resetModules();
                jest.doMock("../lib/utils/env", () => ({
                    isTestEnv: false,
                }));
                const SecureStoreModule = require("expo-secure-store");
                SecureStoreModule.getItemAsync.mockResolvedValue(null);
                SecureStoreModule.setItemAsync.mockResolvedValue(undefined);
                SecureStoreModule.deleteItemAsync.mockImplementation(
                    (key: string) => {
                        if (key === "auth-storage") {
                            return Promise.resolve();
                        }
                        return Promise.reject(
                            new Error("SecureStore deleteItem failed")
                        );
                    }
                );

                const {
                    secureStorage: testStorage,
                } = require("../lib/store/auth");

                await testStorage.removeItem("test-key");

                expect(consoleWarnSpy).toHaveBeenCalledWith(
                    expect.stringContaining(
                        '[AuthStore] Failed to remove item "test-key"'
                    ),
                    expect.any(Error)
                );

                consoleWarnSpy.mockRestore();
            }
        );
    });
});
