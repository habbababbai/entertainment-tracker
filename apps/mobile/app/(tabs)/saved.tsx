import { useCallback, useMemo, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";

import LoginScreen from "../../components/LoginScreen";
import EditWatchlistEntryModal from "../../components/EditWatchlistEntryModal";
import { fetchWatchlist, type WatchEntry } from "../../lib/watchlist";
import { useAuthStore } from "../../lib/store/auth";
import "../../lib/i18n";
import { useTheme } from "../../lib/theme";
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
    const colors = useTheme();
    const styles = createStyles(colors);

    const { data, isLoading, isError, error, refetch, isRefetching } = useQuery(
        {
            queryKey: ["watchlist"],
            queryFn: fetchWatchlist,
            staleTime: 1000 * 60,
        }
    );

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
                    <Text style={styles.statusText}>{t("saved.loading")}</Text>
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
                    <Text style={styles.hint}>{t("common.pullToRetry")}</Text>
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
    }, [error?.message, isError, isLoading, showEmptyState, t]);

    const listContentStyle = useMemo(
        () => [
            styles.listContent,
            (isError || showEmptyState || isLoading) &&
                styles.listContentCentered,
            items.length > 0 && styles.listContentTop,
        ],
        [isError, isLoading, showEmptyState, items.length]
    );

    return (
        <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
            <View style={styles.wrapper}>
                <Text style={styles.title}>{t("saved.title")}</Text>
                <Text style={styles.subtitle}>{t("saved.subtitle")}</Text>

                <FlatList
                    testID="watchlist-list"
                    data={items}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={listContentStyle}
                    contentInsetAdjustmentBehavior="never"
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
    const colors = useTheme();
    const styles = createStyles(colors);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);

    const handlePress = useCallback(() => {
        router.push({
            pathname: "/media/[id]",
            params: { id: item.mediaItem.externalId },
        });
    }, [item.mediaItem.externalId, router]);

    const handleEditPress = useCallback(
        (e: { stopPropagation: () => void }) => {
            e.stopPropagation();
            setIsEditModalVisible(true);
        },
        []
    );

    const handleCloseModal = useCallback(() => {
        setIsEditModalVisible(false);
    }, []);

    const statusLabel = item.status;
    const ratingLabel = item.rating
        ? `${item.rating}/10`
        : t("common.notAvailable");

    return (
        <>
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
                    <View style={styles.cardHeaderRight}>
                        <View style={styles.badgeContainer}>
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>
                                    {item.mediaItem.mediaType}
                                </Text>
                            </View>
                            <View style={styles.statusBadge}>
                                <Text style={styles.statusBadgeText}>
                                    {statusLabel}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            onPress={handleEditPress}
                            style={styles.editButton}
                            testID={`watchlist-card-edit-${item.id}`}
                        >
                            <Ionicons
                                name="create-outline"
                                size={20}
                                color={colors.textSecondary}
                            />
                        </TouchableOpacity>
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
            <EditWatchlistEntryModal
                visible={isEditModalVisible}
                entry={item}
                onClose={handleCloseModal}
            />
        </>
    );
}

const createStyles = (colors: ReturnType<typeof useTheme>) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        wrapper: {
            flex: 1,
            paddingHorizontal: scale(12),
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
            paddingBottom: scale(16),
        },
        listContentTop: {
            flexGrow: 0,
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
        cardHeaderRight: {
            flexDirection: "row",
            alignItems: "center",
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
        editButton: {
            padding: scale(4),
            marginLeft: scale(4),
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
