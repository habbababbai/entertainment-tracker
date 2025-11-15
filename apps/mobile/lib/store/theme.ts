import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeState {
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => void;
    toggleTheme: () => void;
    getSystemTheme: () => "light" | "dark";
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set, get) => ({
            themeMode: "system",
            setThemeMode: (themeMode) => set({ themeMode }),
            toggleTheme: () => {
                const current = get().themeMode;
                if (current === "system") {
                    const systemTheme = get().getSystemTheme();
                    set({ themeMode: systemTheme === "dark" ? "light" : "dark" });
                } else {
                    set({ themeMode: current === "dark" ? "light" : "dark" });
                }
            },
            getSystemTheme: () => {
                const { Appearance } = require("react-native");
                const systemColorScheme = Appearance.getColorScheme();
                return systemColorScheme === "dark" ? "dark" : "light";
            },
        }),
        {
            name: "theme-storage",
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);

