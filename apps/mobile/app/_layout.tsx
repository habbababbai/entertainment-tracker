import { Slot } from "expo-router";
import { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export default function RootLayout() {
    const [queryClient] = useState(() => new QueryClient());

    return (
        <SafeAreaProvider>
            <QueryClientProvider client={queryClient}>
                <Slot />
            </QueryClientProvider>
        </SafeAreaProvider>
    );
}


