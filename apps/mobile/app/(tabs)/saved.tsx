import { useCallback, useMemo } from "react";
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { moderateScale, scale, verticalScale } from "react-native-size-matters";
import { useRouter } from "expo-router";

import LoginScreen from "../../components/LoginScreen";
import { fetchWatchlist, type WatchEntry } from "../../lib/watchlist";
import { useAuthStore } from "../../lib/store/auth";
import "../../lib/i18n";
import { colors } from "../../lib/theme/colors";
import { fontSizes, fontWeights } from "../../lib/theme/fonts";

export default function SavedTab() {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

    if (!isAuthenticated) {
        return <LoginScreen />;
    }

    return <SavedScreen />;
}

function SavedScreen() {
    const { t } = useTranslation();
    const router = useRouter();

    const {
        data,
        isLoading,
        isError,
        error,
        refetch,
        isRefetching,
    } = useQuery({
        queryKey: ["watchlist"],
        queryFn: fetchWatchlist,
        staleTime: 1000 * 60,
    });

    const items = data?.items ?? [];
    const showEmptyState = !isLoading && !isError && items.length === 0;

    const handleRefresh = useCallback(() => {
        void refetch();
    }, [refetch]);

    const listEmptyComponent = useMemo(() => {
        if (isLoading) {
            return (
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" />
                    <Text style={styles.statusText}>
                        {t("saved.loading")}
                    </Text>
                </View>
            );
        }

        if (isError) {
            return (
                <View style={styles.centerContent}>
                    <Text style={styles.errorText}>
                        {t("saved.errorHeading")}
                    </Text>
                    {error?.message ? (
                        <Text
                            style={styles.errorDetails}
                            testID="watchlist-error-details"
                        >
                            {error.message}
                        </Text>
                    ) : null}
                    <Text style={styles.hint}>
                        {t("common.pullToRetry")}
                    </Text>
                </View>
            );
        }

        if (showEmptyState) {
            return (
                <View style={styles.centerContent}>
                    <Text style={styles.statusText}>
                        {t("saved.emptyList")}
                    </Text>
                </View>
            );
        }

        return null;
    }, [
        error?.message,
        isError,
        isLoading,
        showEmptyState,
        t,
    ]);

    const listContentStyle = useMemo(
        () => [
            styles.listContent,
            (isError || showEmptyState || isLoading) &&
                styles.listContentCentered,
        ],
        [isError, isLoading, showEmptyState]
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.wrapper}>
                <Text style={styles.title}>{t("saved.title")}</Text>
                <Text style={styles.subtitle}>{t("saved.subtitle")}</Text>

                <FlatList
                    testID="watchlist-list"
                    data={items}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={listContentStyle}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefetching}
                            onRefresh={handleRefresh}
                        />
                    }
                    ItemSeparatorComponent={() => (
                        <View style={styles.separator} />
                    )}
                    renderItem={({ item }) => (
                        <WatchlistCard item={item} />
                    )}
                    ListEmptyComponent={listEmptyComponent}
                />
            </View>
        </SafeAreaView>
    );
}

function WatchlistCard({ item }: { item: WatchEntry }) {
    const { t } = useTranslation();
    const router = useRouter();

    const handlePress = useCallback(() => {
        router.push({
            pathname: "/media/[id]",
            params: { id: item.mediaItem.id },
        });
    }, [item.mediaItem.id, router]);

    const statusLabel = item.status;
    const ratingLabel = item.rating
        ? `${item.rating}/10`
        : t("common.notAvailable");

    return (
        <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.85}
            onPress={handlePress}
            style={styles.card}
            testID={`watchlist-card-${item.id}`}
        >
            <View style={styles.cardHeader}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.mediaItem.title}
                </Text>
                <View style={styles.badgeContainer}>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.mediaItem.mediaType}</Text>
                    </View>
                    <View style={styles.statusBadge}>
                        <Text style={styles.statusBadgeText}>{statusLabel}</Text>
                    </View>
                </View>
            </View>
            {item.mediaItem.description ? (
                <Text numberOfLines={2} style={styles.cardDescription}>
                    {item.mediaItem.description}
                </Text>
            ) : (
                <Text style={styles.cardDescriptionMuted}>
                    {t("home.emptyDescription")}
                </Text>
            )}
            <View style={styles.cardMeta}>
                <Text style={styles.cardMetaText}>
                    {t("saved.meta", {
                        status: statusLabel,
                        rating: ratingLabel,
                    })}
                </Text>
                {item.notes && (
                    <Text numberOfLines={1} style={styles.cardNotes}>
                        {item.notes}
                    </Text>
                )}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    wrapper: {
        flex: 1,
        paddingHorizontal: scale(24),
        paddingVertical: verticalScale(24),
    },
    title: {
        fontSize: fontSizes.xl,
        fontWeight: fontWeights.semiBold,
        textAlign: "center",
        color: colors.textPrimary,
    },
    subtitle: {
        textAlign: "center",
        marginTop: verticalScale(8),
        marginBottom: verticalScale(16),
        color: colors.textSecondary,
        fontSize: fontSizes.md,
    },
    centerContent: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: verticalScale(8),
    },
    statusText: {
        color: colors.textSecondary,
        textAlign: "center",
        fontSize: fontSizes.sm,
    },
    errorText: {
        fontSize: fontSizes.lg,
        fontWeight: fontWeights.semiBold,
        color: colors.error,
        textAlign: "center",
    },
    errorDetails: {
        textAlign: "center",
        color: colors.errorMuted,
        fontSize: fontSizes.sm,
    },
    hint: {
        marginTop: verticalScale(8),
        color: colors.textSecondary,
        fontSize: fontSizes.sm,
    },
    listContent: {
        paddingBottom: verticalScale(24),
    },
    listContentCentered: {
        flexGrow: 1,
        justifyContent: "center",
    },
    separator: {
        height: verticalScale(16),
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: moderateScale(12),
        padding: scale(16),
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8,
        gap: scale(8),
    },
    cardTitle: {
        fontSize: fontSizes.lg,
        fontWeight: fontWeights.semiBold,
        flex: 1,
        color: colors.textPrimary,
    },
    badgeContainer: {
        flexDirection: "row",
        gap: scale(8),
        alignItems: "center",
    },
    badge: {
        paddingVertical: verticalScale(4),
        paddingHorizontal: scale(8),
        borderRadius: moderateScale(999),
        backgroundColor: colors.accent,
    },
    badgeText: {
        color: colors.accentOnAccent,
        fontSize: fontSizes.xs,
        fontWeight: fontWeights.semiBold,
    },
    statusBadge: {
        paddingVertical: verticalScale(4),
        paddingHorizontal: scale(8),
        borderRadius: moderateScale(999),
        backgroundColor: colors.border,
    },
    statusBadgeText: {
        color: colors.textPrimary,
        fontSize: fontSizes.xs,
        fontWeight: fontWeights.semiBold,
    },
    cardDescription: {
        color: colors.textPrimary,
        marginBottom: verticalScale(8),
        fontSize: fontSizes.md,
    },
    cardDescriptionMuted: {
        color: colors.textMuted,
        fontStyle: "italic",
        marginBottom: verticalScale(8),
        fontSize: fontSizes.md,
    },
    cardMeta: {
        gap: verticalScale(4),
    },
    cardMetaText: {
        fontSize: fontSizes.xs,
        color: colors.textMuted,
    },
    cardNotes: {
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
        fontStyle: "italic",
    },
});

