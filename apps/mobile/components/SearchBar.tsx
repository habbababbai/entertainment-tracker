import { useEffect, useState } from "react";
import { View, TextInput, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { moderateScale, scale, verticalScale } from "react-native-size-matters";

import { useDebounce } from "../lib/hooks";
import { useTheme } from "../lib/theme";
import { fontSizes } from "../lib/theme/fonts";

interface SearchBarProps {
    value: string;
    onChangeText: (text: string) => void;
    onSubmit?: () => void;
    placeholder?: string;
    debounceDelay?: number;
}

export default function SearchBar({
    value,
    onChangeText,
    onSubmit,
    placeholder,
    debounceDelay = 300,
}: SearchBarProps) {
    const { t } = useTranslation();
    const colors = useTheme();
    const styles = createStyles(colors);
    const [localValue, setLocalValue] = useState(value);
    const debouncedValue = useDebounce(localValue, debounceDelay);

    const defaultPlaceholder = placeholder ?? t("home.searchPlaceholder");

    useEffect(() => {
        if (debouncedValue !== value) {
            onChangeText(debouncedValue);
        }
    }, [debouncedValue, onChangeText, value]);

    useEffect(() => {
        setLocalValue((prev) => {
            if (value !== prev) {
                return value;
            }
            return prev;
        });
    }, [value]);

    const handleSubmit = () => {
        onChangeText(localValue);
        onSubmit?.();
    };

    return (
        <View style={styles.searchBar}>
            <TextInput
                value={localValue}
                onChangeText={setLocalValue}
                placeholder={defaultPlaceholder}
                placeholderTextColor={colors.textMuted}
                returnKeyType="search"
                onSubmitEditing={handleSubmit}
                style={styles.searchInput}
                autoCapitalize="none"
            />
        </View>
    );
}

const createStyles = (colors: ReturnType<typeof useTheme>) =>
    StyleSheet.create({
        searchBar: {
            marginBottom: verticalScale(16),
        },
        searchInput: {
            width: "100%",
            backgroundColor: colors.surface,
            borderRadius: moderateScale(10),
            paddingHorizontal: scale(16),
            paddingVertical: verticalScale(12),
            fontSize: fontSizes.md,
            color: colors.textPrimary,
            borderWidth: 1,
            borderColor: colors.border,
        },
    });
