export const en = {
    common: {
        appName: "Entertainment Tracker",
        pullToRetry: "Pull to retry.",
        notAvailable: "N/A",
        cancel: "Cancel",
    },
    home: {
        title: "Entertainment Tracker",
        subtitle:
            "Browse your watchlist powered by Expo Router & TanStack Query.",
        searchPlaceholder: "Search OMDb (e.g. Spirited Away)",
        searchAction: "Search",
        startTyping: "Start typing to search OMDb titles.",
        loading: "Loading media…",
        errorHeading: "Unable to load media.",
        emptyDescription: "No description provided.",
        emptyList: "No media found.",
        mediaMeta:
            "Source: {{source}} • Released: {{release}} • Updated: {{updated}}",
    },
    details: {
        title: "Media Details",
        back: "Back",
        loading: "Loading media item…",
        errorHeading: "Unable to load media item.",
        missingId: "Missing media identifier.",
        notFound: "We couldn't find this media item.",
        retry: "Try again",
        metadata:
            "Source: {{source}} • Type: {{mediaType}} • Seasons: {{seasons}} • Episodes: {{episodes}}",
        releaseDate: "Release date: {{value}}",
        updatedAt: "Last updated: {{value}}",
        descriptionHeading: "Overview",
        posterFallback: "Poster not available.",
        addToWatchlist: "Save",
        removeFromWatchlist: "Remove",
        addRating: "Rate",
        ratingWithValue: "Rating: {{rating}}/10",
        ratingModalTitle: "Rate this title",
        ratingPlaceholder: "1-10",
        ratingHint: "Enter a rating from 1 to 10",
        saveRating: "Save Rating",
        removeRating: "Remove Rating",
    },
    saved: {
        title: "Saved",
        subtitle: "Your saved watchlist items.",
        loading: "Loading watchlist…",
        errorHeading: "Unable to load watchlist.",
        emptyList: "No saved items yet.",
        meta: "Status: {{status}} • Rating: {{rating}}",
    },
};

export type AppTranslationContent = typeof en;
