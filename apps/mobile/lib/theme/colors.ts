const lightColors = {
    background: "#ffffff",
    surface: "#f8fafc",
    accent: "#2563eb",
    accentOnAccent: "#ffffff",
    textPrimary: "#1f2937",
    textSecondary: "#4b5563",
    textMuted: "#6b7280",
    border: "#d1d5db",
    error: "#dc2626",
    errorMuted: "#b91c1c",
} as const;

const darkColors = {
    background: "#0f172a",
    surface: "#1e293b",
    accent: "#3b82f6",
    accentOnAccent: "#ffffff",
    textPrimary: "#f1f5f9",
    textSecondary: "#cbd5e1",
    textMuted: "#94a3b8",
    border: "#334155",
    error: "#ef4444",
    errorMuted: "#dc2626",
} as const;

export type ColorToken = keyof typeof lightColors;

export const lightTheme = lightColors;
export const darkTheme = darkColors;

export type Theme = {
    background: string;
    surface: string;
    accent: string;
    accentOnAccent: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    border: string;
    error: string;
    errorMuted: string;
};

export const getThemeColors = (isDark: boolean): Theme => {
    return isDark ? darkTheme : lightTheme;
};
