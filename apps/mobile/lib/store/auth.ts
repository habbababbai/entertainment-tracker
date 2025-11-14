import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";

import type { AuthUser, AuthTokens, AuthResponse } from "../types";
import { isTestEnv } from "../utils/env";

const TOKEN_KEYS = {
    accessToken: "auth-access-token",
    refreshToken: "auth-refresh-token",
} as const;

interface AuthState {
    user: AuthUser | null;
    accessToken: string | null;
    refreshToken: string | null;
    isAuthenticated: boolean;
    setAuth: (user: AuthUser, tokens: AuthTokens) => Promise<void>;
    setAuthFromResponse: (response: AuthResponse) => Promise<void>;
    clearAuth: () => Promise<void>;
    updateUser: (user: Partial<AuthUser>) => void;
    loadTokens: () => Promise<void>;
}

export const secureStorage = {
    getItem: async (name: string): Promise<string | null> => {
        try {
            return await SecureStore.getItemAsync(name);
        } catch (error) {
            if (__DEV__ && !isTestEnv) {
                console.warn(
                    `[AuthStore] Failed to get item "${name}":`,
                    error
                );
            }
            return null;
        }
    },
    setItem: async (name: string, value: string): Promise<void> => {
        try {
            await SecureStore.setItemAsync(name, value);
        } catch (error) {
            if (__DEV__ && !isTestEnv) {
                console.error(
                    `[AuthStore] Failed to persist item "${name}":`,
                    error
                );
            }
        }
    },
    removeItem: async (name: string): Promise<void> => {
        try {
            await SecureStore.deleteItemAsync(name);
        } catch (error) {
            if (__DEV__ && !isTestEnv) {
                console.warn(
                    `[AuthStore] Failed to remove item "${name}":`,
                    error
                );
            }
        }
    },
};

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            setAuth: async (user, tokens) => {
                await Promise.all([
                    secureStorage.setItem(
                        TOKEN_KEYS.accessToken,
                        tokens.accessToken
                    ),
                    secureStorage.setItem(
                        TOKEN_KEYS.refreshToken,
                        tokens.refreshToken
                    ),
                ]);
                set({
                    user,
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                    isAuthenticated: true,
                });
            },
            setAuthFromResponse: async (response) => {
                await Promise.all([
                    secureStorage.setItem(
                        TOKEN_KEYS.accessToken,
                        response.accessToken
                    ),
                    secureStorage.setItem(
                        TOKEN_KEYS.refreshToken,
                        response.refreshToken
                    ),
                ]);
                set({
                    user: response.user,
                    accessToken: response.accessToken,
                    refreshToken: response.refreshToken,
                    isAuthenticated: true,
                });
            },
            clearAuth: async () => {
                await Promise.all([
                    secureStorage.removeItem(TOKEN_KEYS.accessToken),
                    secureStorage.removeItem(TOKEN_KEYS.refreshToken),
                ]);
                set({
                    user: null,
                    accessToken: null,
                    refreshToken: null,
                    isAuthenticated: false,
                });
            },
            updateUser: (updates) =>
                set((state) => ({
                    user: state.user ? { ...state.user, ...updates } : null,
                })),
            loadTokens: async () => {
                const [accessToken, refreshToken] = await Promise.all([
                    secureStorage.getItem(TOKEN_KEYS.accessToken),
                    secureStorage.getItem(TOKEN_KEYS.refreshToken),
                ]);

                if (accessToken && refreshToken && get().user) {
                    set({
                        accessToken,
                        refreshToken,
                        isAuthenticated: true,
                    });
                } else if (!accessToken || !refreshToken) {
                    set({
                        accessToken: null,
                        refreshToken: null,
                        isAuthenticated: false,
                    });
                }
            },
        }),
        {
            name: "auth-storage",
            storage: createJSONStorage(() => secureStorage),
            partialize: (state) => ({
                user: state.user,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
);
