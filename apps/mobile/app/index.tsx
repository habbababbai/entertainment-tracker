import { useCallback } from "react";
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchMedia, MediaItem } from "../lib/media";

export default function HomeScreen() {
    const { data, isLoading, isRefetching, isError, refetch, error } = useQuery(
        {
            queryKey: ["media", { limit: 20 }],
            queryFn: () => fetchMedia(20),
            staleTime: 1000 * 60,
        }
    );

    const handleRefresh = useCallback(() => {
        void refetch();
    }, [refetch]);

    return (
        <SafeAreaView style={styles.container}>
            <Text style={styles.title}>Entertainment Tracker</Text>
            <Text style={styles.subtitle}>
                Browse your watchlist powered by Expo Router & TanStack Query.
            </Text>

            {isLoading ? (
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" />
                    <Text style={styles.statusText}>Loading media…</Text>
                </View>
            ) : isError ? (
                <View style={styles.centerContent}>
                    <Text style={styles.errorText}>Unable to load media.</Text>
                    <Text style={styles.errorDetails}>
                        {(error as Error).message}
                    </Text>
                    <Text style={styles.hint}>Pull to retry.</Text>
                </View>
            ) : (
                <FlatList
                    data={data ?? []}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefetching}
                            onRefresh={handleRefresh}
                        />
                    }
                    ItemSeparatorComponent={() => (
                        <View style={styles.separator} />
                    )}
                    renderItem={({ item }) => <MediaCard item={item} />}
                    ListEmptyComponent={() => (
                        <View style={styles.centerContent}>
                            <Text style={styles.statusText}>
                                No media found.
                            </Text>
                        </View>
                    )}
                />
            )}
        </SafeAreaView>
    );
}

function MediaCard({ item }: { item: MediaItem }) {
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
                Source: {item.source} • Updated{" "}
                {new Date(item.updatedAt).toLocaleDateString()}
            </Text>
        </View>
    );
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
});
