import { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useInfiniteQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";

import { fetchMedia, type MediaItem, type MediaList } from "../lib/media";

const PAGE_SIZE = 15;

export default function HomeScreen() {
    const [search, setSearch] = useState("chainsaw man");
    const [submittedSearch, setSubmittedSearch] = useState("chainsaw man");

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

    const handleSubmit = useCallback(() => {
        const trimmed = search.trim();
        if (trimmed) {
            setSubmittedSearch(trimmed);
        }
    }, [search]);

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
    const showEmptyState =
        !isLoading && !isFetchingNextPage && items.length === 0;

    return (
        <SafeAreaView style={styles.container}>
            <Text style={styles.title}>Entertainment Tracker</Text>
            <Text style={styles.subtitle}>
                Browse your watchlist powered by Expo Router & TanStack Query.
            </Text>

            <View style={styles.searchBar}>
                <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search OMDb (e.g. Spirited Away)"
                    returnKeyType="search"
                    onSubmitEditing={handleSubmit}
                    style={styles.searchInput}
                    autoCapitalize="none"
                />
                <TouchableOpacity
                    onPress={handleSubmit}
                    style={styles.searchButton}
                    activeOpacity={0.8}
                >
                    <Text style={styles.searchButtonText}>Search</Text>
                </TouchableOpacity>
            </View>

            {trimmedSubmitted.length === 0 ? (
                <View style={styles.centerContent}>
                    <Text style={styles.statusText}>
                        Start typing to search OMDb titles.
                    </Text>
                </View>
            ) : isLoading ? (
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" />
                    <Text style={styles.statusText}>Loading media…</Text>
                </View>
            ) : isError ? (
                <View style={styles.centerContent}>
                    <Text style={styles.errorText}>Unable to load media.</Text>
                    <Text style={styles.errorDetails}>{error.message}</Text>
                    <Text style={styles.hint}>Pull to retry.</Text>
                </View>
            ) : (
                <FlatList
                    testID="media-list"
                    data={items}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    keyboardShouldPersistTaps="handled"
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={handleRefresh}
                        />
                    }
                    ItemSeparatorComponent={() => (
                        <View style={styles.separator} />
                    )}
                    renderItem={({ item }) => <MediaCard item={item} />}
                    ListEmptyComponent={
                        showEmptyState ? (
                            <View style={styles.centerContent}>
                                <Text style={styles.statusText}>
                                    No media found.
                                </Text>
                            </View>
                        ) : null
                    }
                    ListFooterComponent={
                        isFetchingNextPage ? (
                            <View style={styles.footer}>
                                <ActivityIndicator />
                            </View>
                        ) : null
                    }
                    onEndReached={handleEndReached}
                    onEndReachedThreshold={0.5}
                />
            )}
        </SafeAreaView>
    );
}

function MediaCard({ item }: { item: MediaItem }) {
    const releaseLabel = formatDate(item.releaseDate);
    const updatedLabel = formatDate(item.updatedAt);

    return (
        <View style={styles.card}>
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
                    No description provided.
                </Text>
            )}
            <Text style={styles.cardMeta}>
                Source: {item.source} • Released: {releaseLabel} • Updated:{" "}
                {updatedLabel}
            </Text>
        </View>
    );
}

function formatDate(value?: string | null): string {
    if (!value) {
        return "N/A";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "N/A";
    }

    return date.toLocaleDateString();
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 24,
        backgroundColor: "#fff",
    },
    title: {
        fontSize: 24,
        fontWeight: "600",
        textAlign: "center",
    },
    subtitle: {
        textAlign: "center",
        marginTop: 8,
        marginBottom: 16,
        color: "#374151",
    },
    centerContent: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    statusText: {
        color: "#4b5563",
        textAlign: "center",
    },
    errorText: {
        fontSize: 18,
        fontWeight: "600",
        color: "#dc2626",
        textAlign: "center",
    },
    errorDetails: {
        textAlign: "center",
        color: "#b91c1c",
    },
    hint: {
        marginTop: 8,
        color: "#4b5563",
    },
    searchBar: {
        flexDirection: "row",
        gap: 12,
        alignItems: "center",
        marginBottom: 16,
    },
    searchInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: "#d1d5db",
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
        backgroundColor: "#f8fafc",
    },
    searchButton: {
        backgroundColor: "#2563eb",
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
    },
    searchButtonText: {
        color: "#fff",
        fontWeight: "600",
    },
    listContent: {
        paddingBottom: 24,
    },
    separator: {
        height: 16,
    },
    card: {
        backgroundColor: "#f8fafc",
        borderRadius: 12,
        padding: 16,
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
        fontSize: 18,
        fontWeight: "600",
        flex: 1,
        marginRight: 12,
    },
    badge: {
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 999,
        backgroundColor: "#2563eb",
        color: "#fff",
        fontSize: 12,
        fontWeight: "600",
    },
    cardDescription: {
        color: "#1f2937",
        marginBottom: 8,
    },
    cardDescriptionMuted: {
        color: "#9ca3af",
        fontStyle: "italic",
        marginBottom: 8,
    },
    cardMeta: {
        fontSize: 12,
        color: "#6b7280",
    },
    footer: {
        paddingVertical: 16,
        alignItems: "center",
        justifyContent: "center",
    },
});
