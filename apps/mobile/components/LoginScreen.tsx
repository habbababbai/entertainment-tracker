import { useState } from "react";
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { moderateScale, scale, verticalScale } from "react-native-size-matters";

import { loginUser } from "../lib/auth";
import { useAuthStore } from "../lib/store/auth";
import { colors } from "../lib/theme/colors";
import { fontSizes, fontWeights } from "../lib/theme/fonts";

export default function LoginScreen() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const setAuthFromResponse = useAuthStore(
        (state) => state.setAuthFromResponse
    );

    const handleLogin = async () => {
        if (!email.trim() || !password.trim()) {
            setError("Please enter both email and password");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await loginUser({
                email: email.trim(),
                password,
            });
            await setAuthFromResponse(response);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Login failed. Please try again."
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Welcome Back</Text>
                <Text style={styles.subtitle}>Sign in to continue</Text>

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
                            autoComplete="password"
                            editable={!isLoading}
                            onSubmitEditing={handleLogin}
                        />
                    </View>

                    {error ? (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : null}

                    <TouchableOpacity
                        onPress={handleLogin}
                        style={[styles.button, isLoading && styles.buttonDisabled]}
                        disabled={isLoading}
                        activeOpacity={0.8}
                    >
                        {isLoading ? (
                            <ActivityIndicator color={colors.accentOnAccent} />
                        ) : (
                            <Text style={styles.buttonText}>Sign In</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        flex: 1,
        paddingHorizontal: scale(24),
        paddingVertical: verticalScale(32),
        justifyContent: "center",
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
});

