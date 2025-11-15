import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import StarRatingComponent from "../components/StarRating";

const mockOnChange = jest.fn();
const mockStarRating = jest.fn();

jest.mock("react-native-star-rating-widget", () => {
    const React = require("react");
    const { View, TouchableOpacity, Text } = require("react-native");

    return function StarRating({
        rating,
        onChange,
        maxStars,
    }: {
        rating: number;
        onChange: (rating: number) => void;
        maxStars: number;
    }) {
        mockStarRating({ rating, onChange, maxStars });
        return (
            <View testID="star-rating-widget">
                {Array.from({ length: maxStars }, (_, i) => {
                    const starValue = i + 1;
                    const isFilled = starValue <= rating;
                    return (
                        <TouchableOpacity
                            key={starValue}
                            testID={`star-${starValue}`}
                            onPress={() => onChange(starValue)}
                        >
                            <Text>{isFilled ? "★" : "☆"}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        );
    };
});

jest.mock("../lib/theme", () => ({
    useTheme: () => ({
        accent: "#007AFF",
        textMuted: "#8E8E93",
    }),
}));

describe("StarRatingComponent", () => {
    beforeEach(() => {
        mockOnChange.mockClear();
        mockStarRating.mockClear();
    });

    it("renders star rating widget", () => {
        const { getByTestId } = render(
            <StarRatingComponent
                rating={null}
                onRatingChange={mockOnChange}
                maxStars={10}
                size={24}
            />
        );

        expect(getByTestId("star-rating-widget")).toBeTruthy();
    });

    it("displays correct number of stars based on maxStars", () => {
        const { getAllByTestId } = render(
            <StarRatingComponent
                rating={0}
                onRatingChange={mockOnChange}
                maxStars={10}
            />
        );

        const stars = getAllByTestId(/^star-\d+$/);
        expect(stars).toHaveLength(10);
    });

    it("calls onRatingChange with new rating when star is pressed", () => {
        const { getByTestId } = render(
            <StarRatingComponent
                rating={null}
                onRatingChange={mockOnChange}
                maxStars={10}
            />
        );

        fireEvent.press(getByTestId("star-5"));

        expect(mockOnChange).toHaveBeenCalledWith(5);
    });

    it("removes rating when same star is pressed again", () => {
        const { getByTestId } = render(
            <StarRatingComponent
                rating={5}
                onRatingChange={mockOnChange}
                maxStars={10}
            />
        );

        fireEvent.press(getByTestId("star-5"));

        expect(mockOnChange).toHaveBeenCalledWith(null);
    });

    it("changes rating when different star is pressed", () => {
        const { getByTestId } = render(
            <StarRatingComponent
                rating={3}
                onRatingChange={mockOnChange}
                maxStars={10}
            />
        );

        fireEvent.press(getByTestId("star-7"));

        expect(mockOnChange).toHaveBeenCalledWith(7);
    });

    it("does not call onRatingChange when disabled", () => {
        const { getByTestId } = render(
            <StarRatingComponent
                rating={null}
                onRatingChange={mockOnChange}
                maxStars={10}
                disabled={true}
            />
        );

        fireEvent.press(getByTestId("star-5"));

        expect(mockOnChange).not.toHaveBeenCalled();
    });

    it("uses default maxStars of 10 when not specified", () => {
        const { getAllByTestId } = render(
            <StarRatingComponent
                rating={null}
                onRatingChange={mockOnChange}
            />
        );

        const stars = getAllByTestId(/^star-\d+$/);
        expect(stars).toHaveLength(10);
    });

    it("handles null rating as zero for display", () => {
        const { getByTestId } = render(
            <StarRatingComponent
                rating={null}
                onRatingChange={mockOnChange}
                maxStars={5}
            />
        );

        expect(getByTestId("star-rating-widget")).toBeTruthy();
    });
});

