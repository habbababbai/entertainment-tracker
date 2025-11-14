import { useState } from "react";
import {
    ActivityIndicator,
    Keyboard,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import {
    SafeAreaView,
    useSafeAreaInsets,
} from "react-native-safe-area-context";
import { moderateScale, scale, verticalScale } from "react-native-size-matters";
import { useRouter } from "expo-router";

import { loginUser, resetPasswordForLoggedInUser } from "../lib/auth";
import { useAuthStore } from "../lib/store/auth";
import { colors } from "../lib/theme/colors";
import { fontSizes, fontWeights } from "../lib/theme/fonts";

export default function ResetPasswordScreen() {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const router = useRouter();
    const insets = useSafeAreaInsets();
    const user = useAuthStore((state) => state.user);
    const setAuthFromResponse = useAuthStore(
        (state) => state.setAuthFromResponse
    );

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace("/(tabs)/settings");
        }
    };

    const handleResetPassword = async () => {
        if (!password.trim() || !confirmPassword.trim()) {
            setError("Please enter both password fields");
            return;
        }

        if (password.length < 8) {
            setError("Password must be at least 8 characters long");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            await resetPasswordForLoggedInUser(password);

            if (!user) {
                throw new Error("User not found");
            }

            const authResponse = await loginUser({
                email: user.email,
                password: password,
            });

            await setAuthFromResponse(authResponse);
            setSuccess(true);
            setTimeout(() => {
                router.replace("/(tabs)/settings");
            }, 1500);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Password reset failed. Please try again."
            );
        } finally {
            setIsLoading(false);
        }
    };

    if (success) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.content}>
                    <Text style={styles.title}>Password Reset Successful</Text>
                    <Text style={styles.subtitle}>
                        Your password has been reset successfully. Redirecting to
                        settings...
                    </Text>
                    <ActivityIndicator
                        size="large"
                        color={colors.accent}
                        style={styles.activityIndicator}
                    />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <TouchableOpacity
                onPress={handleBack}
                style={[
                    styles.backButton,
                    { top: insets.top + verticalScale(16) },
                ]}
                activeOpacity={0.8}
            >
                <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>

            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.content}>
                    <Text style={styles.title}>Reset Password</Text>
                    <Text style={styles.subtitle}>
                        Enter your new password below
                    </Text>

                    <View style={styles.form}>
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>New Password</Text>
                            <TextInput
                                value={password}
                                onChangeText={(text) => {
                                    setPassword(text);
                                    setError(null);
                                }}
                                placeholder="Enter your new password"
                                placeholderTextColor={colors.textMuted}
                                style={styles.input}
                                secureTextEntry
                                autoComplete="password-new"
                                editable={!isLoading}
                                onSubmitEditing={handleResetPassword}
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Confirm Password</Text>
                            <TextInput
                                value={confirmPassword}
                                onChangeText={(text) => {
                                    setConfirmPassword(text);
                                    setError(null);
                                }}
                                placeholder="Confirm your new password"
                                placeholderTextColor={colors.textMuted}
                                style={styles.input}
                                secureTextEntry
                                autoComplete="password-new"
                                editable={!isLoading}
                                onSubmitEditing={handleResetPassword}
                            />
                        </View>

                        {error ? (
                            <View style={styles.errorContainer}>
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        ) : null}

                        <TouchableOpacity
                            onPress={handleResetPassword}
                            style={[
                                styles.button,
                                isLoading && styles.buttonDisabled,
                            ]}
                            disabled={isLoading}
                            activeOpacity={0.8}
                        >
                            {isLoading ? (
                                <ActivityIndicator
                                    color={colors.accentOnAccent}
                                />
                            ) : (
                                <Text style={styles.buttonText}>
                                    Reset Password
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableWithoutFeedback>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    backButton: {
        position: "absolute",
        left: scale(16),
        zIndex: 1,
        paddingVertical: verticalScale(8),
        paddingHorizontal: scale(12),
    },
    content: {
        flex: 1,
        paddingHorizontal: scale(24),
        paddingVertical: verticalScale(32),
        justifyContent: "center",
    },
    backButtonText: {
        fontSize: fontSizes.md,
        color: colors.accent,
        fontWeight: fontWeights.medium,
    },
    title: {
        fontSize: moderateScale(32),
        fontWeight: fontWeights.bold,
        color: colors.textPrimary,
        textAlign: "center",
        marginBottom: verticalScale(8),
    },
    subtitle: {
        fontSize: fontSizes.md,
        color: colors.textSecondary,
        textAlign: "center",
        marginBottom: verticalScale(32),
    },
    form: {
        gap: verticalScale(20),
    },
    inputContainer: {
        gap: verticalScale(8),
    },
    label: {
        fontSize: fontSizes.sm,
        fontWeight: fontWeights.medium,
        color: colors.textPrimary,
    },
    input: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: moderateScale(10),
        paddingHorizontal: scale(16),
        paddingVertical: verticalScale(12),
        fontSize: fontSizes.md,
        backgroundColor: colors.surface,
        color: colors.textPrimary,
    },
    errorContainer: {
        padding: scale(12),
        backgroundColor: colors.errorMuted,
        borderRadius: moderateScale(8),
    },
    errorText: {
        color: colors.error,
        fontSize: fontSizes.sm,
        textAlign: "center",
    },
    button: {
        backgroundColor: colors.accent,
        paddingVertical: verticalScale(14),
        borderRadius: moderateScale(10),
        alignItems: "center",
        justifyContent: "center",
        marginTop: verticalScale(8),
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: colors.accentOnAccent,
        fontSize: fontSizes.md,
        fontWeight: fontWeights.semiBold,
    },
    activityIndicator: {
        marginTop: verticalScale(24),
    },
});

