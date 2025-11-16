import { useState, useEffect } from "react";
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
} from "react-native";
import { useTranslation } from "react-i18next";
import { moderateScale, scale, verticalScale } from "react-native-size-matters";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import StarRatingComponent from "./StarRating";
import {
    updateWatchlistEntry,
    type WatchEntry,
    type WatchStatus,
} from "../lib/watchlist";
import { useTheme } from "../lib/theme";
import { fontSizes, fontWeights } from "../lib/theme/fonts";

interface EditWatchlistEntryModalProps {
    visible: boolean;
    entry: WatchEntry | null;
    onClose: () => void;
}

export default function EditWatchlistEntryModal({
    visible,
    entry,
    onClose,
}: EditWatchlistEntryModalProps) {
    const { t } = useTranslation();
    const colors = useTheme();
    const styles = createStyles(colors);
    const queryClient = useQueryClient();

    const [status, setStatus] = useState<WatchStatus>("PLANNED");
    const [rating, setRating] = useState<number | null>(null);

    useEffect(() => {
        if (entry) {
            setStatus(entry.status as WatchStatus);
            setRating(entry.rating);
        }
    }, [entry]);

    const mutation = useMutation({
        mutationFn: async ({
            mediaItemId,
            updates,
        }: {
            mediaItemId: string;
            updates: { status?: WatchStatus; rating?: number | null };
        }) => {
            return updateWatchlistEntry(mediaItemId, updates);
        },
        onSuccess: (updated) => {
            queryClient.setQueryData(
                ["watchlist-entry", updated.mediaItem.externalId],
                updated
            );
            void queryClient.invalidateQueries({ queryKey: ["watchlist"] });
            onClose();
        },
    });

    const handleSave = () => {
        if (!entry) return;

        mutation.mutate({
            mediaItemId: entry.mediaItem.externalId,
            updates: {
                status,
                rating,
            },
        });
    };

    const handleStatusChange = (newStatus: WatchStatus) => {
        setStatus(newStatus);
    };

    const statusOptions: WatchStatus[] = [
        "PLANNED",
        "WATCHING",
        "COMPLETED",
        "ON_HOLD",
        "DROPPED",
    ];

    if (!entry) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    <View style={styles.header}>
                        <Text style={styles.title}>
                            {entry.mediaItem.title}
                        </Text>
                        <TouchableOpacity
                            onPress={onClose}
                            style={styles.closeButton}
                        >
                            <Text style={styles.closeButtonText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        style={styles.content}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>
                                {t("saved.edit.status")}
                            </Text>
                            <View style={styles.statusContainer}>
                                {statusOptions.map((option) => (
                                    <TouchableOpacity
                                        key={option}
                                        style={[
                                            styles.statusButton,
                                            status === option &&
                                                styles.statusButtonActive,
                                        ]}
                                        onPress={() =>
                                            handleStatusChange(option)
                                        }
                                    >
                                        <Text
                                            style={[
                                                styles.statusButtonText,
                                                status === option &&
                                                    styles.statusButtonTextActive,
                                            ]}
                                        >
                                            {t(`status.${option}` as keyof typeof t)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>
                                {t("saved.edit.rating")}
                            </Text>
                            <View style={styles.ratingContainer}>
                                <StarRatingComponent
                                    rating={rating}
                                    onRatingChange={setRating}
                                    maxStars={10}
                                    size={20}
                                />
                            </View>
                            {rating !== null && (
                                <Text style={styles.ratingText}>
                                    {rating}/10
                                </Text>
                            )}
                        </View>
                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={onClose}
                            disabled={mutation.isPending}
                        >
                            <Text style={styles.cancelButtonText}>
                                {t("common.cancel")}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.saveButton,
                                mutation.isPending && styles.saveButtonDisabled,
                            ]}
                            onPress={handleSave}
                            disabled={mutation.isPending}
                        >
                            {mutation.isPending ? (
                                <ActivityIndicator
                                    color={colors.accentOnAccent}
                                />
                            ) : (
                                <Text style={styles.saveButtonText}>
                                    {t("common.save")}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const createStyles = (colors: ReturnType<typeof useTheme>) =>
    StyleSheet.create({
        overlay: {
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            justifyContent: "flex-end",
        },
        modalContainer: {
            backgroundColor: colors.surface,
            borderTopLeftRadius: moderateScale(20),
            borderTopRightRadius: moderateScale(20),
            maxHeight: "90%",
            paddingBottom: verticalScale(20),
        },
        header: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: scale(20),
            paddingTop: verticalScale(20),
            paddingBottom: verticalScale(16),
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        title: {
            flex: 1,
            fontSize: fontSizes.lg,
            fontWeight: fontWeights.semiBold,
            color: colors.textPrimary,
        },
        closeButton: {
            padding: scale(8),
            marginLeft: scale(16),
        },
        closeButtonText: {
            fontSize: fontSizes.xl,
            color: colors.textSecondary,
        },
        content: {
            paddingHorizontal: scale(20),
            paddingTop: verticalScale(20),
        },
        section: {
            marginBottom: verticalScale(24),
            alignItems: "flex-start",
        },
        sectionTitle: {
            fontSize: fontSizes.md,
            fontWeight: fontWeights.semiBold,
            color: colors.textPrimary,
            marginBottom: verticalScale(12),
        },
        statusContainer: {
            flexDirection: "row",
            flexWrap: "wrap",
            gap: scale(8),
        },
        statusButton: {
            paddingVertical: verticalScale(8),
            paddingHorizontal: scale(16),
            borderRadius: moderateScale(20),
            backgroundColor: colors.border,
            borderWidth: 1,
            borderColor: colors.border,
        },
        statusButtonActive: {
            backgroundColor: colors.accent,
            borderColor: colors.accent,
        },
        statusButtonText: {
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.medium,
            color: colors.textPrimary,
        },
        statusButtonTextActive: {
            color: colors.accentOnAccent,
        },
        ratingContainer: {
            width: "100%",
            alignItems: "center",
            overflow: "visible",
        },
        ratingText: {
            marginTop: verticalScale(8),
            fontSize: fontSizes.md,
            color: colors.textSecondary,
        },
        footer: {
            flexDirection: "row",
            paddingHorizontal: scale(20),
            paddingTop: verticalScale(16),
            gap: scale(12),
            borderTopWidth: 1,
            borderTopColor: colors.border,
        },
        cancelButton: {
            flex: 1,
            paddingVertical: verticalScale(12),
            borderRadius: moderateScale(8),
            backgroundColor: colors.border,
            alignItems: "center",
        },
        cancelButtonText: {
            fontSize: fontSizes.md,
            fontWeight: fontWeights.semiBold,
            color: colors.textPrimary,
        },
        saveButton: {
            flex: 1,
            paddingVertical: verticalScale(12),
            borderRadius: moderateScale(8),
            backgroundColor: colors.accent,
            alignItems: "center",
        },
        saveButtonDisabled: {
            opacity: 0.6,
        },
        saveButtonText: {
            fontSize: fontSizes.md,
            fontWeight: fontWeights.semiBold,
            color: colors.accentOnAccent,
        },
    });
