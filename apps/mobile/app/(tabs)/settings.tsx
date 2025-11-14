import { useState } from "react";
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { moderateScale, scale, verticalScale } from "react-native-size-matters";

import LoginScreen from "../../components/LoginScreen";
import { useAuthStore } from "../../lib/store/auth";
import { colors } from "../../lib/theme/colors";
import { fontSizes, fontWeights } from "../../lib/theme/fonts";

function SettingsScreen() {
    const user = useAuthStore((state) => state.user);
    const clearAuth = useAuthStore((state) => state.clearAuth);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await clearAuth();
        } finally {
            setIsLoggingOut(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString();
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Settings</Text>

                <View style={styles.userSection}>
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
                    onPress={handleLogout}
                    style={[styles.logoutButton, isLoggingOut && styles.logoutButtonDisabled]}
                    disabled={isLoggingOut}
                    activeOpacity={0.8}
                >
                    {isLoggingOut ? (
                        <ActivityIndicator color={colors.error} />
                    ) : (
                        <Text style={styles.logoutButtonText}>Logout</Text>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

export default function SettingsTab() {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

    if (!isAuthenticated) {
        return <LoginScreen />;
    }

    return <SettingsScreen />;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        flex: 1,
        paddingHorizontal: scale(24),
        paddingVertical: verticalScale(24),
    },
    title: {
        fontSize: fontSizes.xl,
        fontWeight: fontWeights.bold,
        color: colors.textPrimary,
        marginBottom: verticalScale(24),
    },
    userSection: {
        backgroundColor: colors.surface,
        borderRadius: moderateScale(12),
        padding: scale(16),
        marginBottom: verticalScale(24),
        gap: verticalScale(16),
    },
    sectionTitle: {
        fontSize: fontSizes.md,
        fontWeight: fontWeights.semiBold,
        color: colors.textPrimary,
        marginBottom: verticalScale(8),
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
