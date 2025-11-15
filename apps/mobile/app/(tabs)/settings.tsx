import { useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { moderateScale, scale, verticalScale } from "react-native-size-matters";
import { useRouter } from "expo-router";

import LoginScreen from "../../components/LoginScreen";
import { useAuthStore } from "../../lib/store/auth";
import { useThemeStore } from "../../lib/store/theme";
import { useTheme } from "../../lib/theme";
import { fontSizes, fontWeights } from "../../lib/theme/fonts";

function SettingsScreen() {
    const user = useAuthStore((state) => state.user);
    const clearAuth = useAuthStore((state) => state.clearAuth);
    const { themeMode, setThemeMode, toggleTheme, getSystemTheme } =
        useThemeStore();
    const colors = useTheme();
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const router = useRouter();

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await clearAuth();
        } finally {
            setIsLoggingOut(false);
        }
    };

    const handleSystemThemeToggle = (value: boolean) => {
        if (value) {
            setThemeMode("system");
        } else {
            const currentIsDark =
                themeMode === "dark" ||
                (themeMode === "system" && getSystemTheme() === "dark");
            setThemeMode(currentIsDark ? "dark" : "light");
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString();
    };

    const isSystemTheme = themeMode === "system";
    const currentTheme = themeMode === "system" ? getSystemTheme() : themeMode;
    const isDarkMode = currentTheme === "dark";
    const themeLabel = isDarkMode ? "Dark Mode" : "Light Mode";

    const styles = createStyles(colors);

    return (
        <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.title}>Settings</Text>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Appearance</Text>

                    <View style={styles.themeOption}>
                        <View style={styles.themeOptionContent}>
                            <Text style={styles.themeOptionLabel}>
                                Use System Theme
                            </Text>
                            <Switch
                                value={isSystemTheme}
                                onValueChange={handleSystemThemeToggle}
                                trackColor={{
                                    false: colors.border,
                                    true: colors.accent,
                                }}
                                thumbColor={
                                    isSystemTheme
                                        ? colors.accentOnAccent
                                        : colors.surface
                                }
                            />
                        </View>
                    </View>

                    <View
                        style={[
                            styles.themeOption,
                            isSystemTheme && styles.themeOptionDisabled,
                        ]}
                    >
                        <View style={styles.themeOptionContent}>
                            <Text
                                style={[
                                    styles.themeOptionLabel,
                                    isSystemTheme &&
                                        styles.themeOptionLabelDisabled,
                                ]}
                            >
                                {themeLabel}
                            </Text>
                            <Switch
                                value={isDarkMode}
                                onValueChange={toggleTheme}
                                disabled={isSystemTheme}
                                trackColor={{
                                    false: colors.border,
                                    true: colors.accent,
                                }}
                                thumbColor={
                                    isDarkMode
                                        ? colors.accentOnAccent
                                        : colors.surface
                                }
                            />
                        </View>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account Information</Text>

                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Email</Text>
                        <Text style={styles.infoValue}>{user?.email}</Text>
                    </View>

                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Username</Text>
                        <Text style={styles.infoValue}>{user?.username}</Text>
                    </View>

                    {user?.createdAt && (
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Member Since</Text>
                            <Text style={styles.infoValue}>
                                {formatDate(user.createdAt)}
                            </Text>
                        </View>
                    )}
                </View>

                <TouchableOpacity
                    onPress={() => router.push("/reset-password")}
                    style={styles.resetPasswordButton}
                    activeOpacity={0.8}
                >
                    <Text style={styles.resetPasswordButtonText}>
                        Reset Password
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleLogout}
                    style={[
                        styles.logoutButton,
                        isLoggingOut && styles.logoutButtonDisabled,
                    ]}
                    disabled={isLoggingOut}
                    activeOpacity={0.8}
                >
                    {isLoggingOut ? (
                        <ActivityIndicator color={colors.error} />
                    ) : (
                        <Text style={styles.logoutButtonText}>Logout</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const createStyles = (colors: ReturnType<typeof useTheme>) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        scrollView: {
            flex: 1,
        },
        content: {
            paddingHorizontal: scale(24),
            paddingVertical: verticalScale(24),
        },
        title: {
            fontSize: fontSizes.xl,
            fontWeight: fontWeights.bold,
            color: colors.textPrimary,
            marginBottom: verticalScale(24),
        },
        section: {
            backgroundColor: colors.surface,
            borderRadius: moderateScale(12),
            padding: scale(16),
            marginBottom: verticalScale(24),
            gap: verticalScale(12),
        },
        sectionTitle: {
            fontSize: fontSizes.md,
            fontWeight: fontWeights.semiBold,
            color: colors.textPrimary,
            marginBottom: verticalScale(8),
        },
        themeOption: {
            paddingVertical: verticalScale(8),
        },
        themeOptionDisabled: {
            opacity: 0.5,
        },
        themeOptionContent: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
        },
        themeOptionLabel: {
            fontSize: fontSizes.md,
            color: colors.textPrimary,
            fontWeight: fontWeights.medium,
        },
        themeOptionLabelDisabled: {
            opacity: 0.5,
        },
        infoRow: {
            gap: verticalScale(4),
        },
        infoLabel: {
            fontSize: fontSizes.sm,
            color: colors.textSecondary,
            fontWeight: fontWeights.medium,
        },
        infoValue: {
            fontSize: fontSizes.md,
            color: colors.textPrimary,
        },
        resetPasswordButton: {
            backgroundColor: colors.accent,
            paddingVertical: verticalScale(14),
            borderRadius: moderateScale(10),
            alignItems: "center",
            justifyContent: "center",
            marginBottom: verticalScale(16),
        },
        resetPasswordButtonText: {
            color: colors.accentOnAccent,
            fontSize: fontSizes.md,
            fontWeight: fontWeights.semiBold,
        },
        logoutButton: {
            backgroundColor: colors.error,
            paddingVertical: verticalScale(14),
            borderRadius: moderateScale(10),
            alignItems: "center",
            justifyContent: "center",
        },
        logoutButtonDisabled: {
            opacity: 0.6,
        },
        logoutButtonText: {
            color: colors.accentOnAccent,
            fontSize: fontSizes.md,
            fontWeight: fontWeights.semiBold,
        },
    });

export default function SettingsTab() {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

    if (!isAuthenticated) {
        return <LoginScreen />;
    }

    return <SettingsScreen />;
}
