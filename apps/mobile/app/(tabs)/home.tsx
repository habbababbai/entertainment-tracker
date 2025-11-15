import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Keyboard,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import { useInfiniteQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { moderateScale, scale, verticalScale } from "react-native-size-matters";
import { useRouter } from "expo-router";

import { fetchMedia, type MediaItem, type MediaList } from "../../lib/media";
import { useHomeStore } from "../../lib/store";
import SearchBar from "../../components/SearchBar";
import "../../lib/i18n";
import { useTheme } from "../../lib/theme";
import { fontSizes, fontWeights } from "../../lib/theme/fonts";

const PAGE_SIZE = 15;

export default function HomeScreen() {
    const {
        submittedSearch,
        scrollOffset,
        setSubmittedSearch,
        setScrollOffset,
    } = useHomeStore();
    const [search, setSearch] = useState(submittedSearch);
    const [hasRestoredScroll, setHasRestoredScroll] = useState(false);
    const flatListRef = useRef<FlatList<MediaItem>>(null);
    const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { t } = useTranslation();
    const colors = useTheme();
    const styles = createStyles(colors);

    useEffect(() => {
        const trimmedSearch = search.trim();
        const trimmedSubmitted = submittedSearch.trim();
        
        if (trimmedSearch === trimmedSubmitted) {
            return;
        }

        if (trimmedSearch && trimmedSearch !== trimmedSubmitted) {
            setScrollOffset(0);
            flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
            setSubmittedSearch(trimmedSearch);
        } else if (!trimmedSearch && trimmedSubmitted) {
            setScrollOffset(0);
            flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
            setSubmittedSearch("");
        }
    }, [search, setScrollOffset, setSubmittedSearch]);

    const {
        data,
        isLoading,
        isError,
        error,
        refetch,
        isRefetching,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useInfiniteQuery<MediaList, Error>({
        queryKey: ["media", submittedSearch],
        initialPageParam: 1,
        queryFn: ({ pageParam }) =>
            fetchMedia({
                query: submittedSearch,
                limit: PAGE_SIZE,
                page:
                    typeof pageParam === "number"
                        ? pageParam
                        : Number(pageParam ?? 1) || 1,
            }),
        getNextPageParam: (lastPage) =>
            lastPage.hasMore ? lastPage.nextPage ?? undefined : undefined,
        staleTime: 1000 * 60,
        enabled: submittedSearch.trim().length > 0,
    });

    const items = useMemo(
        () => data?.pages.flatMap((page) => page.items) ?? [],
        [data]
    );

    const handleScroll = useCallback(
        (event: { nativeEvent: { contentOffset: { y: number } } }) => {
            const offset = event.nativeEvent.contentOffset.y;
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
            scrollTimeoutRef.current = setTimeout(() => {
                setScrollOffset(offset);
            }, 300);
        },
        [setScrollOffset]
    );

    useEffect(() => {
        if (
            !hasRestoredScroll &&
            scrollOffset > 0 &&
            items.length > 0 &&
            flatListRef.current
        ) {
            const timer = setTimeout(() => {
                flatListRef.current?.scrollToOffset({
                    offset: scrollOffset,
                    animated: false,
                });
                setHasRestoredScroll(true);
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [scrollOffset, items.length, hasRestoredScroll]);

    useEffect(() => {
        setHasRestoredScroll(false);
    }, [submittedSearch]);

    useEffect(() => {
        return () => {
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
        };
    }, []);

    const handleSubmit = useCallback(() => {
        const trimmed = search.trim();
        if (trimmed && trimmed !== submittedSearch) {
            setScrollOffset(0);
            flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
            setSubmittedSearch(trimmed);
        }
    }, [search, submittedSearch, setScrollOffset, setSubmittedSearch]);

    const handleRefresh = useCallback(() => {
        if (submittedSearch.trim().length > 0) {
            void refetch();
        }
    }, [refetch, submittedSearch]);

    const handleEndReached = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) {
            void fetchNextPage();
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    const isRefreshing = isRefetching && !isFetchingNextPage;
    const trimmedSubmitted = submittedSearch.trim();
    const showSearchPrompt = trimmedSubmitted.length === 0;
    const showEmptyState =
        !isLoading && !isFetchingNextPage && items.length === 0;

    const listEmptyComponent = useMemo(() => {
        if (isLoading) {
            return (
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" />
                    <Text style={styles.statusText}>{t("home.loading")}</Text>
                </View>
            );
        }

        if (isError) {
            return (
                <View style={styles.centerContent}>
                    <Text style={styles.errorText}>
                        {t("home.errorHeading")}
                    </Text>
                    {error?.message ? (
                        <Text
                            style={styles.errorDetails}
                            testID="media-error-details"
                        >
                            {error.message}
                        </Text>
                    ) : null}
                    <Text style={styles.hint}>{t("common.pullToRetry")}</Text>
                </View>
            );
        }

        if (showSearchPrompt) {
            return (
                <View style={styles.centerContent}>
                    <Text style={styles.statusText}>
                        {t("home.startTyping")}
                    </Text>
                </View>
            );
        }

        if (showEmptyState) {
            return (
                <View style={styles.centerContent}>
                    <Text style={styles.statusText}>{t("home.emptyList")}</Text>
                </View>
            );
        }

        return null;
    }, [
        error?.message,
        isError,
        isLoading,
        showEmptyState,
        showSearchPrompt,
        t,
    ]);

    const listContentStyle = useMemo(
        () => [
            styles.listContent,
            (isError || showEmptyState || showSearchPrompt || isLoading) &&
                styles.listContentCentered,
        ],
        [isError, isLoading, showEmptyState, showSearchPrompt]
    );

    return (
        <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.wrapper}>
                    <Text style={styles.title}>{t("home.title")}</Text>
                    <Text style={styles.subtitle}>{t("home.subtitle")}</Text>

                    <SearchBar
                        value={search}
                        onChangeText={setSearch}
                        onSubmit={handleSubmit}
                        placeholder={t("home.searchPlaceholder")}
                    />

                    <FlatList
                        ref={flatListRef}
                        testID="media-list"
                        data={items}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={listContentStyle}
                        contentInsetAdjustmentBehavior="never"
                        keyboardShouldPersistTaps="handled"
                        refreshControl={
                            <RefreshControl
                                enabled={!showSearchPrompt}
                                refreshing={isRefreshing}
                                onRefresh={handleRefresh}
                            />
                        }
                        ItemSeparatorComponent={() => (
                            <View style={styles.separator} />
                        )}
                        renderItem={({ item }) => <MediaCard item={item} />}
                        ListEmptyComponent={listEmptyComponent}
                        ListFooterComponent={
                            isFetchingNextPage && !isError ? (
                                <View
                                    style={styles.footer}
                                    testID="media-list-footer"
                                >
                                    <ActivityIndicator />
                                </View>
                            ) : null
                        }
                        onEndReached={handleEndReached}
                        onEndReachedThreshold={0.5}
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                    />
                </View>
            </TouchableWithoutFeedback>
        </SafeAreaView>
    );
}

function MediaCard({ item }: { item: MediaItem }) {
    const { t } = useTranslation();
    const router = useRouter();
    const colors = useTheme();
    const styles = createStyles(colors);
    const fallbackLabel = t("common.notAvailable");
    const releaseLabel = formatDate(item.releaseDate, fallbackLabel);
    const updatedLabel = formatDate(item.updatedAt, fallbackLabel);
    const handlePress = useCallback(() => {
        router.push({
            pathname: "/media/[id]",
            params: { id: item.id },
        });
    }, [item.id, router]);

    return (
        <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.85}
            onPress={handlePress}
            style={styles.card}
            testID={`media-card-${item.id}`}
        >
            <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.badge}>{item.mediaType}</Text>
            </View>
            {item.description ? (
                <Text numberOfLines={3} style={styles.cardDescription}>
                    {item.description}
                </Text>
            ) : (
                <Text style={styles.cardDescriptionMuted}>
                    {t("home.emptyDescription")}
                </Text>
            )}
            <Text style={styles.cardMeta}>
                {t("home.mediaMeta", {
                    source: item.source,
                    release: releaseLabel,
                    updated: updatedLabel,
                })}
            </Text>
        </TouchableOpacity>
    );
}

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
        },
        cardTitle: {
            fontSize: fontSizes.lg,
            fontWeight: fontWeights.semiBold,
            flex: 1,
            marginRight: scale(12),
            color: colors.textPrimary,
        },
        badge: {
            paddingVertical: verticalScale(4),
            paddingHorizontal: scale(8),
            borderRadius: moderateScale(999),
            backgroundColor: colors.accent,
            color: colors.accentOnAccent,
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
            fontSize: fontSizes.xs,
            color: colors.textMuted,
        },
        footer: {
            paddingVertical: verticalScale(16),
            alignItems: "center",
            justifyContent: "center",
        },
    });
