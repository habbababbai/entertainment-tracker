import { View, StyleSheet } from "react-native";
import StarRating from "react-native-star-rating-widget";
import { useTheme } from "../lib/theme";

interface StarRatingProps {
    rating: number | null;
    onRatingChange: (rating: number | null) => void;
    maxStars?: number;
    size?: number;
    disabled?: boolean;
}

export default function StarRatingComponent({
    rating,
    onRatingChange,
    maxStars = 10,
    size = 24,
    disabled = false,
}: StarRatingProps) {
    const colors = useTheme();
    const styles = createStyles();

    const handleRatingChange = (newRating: number) => {
        if (disabled) return;
        onRatingChange(rating === newRating ? null : newRating);
    };

    return (
        <View
            style={styles.container}
            pointerEvents={disabled ? "none" : "auto"}
        >
            <StarRating
                rating={rating ?? 0}
                onChange={handleRatingChange}
                maxStars={maxStars}
                starSize={size}
                color={colors.accent}
                emptyColor={colors.textMuted}
                enableHalfStar={false}
                enableSwiping={!disabled}
            />
        </View>
    );
}

const createStyles = () =>
    StyleSheet.create({
        container: {
            width: "100%",
            alignItems: "center",
        },
    });
