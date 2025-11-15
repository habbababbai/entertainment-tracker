import { Slot } from "expo-router";
import { useState, useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { enableScreens } from "react-native-screens";
import AsyncStorage from "@react-native-async-storage/async-storage";

import "../lib/i18n";
import { useAuthStore } from "../lib/store/auth";
import { useThemeStore } from "../lib/store/theme";

enableScreens(false);

const asyncStoragePersister = createAsyncStoragePersister({
    storage: AsyncStorage,
    key: "react-query-cache",
});

function createPersistedQueryClient() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                gcTime: 1000 * 60 * 60 * 24,
                staleTime: 1000 * 60 * 5,
            },
        },
    });

    persistQueryClient({
        queryClient,
        persister: asyncStoragePersister,
        maxAge: 1000 * 60 * 60 * 24 * 7,
        dehydrateOptions: {
            shouldDehydrateQuery: (query) => {
                const queryKey = query.queryKey[0] as string;
                return (
                    queryKey === "watchlist" ||
                    queryKey === "watchlist-entry" ||
                    queryKey === "media-item"
                );
            },
        },
    });

    return queryClient;
}

export default function RootLayout() {
    const [queryClient] = useState(() => createPersistedQueryClient());
    const loadTokens = useAuthStore((state) => state.loadTokens);
    const { themeMode, getSystemTheme } = useThemeStore();

    useEffect(() => {
        loadTokens();
    }, [loadTokens]);

    const isDark =
        themeMode === "dark" ||
        (themeMode === "system" && getSystemTheme() === "dark");

    return (
        <SafeAreaProvider>
            <QueryClientProvider client={queryClient}>
                <StatusBar style={isDark ? "light" : "dark"} />
                <Slot />
            </QueryClientProvider>
        </SafeAreaProvider>
    );
}


