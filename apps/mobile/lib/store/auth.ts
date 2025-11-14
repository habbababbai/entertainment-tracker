import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";

import type { AuthUser, AuthTokens, AuthResponse } from "../types";
import { isTestEnv } from "../utils/env";

interface AuthState {
    user: AuthUser | null;
    accessToken: string | null;
    refreshToken: string | null;
    isAuthenticated: boolean;
    setAuth: (user: AuthUser, tokens: AuthTokens) => void;
    setAuthFromResponse: (response: AuthResponse) => void;
    clearAuth: () => void;
    updateUser: (user: Partial<AuthUser>) => void;
}

const secureStorage = {
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
        (set) => ({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            setAuth: (user, tokens) =>
                set({
                    user,
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                    isAuthenticated: true,
                }),
            setAuthFromResponse: (response) =>
                set({
                    user: response.user,
                    accessToken: response.accessToken,
                    refreshToken: response.refreshToken,
                    isAuthenticated: true,
                }),
            clearAuth: () =>
                set({
                    user: null,
                    accessToken: null,
                    refreshToken: null,
                    isAuthenticated: false,
                }),
            updateUser: (updates) =>
                set((state) => ({
                    user: state.user ? { ...state.user, ...updates } : null,
                })),
        }),
        {
            name: "auth-storage",
            storage: createJSONStorage(() => secureStorage),
            partialize: (state) => ({
                user: state.user,
                accessToken: state.accessToken,
                refreshToken: state.refreshToken,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
);
