import { moderateScale } from "react-native-size-matters";

const baseFontSizes = {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 24,
} as const;

export type FontSizeToken = keyof typeof baseFontSizes;

export const fontSizes: Record<FontSizeToken, number> = {
    xs: moderateScale(baseFontSizes.xs),
    sm: moderateScale(baseFontSizes.sm),
    md: moderateScale(baseFontSizes.md),
    lg: moderateScale(baseFontSizes.lg),
    xl: moderateScale(baseFontSizes.xl),
};

export const fontWeights = {
    regular: "400",
    medium: "500",
    semiBold: "600",
    bold: "700",
} as const;

export const fontFamilies = {
    regular: "System",
    medium: "System",
    semiBold: "System",
    bold: "System",
} as const;


