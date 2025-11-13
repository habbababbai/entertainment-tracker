export const en = {
    common: {
        appName: "Entertainment Tracker",
        pullToRetry: "Pull to retry.",
        notAvailable: "N/A",
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
    },
};

export type AppTranslationContent = typeof en;
