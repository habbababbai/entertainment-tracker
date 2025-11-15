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

import { registerUser } from "../lib/auth";
import { useAuthStore } from "../lib/store/auth";
import { useTheme } from "../lib/theme";
import { fontSizes, fontWeights } from "../lib/theme/fonts";

export default function RegisterScreen() {
    const [email, setEmail] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const router = useRouter();
    const insets = useSafeAreaInsets();
    const colors = useTheme();
    const styles = createStyles(colors);
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

    const handleRegister = async () => {
        if (!email.trim() || !username.trim() || !password.trim()) {
            setError("Please fill in all fields");
            return;
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await registerUser({
                email: email.trim(),
                username: username.trim(),
                password,
            });
            await setAuthFromResponse(response);
            router.replace("/(tabs)/settings");
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Registration failed. Please try again."
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleNavigateToLogin = () => {
        router.back();
    };

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
                    <Text style={styles.title}>Create Account</Text>
                    <Text style={styles.subtitle}>Sign up to get started</Text>

                    <View style={styles.form}>
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Email</Text>
                            <TextInput
                                value={email}
                                onChangeText={(text) => {
                                    setEmail(text);
                                    setError(null);
                                }}
                                placeholder="Enter your email"
                                placeholderTextColor={colors.textMuted}
                                style={styles.input}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                autoComplete="email"
                                editable={!isLoading}
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Username</Text>
                            <TextInput
                                value={username}
                                onChangeText={(text) => {
                                    setUsername(text);
                                    setError(null);
                                }}
                                placeholder="Choose a username"
                                placeholderTextColor={colors.textMuted}
                                style={styles.input}
                                autoCapitalize="none"
                                autoComplete="username"
                                editable={!isLoading}
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Password</Text>
                            <TextInput
                                value={password}
                                onChangeText={(text) => {
                                    setPassword(text);
                                    setError(null);
                                }}
                                placeholder="Enter your password"
                                placeholderTextColor={colors.textMuted}
                                style={styles.input}
                                secureTextEntry
                                autoComplete="password-new"
                                editable={!isLoading}
                                onSubmitEditing={handleRegister}
                            />
                        </View>

                        {error ? (
                            <View style={styles.errorContainer}>
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        ) : null}

                        <TouchableOpacity
                            onPress={handleRegister}
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
                                <Text style={styles.buttonText}>Sign Up</Text>
                            )}
                        </TouchableOpacity>

                        <View style={styles.footer}>
                            <Text style={styles.footerText}>
                                Already have an account?{" "}
                            </Text>
                            <TouchableOpacity
                                onPress={handleNavigateToLogin}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.linkText}>Sign In</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </TouchableWithoutFeedback>
        </SafeAreaView>
    );
}

const createStyles = (colors: ReturnType<typeof useTheme>) =>
    StyleSheet.create({
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
    footer: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginTop: verticalScale(16),
    },
    footerText: {
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
    },
        linkText: {
            fontSize: fontSizes.sm,
            color: colors.accent,
            fontWeight: fontWeights.semiBold,
        },
    });
