import { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { moderateScale, scale, verticalScale } from "react-native-size-matters";

import { fetchMediaItem, type MediaItem } from "../../lib/media";
import {
    addToWatchlist,
    fetchWatchlistEntry,
    removeFromWatchlist,
    type WatchEntry,
} from "../../lib/watchlist";
import { useAuthStore } from "../../lib/store/auth";
import { useTheme } from "../../lib/theme";
import { useTabsStore } from "../../lib/store/tabs";
import { fontSizes, fontWeights } from "../../lib/theme/fonts";
import EditWatchlistEntryModal from "../../components/EditWatchlistEntryModal";
import StarRatingComponent from "../../components/StarRating";
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
    const lastTab = useTabsStore((s) => s.lastTab);
    const params = useLocalSearchParams<{ id?: string | string[] }>();
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const colors = useTheme();
    const styles = createStyles(colors);
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

    const [showEditModal, setShowEditModal] = useState(false);

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
        queryFn: async (): Promise<MediaItem> => {
            const result = await fetchMediaItem(trimmedId);
            if (!result) {
                throw new Error("Media item not found.");
            }
            return result;
        },
        enabled: trimmedId.length > 0,
        retry: false,
    });

    const externalId = data?.externalId;
    const { data: watchEntry } = useQuery<WatchEntry | null, Error>({
        queryKey: ["watchlist-entry", externalId],
        queryFn: async (): Promise<WatchEntry | null> => {
            if (!isAuthenticated || !externalId) {
                return null;
            }
            try {
                const entry = await fetchWatchlistEntry(externalId);
                return entry || null;
            } catch (error) {
                // If it's a 404, the item is not in watchlist (expected)
                if (
                    error instanceof Error &&
                    error.message.includes("not found")
                ) {
                    return null;
                }
                // For other errors, rethrow to surface them
                throw error;
            }
        },
        enabled: isAuthenticated && Boolean(externalId),
        retry: false,
        placeholderData: null,
    });

    const addToWatchlistMutation = useMutation({
        mutationFn: () => {
            if (!externalId) {
                throw new Error("Media item external ID not available");
            }
            return addToWatchlist({ mediaItemId: externalId }).then(
                (result) => ({
                    result,
                    externalId,
                })
            );
        },
        onSuccess: ({ result, externalId }) => {
            queryClient.setQueryData(["watchlist-entry", externalId], result);
            queryClient.invalidateQueries({ queryKey: ["watchlist"] });
        },
        onError: (error) => {
            console.error("Failed to add to watchlist:", error);
        },
    });

    const removeFromWatchlistMutation = useMutation({
        mutationFn: async () => {
            if (!externalId) {
                throw new Error("Media item external ID not available");
            }
            const idToRemove = externalId;
            await removeFromWatchlist(idToRemove);
            return idToRemove;
        },
        onSuccess: (removedExternalId) => {
            queryClient.setQueryData(
                ["watchlist-entry", removedExternalId],
                null
            );
            queryClient.invalidateQueries({ queryKey: ["watchlist"] });
        },
        onError: (error) => {
            console.error("Failed to remove from watchlist:", error);
        },
    });

    const handleSaveToggle = useCallback(() => {
        if (!externalId) {
            return;
        }
        if (watchEntry) {
            removeFromWatchlistMutation.mutate();
        } else {
            addToWatchlistMutation.mutate();
        }
    }, [
        watchEntry,
        addToWatchlistMutation,
        removeFromWatchlistMutation,
        externalId,
    ]);

    const handleEditPress = useCallback(() => {
        if (watchEntry) {
            setShowEditModal(true);
        }
    }, [watchEntry]);

    const handleCloseEditModal = useCallback(() => {
        setShowEditModal(false);
    }, []);

    const isLoadingWatchlist =
        addToWatchlistMutation.isPending ||
        removeFromWatchlistMutation.isPending;

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
            <>
                <ScrollView
                    contentContainerStyle={styles.contentContainer}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.header}>
                        <Text style={styles.title}>{data.title}</Text>
                        <View style={styles.badgeContainer}>
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>
                                    {data.mediaType}
                                </Text>
                            </View>
                            {watchEntry && (
                                <View style={styles.statusBadge}>
                                    <Text style={styles.statusBadgeText}>
                                        {t(
                                            `status.${watchEntry.status}` as keyof typeof t
                                        )}
                                    </Text>
                                </View>
                            )}
                        </View>
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
                    {isAuthenticated && (
                        <View style={styles.actionsContainer}>
                            <TouchableOpacity
                                accessibilityRole="button"
                                onPress={handleSaveToggle}
                                disabled={isLoadingWatchlist || !externalId}
                                style={[
                                    styles.actionButton,
                                    watchEntry && styles.actionButtonActive,
                                    isLoadingWatchlist &&
                                        styles.actionButtonDisabled,
                                ]}
                                activeOpacity={0.8}
                            >
                                {isLoadingWatchlist ? (
                                    <ActivityIndicator
                                        size="small"
                                        color={
                                            watchEntry
                                                ? colors.accentOnAccent
                                                : colors.textPrimary
                                        }
                                    />
                                ) : (
                                    <Text
                                        style={[
                                            styles.actionButtonText,
                                            watchEntry &&
                                                styles.actionButtonTextActive,
                                        ]}
                                    >
                                        {watchEntry
                                            ? t("details.removeFromWatchlist")
                                            : t("details.addToWatchlist")}
                                    </Text>
                                )}
                            </TouchableOpacity>
                            {watchEntry && (
                                <TouchableOpacity
                                    accessibilityRole="button"
                                    onPress={handleEditPress}
                                    disabled={isLoadingWatchlist}
                                    style={[
                                        styles.actionButton,
                                        styles.ratingButton,
                                        isLoadingWatchlist &&
                                            styles.actionButtonDisabled,
                                    ]}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.actionButtonText}>
                                        {t("details.editWatchlist")}
                                    </Text>
                                </TouchableOpacity>
                            )}
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
                    {watchEntry && watchEntry.rating !== null && (
                        <View style={styles.section}>
                            <Text style={styles.sectionHeading}>
                                {t("details.ratingHeading")}
                            </Text>
                            <StarRatingComponent
                                rating={watchEntry.rating}
                                onRatingChange={() => {}}
                                maxStars={10}
                                size={20}
                                disabled
                            />
                            <Text style={styles.ratingReadOnlyText}>
                                {watchEntry.rating}/10
                            </Text>
                        </View>
                    )}
                    <View style={styles.section}>
                        <Text style={styles.sectionHeading}>
                            {t("details.descriptionHeading")}
                        </Text>
                        <Text style={styles.sectionBody}>
                            {data.description ?? t("home.emptyDescription")}
                        </Text>
                    </View>
                </ScrollView>
                {watchEntry && (
                    <EditWatchlistEntryModal
                        visible={showEditModal}
                        entry={watchEntry}
                        onClose={handleCloseEditModal}
                    />
                )}
            </>
        );
    })();

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ title: t("details.title") }} />
            <View style={styles.toolbar}>
                <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => {
                        if (
                            typeof router.canGoBack === "function" &&
                            router.canGoBack()
                        ) {
                            router.back();
                            return;
                        }
                        if (typeof router.replace === "function") {
                            type ReplaceArg = Parameters<
                                typeof router.replace
                            >[0];
                            const fallback = (lastTab ||
                                "/saved") as ReplaceArg;
                            router.replace(fallback);
                        } else {
                            router.back();
                        }
                    }}
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

const createStyles = (colors: ReturnType<typeof useTheme>) =>
    StyleSheet.create({
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
        badgeContainer: {
            flexDirection: "row",
            alignItems: "center",
            gap: scale(8),
        },
        badge: {
            backgroundColor: colors.accent,
            paddingHorizontal: scale(12),
            paddingVertical: verticalScale(4),
            borderRadius: moderateScale(999),
        },
        badgeText: {
            color: colors.accentOnAccent,
            fontSize: fontSizes.xs,
            fontWeight: fontWeights.semiBold,
        },
        statusBadge: {
            backgroundColor: colors.surface,
            paddingHorizontal: scale(12),
            paddingVertical: verticalScale(4),
            borderRadius: moderateScale(999),
            borderWidth: 1,
            borderColor: colors.border,
        },
        statusBadgeText: {
            color: colors.textPrimary,
            fontSize: fontSizes.xs,
            fontWeight: fontWeights.semiBold,
        },
        actionsContainer: {
            flexDirection: "row",
            gap: scale(12),
            marginBottom: verticalScale(8),
        },
        actionButton: {
            flex: 1,
            paddingVertical: verticalScale(12),
            paddingHorizontal: scale(16),
            borderRadius: moderateScale(10),
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
        },
        actionButtonActive: {
            backgroundColor: colors.accent,
            borderColor: colors.accent,
        },
        actionButtonDisabled: {
            opacity: 0.6,
        },
        actionButtonText: {
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.semiBold,
            color: colors.textPrimary,
        },
        actionButtonTextActive: {
            color: colors.accentOnAccent,
        },
        ratingButton: {
            flex: 0,
            paddingHorizontal: scale(12),
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
            paddingBottom: verticalScale(12),
        },
        sectionBody: {
            fontSize: fontSizes.md,
            color: colors.textSecondary,
            lineHeight: verticalScale(20),
        },
        ratingReadOnlyText: {
            marginTop: verticalScale(8),
            fontSize: fontSizes.md,
            color: colors.textSecondary,
            textAlign: "center",
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
