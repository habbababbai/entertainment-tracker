import { useThemeStore } from "../store/theme";
import { getThemeColors, type Theme } from "./colors";

export const useTheme = (): Theme => {
    const { themeMode, getSystemTheme } = useThemeStore();
    
    const isDark =
        themeMode === "dark" ||
        (themeMode === "system" && getSystemTheme() === "dark");
    
    return getThemeColors(isDark);
};

export type { Theme } from "./colors";

