import { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
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
    updateWatchlistEntry,
    type WatchEntry,
} from "../../lib/watchlist";
import { useAuthStore } from "../../lib/store/auth";
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
    const queryClient = useQueryClient();
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

    const [showRatingModal, setShowRatingModal] = useState(false);
    const [ratingInput, setRatingInput] = useState("");

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

    const { data: watchEntry } = useQuery<WatchEntry | null, Error>({
        queryKey: ["watchlist-entry", trimmedId],
        queryFn: async (): Promise<WatchEntry | null> => {
            if (!isAuthenticated || !trimmedId) {
                return null;
            }
            try {
                const entry = await fetchWatchlistEntry(trimmedId);
                return entry || null;
            } catch {
                return null;
            }
        },
        enabled: isAuthenticated && trimmedId.length > 0,
        retry: false,
        placeholderData: null,
    });

    const addToWatchlistMutation = useMutation({
        mutationFn: () => addToWatchlist({ mediaItemId: trimmedId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["watchlist-entry", trimmedId] });
            queryClient.invalidateQueries({ queryKey: ["watchlist"] });
        },
    });

    const removeFromWatchlistMutation = useMutation({
        mutationFn: () => removeFromWatchlist(trimmedId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["watchlist-entry", trimmedId] });
            queryClient.invalidateQueries({ queryKey: ["watchlist"] });
        },
    });

    const updateRatingMutation = useMutation({
        mutationFn: (rating: number | null) =>
            updateWatchlistEntry(trimmedId, { rating }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["watchlist-entry", trimmedId] });
            queryClient.invalidateQueries({ queryKey: ["watchlist"] });
            setShowRatingModal(false);
            setRatingInput("");
        },
    });

    const handleSaveToggle = useCallback(() => {
        if (watchEntry) {
            removeFromWatchlistMutation.mutate();
        } else {
            addToWatchlistMutation.mutate();
        }
    }, [watchEntry, addToWatchlistMutation, removeFromWatchlistMutation]);

    const handleRatingPress = useCallback(() => {
        if (watchEntry?.rating) {
            setRatingInput(String(watchEntry.rating));
        } else {
            setRatingInput("");
        }
        setShowRatingModal(true);
    }, [watchEntry]);

    const handleRatingSubmit = useCallback(() => {
        const rating = parseInt(ratingInput.trim(), 10);
        if (isNaN(rating) || rating < 1 || rating > 10) {
            return;
        }
        updateRatingMutation.mutate(rating);
    }, [ratingInput, updateRatingMutation]);

    const handleRatingRemove = useCallback(() => {
        updateRatingMutation.mutate(null, {
            onSuccess: () => {
                setShowRatingModal(false);
                setRatingInput("");
            },
        });
    }, [updateRatingMutation]);

    const isLoadingWatchlist =
        addToWatchlistMutation.isPending ||
        removeFromWatchlistMutation.isPending ||
        updateRatingMutation.isPending;

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
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{data.mediaType}</Text>
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
                                disabled={isLoadingWatchlist || !trimmedId}
                                style={[
                                    styles.actionButton,
                                    watchEntry && styles.actionButtonActive,
                                    isLoadingWatchlist && styles.actionButtonDisabled,
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
                                            watchEntry && styles.actionButtonTextActive,
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
                                    onPress={handleRatingPress}
                                    disabled={isLoadingWatchlist}
                                    style={[
                                        styles.actionButton,
                                        styles.ratingButton,
                                        isLoadingWatchlist && styles.actionButtonDisabled,
                                    ]}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.actionButtonText}>
                                        {watchEntry.rating
                                            ? t("details.ratingWithValue", {
                                                  rating: watchEntry.rating,
                                              })
                                            : t("details.addRating")}
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
                    <View style={styles.section}>
                        <Text style={styles.sectionHeading}>
                            {t("details.descriptionHeading")}
                        </Text>
                        <Text style={styles.sectionBody}>
                            {data.description ?? t("home.emptyDescription")}
                        </Text>
                    </View>
                </ScrollView>
                <Modal
                    visible={showRatingModal}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setShowRatingModal(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>
                                {t("details.ratingModalTitle")}
                            </Text>
                            <TextInput
                                value={ratingInput}
                                onChangeText={setRatingInput}
                                placeholder={t("details.ratingPlaceholder")}
                                keyboardType="numeric"
                                maxLength={2}
                                style={styles.ratingInput}
                                autoFocus
                            />
                            <Text style={styles.ratingHint}>
                                {t("details.ratingHint")}
                            </Text>
                            <View style={styles.modalButtons}>
                                {watchEntry?.rating && (
                                    <TouchableOpacity
                                        onPress={handleRatingRemove}
                                        disabled={updateRatingMutation.isPending}
                                        style={[
                                            styles.modalButton,
                                            styles.modalButtonRemove,
                                        ]}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.modalButtonRemoveText}>
                                            {t("details.removeRating")}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    onPress={handleRatingSubmit}
                                    disabled={
                                        updateRatingMutation.isPending ||
                                        !ratingInput.trim()
                                    }
                                    style={[
                                        styles.modalButton,
                                        styles.modalButtonPrimary,
                                        (!ratingInput.trim() ||
                                            updateRatingMutation.isPending) &&
                                            styles.modalButtonDisabled,
                                    ]}
                                    activeOpacity={0.8}
                                >
                                    {updateRatingMutation.isPending ? (
                                        <ActivityIndicator
                                            size="small"
                                            color={colors.accentOnAccent}
                                        />
                                    ) : (
                                        <Text style={styles.modalButtonPrimaryText}>
                                            {t("details.saveRating")}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => {
                                        setShowRatingModal(false);
                                        setRatingInput("");
                                    }}
                                    disabled={updateRatingMutation.isPending}
                                    style={[
                                        styles.modalButton,
                                        styles.modalButtonCancel,
                                    ]}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.modalButtonCancelText}>
                                        {t("common.cancel")}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </>
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
        paddingHorizontal: scale(12),
        paddingVertical: verticalScale(4),
        borderRadius: moderateScale(999),
    },
    badgeText: {
        color: colors.accentOnAccent,
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
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: scale(20),
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderRadius: moderateScale(16),
        padding: scale(24),
        width: "100%",
        maxWidth: scale(400),
        gap: verticalScale(16),
    },
    modalTitle: {
        fontSize: fontSizes.lg,
        fontWeight: fontWeights.semiBold,
        color: colors.textPrimary,
        textAlign: "center",
    },
    ratingInput: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: moderateScale(10),
        paddingHorizontal: scale(16),
        paddingVertical: verticalScale(12),
        fontSize: fontSizes.md,
        backgroundColor: colors.background,
        color: colors.textPrimary,
        textAlign: "center",
    },
    ratingHint: {
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
        textAlign: "center",
    },
    modalButtons: {
        gap: verticalScale(8),
    },
    modalButton: {
        paddingVertical: verticalScale(12),
        paddingHorizontal: scale(16),
        borderRadius: moderateScale(10),
        alignItems: "center",
        justifyContent: "center",
    },
    modalButtonPrimary: {
        backgroundColor: colors.accent,
    },
    modalButtonPrimaryText: {
        color: colors.accentOnAccent,
        fontSize: fontSizes.md,
        fontWeight: fontWeights.semiBold,
    },
    modalButtonRemove: {
        backgroundColor: colors.error,
    },
    modalButtonRemoveText: {
        color: colors.accentOnAccent,
        fontSize: fontSizes.md,
        fontWeight: fontWeights.semiBold,
    },
    modalButtonCancel: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalButtonCancelText: {
        color: colors.textPrimary,
        fontSize: fontSizes.md,
        fontWeight: fontWeights.medium,
    },
    modalButtonDisabled: {
        opacity: 0.6,
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
