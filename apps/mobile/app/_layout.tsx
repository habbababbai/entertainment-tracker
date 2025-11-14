import { Slot } from "expo-router";
import { useState, useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { enableScreens } from "react-native-screens";

import "../lib/i18n";
import { useAuthStore } from "../lib/store/auth";

enableScreens(false);

export default function RootLayout() {
    const [queryClient] = useState(() => new QueryClient());
    const loadTokens = useAuthStore((state) => state.loadTokens);

    useEffect(() => {
        loadTokens();
    }, [loadTokens]);

    return (
        <SafeAreaProvider>
            <QueryClientProvider client={queryClient}>
                <Slot />
            </QueryClientProvider>
        </SafeAreaProvider>
    );
}


