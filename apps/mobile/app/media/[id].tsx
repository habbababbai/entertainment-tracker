import { useMemo } from "react";
import {
    ActivityIndicator,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { moderateScale, scale, verticalScale } from "react-native-size-matters";

import { fetchMediaItem, type MediaItem } from "../../lib/media";
import { colors } from "../../lib/theme/colors";
import { fontSizes, fontWeights } from "../../lib/theme/fonts";
import "../../lib/i18n";

function formatDate(
    value: string | null | undefined,
    fallback: string
): string {
    if (!value) {
        return fallback;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return fallback;
    }

    return date.toLocaleDateString();
}

function formatCount(
    value: number | null | undefined,
    fallback: string
): string {
    if (typeof value === "number" && Number.isFinite(value)) {
        return String(value);
    }
    return fallback;
}

export default function MediaDetailsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ id?: string | string[] }>();
    const { t } = useTranslation();

    const mediaId = useMemo(() => {
        if (Array.isArray(params.id)) {
            return params.id[0];
        }
        return params.id ?? "";
    }, [params.id]);

    const trimmedId = mediaId.trim();
    const { data, isLoading, isError, error, refetch } = useQuery<
        MediaItem,
        Error
    >({
        queryKey: ["media-item", trimmedId],
        queryFn: () => fetchMediaItem(trimmedId),
        enabled: trimmedId.length > 0,
        retry: false,
    });

    const fallback = t("common.notAvailable");
    const releaseLabel = formatDate(data?.releaseDate, fallback);
    const updatedLabel = formatDate(data?.updatedAt, fallback);
    const seasonsLabel = formatCount(data?.totalSeasons, fallback);
    const episodesLabel = formatCount(data?.totalEpisodes, fallback);

    const body = (() => {
        if (!trimmedId) {
            return (
                <View style={styles.center}>
                    <Text style={styles.errorHeading}>
                        {t("details.missingId")}
                    </Text>
                </View>
            );
        }

        if (isLoading) {
            return (
                <View style={styles.center}>
                    <ActivityIndicator size="large" />
                    <Text style={styles.statusText}>
                        {t("details.loading")}
                    </Text>
                </View>
            );
        }

        if (isError) {
            const isNotFound = error?.message === "Media item not found.";
            return (
                <View style={styles.center}>
                    <Text style={styles.errorHeading}>
                        {t("details.errorHeading")}
                    </Text>
                    <Text style={styles.errorDetails}>
                        {isNotFound ? t("details.notFound") : error?.message}
                    </Text>
                    <TouchableOpacity
                        accessibilityRole="button"
                        onPress={() => refetch()}
                        style={styles.retryButton}
                    >
                        <Text style={styles.retryButtonText}>
                            {t("details.retry")}
                        </Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (!data) {
            return (
                <View style={styles.center}>
                    <Text style={styles.errorHeading}>
                        {t("details.notFound")}
                    </Text>
                </View>
            );
        }

        return (
            <ScrollView
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.header}>
                    <Text style={styles.title}>{data.title}</Text>
                    <Text style={styles.badge}>{data.mediaType}</Text>
                </View>
                {data.posterUrl ? (
                    <Image
                        accessibilityLabel={`${data.title} poster`}
                        source={{ uri: data.posterUrl }}
                        style={styles.poster}
                    />
                ) : (
                    <View style={styles.posterPlaceholder}>
                        <Text style={styles.posterPlaceholderText}>
                            {t("details.posterFallback")}
                        </Text>
                    </View>
                )}
                <Text style={styles.metadata}>
                    {t("details.metadata", {
                        source: data.source,
                        mediaType: data.mediaType,
                        seasons: seasonsLabel,
                        episodes: episodesLabel,
                    })}
                </Text>
                <Text style={styles.metaLine}>
                    {t("details.releaseDate", { value: releaseLabel })}
                </Text>
                <Text style={styles.metaLine}>
                    {t("details.updatedAt", { value: updatedLabel })}
                </Text>
                <View style={styles.section}>
                    <Text style={styles.sectionHeading}>
                        {t("details.descriptionHeading")}
                    </Text>
                    <Text style={styles.sectionBody}>
                        {data.description ?? t("home.emptyDescription")}
                    </Text>
                </View>
            </ScrollView>
        );
    })();

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ title: t("details.title") }} />
            <View style={styles.toolbar}>
                <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => router.back()}
                    style={styles.backButton}
                >
                    <Text style={styles.backButtonText}>
                        {t("details.back")}
                    </Text>
                </TouchableOpacity>
            </View>
            {body}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    toolbar: {
        paddingHorizontal: scale(16),
        paddingTop: verticalScale(12),
        paddingBottom: verticalScale(8),
    },
    backButton: {
        alignSelf: "flex-start",
        paddingHorizontal: scale(12),
        paddingVertical: verticalScale(6),
        borderRadius: moderateScale(8),
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    backButtonText: {
        fontSize: fontSizes.sm,
        fontWeight: fontWeights.medium,
        color: colors.textPrimary,
    },
    contentContainer: {
        paddingHorizontal: scale(20),
        paddingBottom: verticalScale(32),
        gap: verticalScale(16),
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: scale(12),
    },
    poster: {
        width: "100%",
        height: verticalScale(260),
        borderRadius: moderateScale(16),
        backgroundColor: colors.surface,
    },
    posterPlaceholder: {
        height: verticalScale(260),
        borderRadius: moderateScale(16),
        backgroundColor: colors.surface,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: scale(16),
    },
    posterPlaceholderText: {
        color: colors.textSecondary,
        fontSize: fontSizes.sm,
        textAlign: "center",
    },
    title: {
        flex: 1,
        fontSize: fontSizes.xl,
        fontWeight: fontWeights.semiBold,
        color: colors.textPrimary,
    },
    badge: {
        backgroundColor: colors.accent,
        color: colors.accentOnAccent,
        paddingHorizontal: scale(12),
        paddingVertical: verticalScale(4),
        borderRadius: moderateScale(999),
        fontSize: fontSizes.xs,
        fontWeight: fontWeights.semiBold,
    },
    metadata: {
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
    },
    metaLine: {
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
    },
    section: {
        gap: verticalScale(4),
    },
    sectionHeading: {
        fontSize: fontSizes.md,
        fontWeight: fontWeights.semiBold,
        color: colors.textPrimary,
    },
    sectionBody: {
        fontSize: fontSizes.md,
        color: colors.textSecondary,
        lineHeight: verticalScale(20),
    },
    center: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: scale(24),
        gap: verticalScale(12),
    },
    statusText: {
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
    },
    errorHeading: {
        fontSize: fontSizes.lg,
        fontWeight: fontWeights.semiBold,
        color: colors.error,
        textAlign: "center",
    },
    errorDetails: {
        fontSize: fontSizes.sm,
        color: colors.errorMuted,
        textAlign: "center",
    },
    retryButton: {
        marginTop: verticalScale(8),
        paddingHorizontal: scale(16),
        paddingVertical: verticalScale(8),
        borderRadius: moderateScale(10),
        backgroundColor: colors.accent,
    },
    retryButtonText: {
        fontSize: fontSizes.sm,
        fontWeight: fontWeights.semiBold,
        color: colors.accentOnAccent,
    },
});
