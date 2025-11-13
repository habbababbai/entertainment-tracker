export const omdbSearchSuccessResponse = {
    Response: "True" as const,
    totalResults: "3",
    Search: [
        {
            Title: "Sample Movie",
            imdbID: "tt0000001",
            Type: "movie",
            Poster: "https://example.com/poster.jpg",
        },
        {
            Title: "Sample Series",
            imdbID: "tt0000002",
            Type: "series",
            Poster: "https://example.com/poster-series.jpg",
        },
    ],
};

export const omdbDetailMovieResponse = {
    Response: "True" as const,
    Title: "Sample Movie",
    imdbID: "tt0000001",
    Type: "movie",
    Plot: "An exciting plot.",
    Poster: "https://example.com/poster.jpg",
    Released: "2020-05-04",
    Genre: "Action",
    Country: "USA",
    totalSeasons: "N/A",
    totalEpisodes: "N/A",
};

export const omdbDetailSeriesResponse = {
    Response: "True" as const,
    Title: "Sample Series",
    imdbID: "tt0000002",
    Type: "series",
    Plot: "A thrilling series.",
    Poster: "https://example.com/poster-series.jpg",
    Released: "2019-01-10",
    Genre: "Animation",
    Country: "Japan",
    totalSeasons: "2",
    totalEpisodes: "24",
};

export const omdbSearchNotFoundResponse = {
    Response: "False" as const,
    Error: "Movie not found!",
};

export const omdbSearchSingleFallbackResponse = {
    Response: "True" as const,
    totalResults: "1",
    Search: [
        {
            Title: "Fallback Movie",
            imdbID: "tt0000003",
            Type: "movie",
            Poster: "N/A",
            Year: "1999",
        },
    ],
};

export const omdbSearchAnimeResponse = {
    Response: "True" as const,
    totalResults: "1",
    Search: [
        {
            Title: "Anime Feature",
            imdbID: "tt0000004",
            Type: "movie",
            Poster: "https://example.com/anime.jpg",
        },
    ],
};

export const omdbDetailAnimeResponse = {
    Response: "True" as const,
    Title: "Anime Feature",
    imdbID: "tt0000004",
    Type: "movie",
    Plot: "An animated adventure.",
    Poster: "https://example.com/anime.jpg",
    Released: "N/A",
    Year: "2001",
    Genre: "Action, Anime",
    Country: "Japan",
    totalSeasons: "N/A",
    totalEpisodes: "N/A",
};

export const omdbSearchDupesResponse = {
    Response: "True" as const,
    totalResults: "2",
    Search: [
        {
            Title: "Duplicate Movie",
            imdbID: "tt0000005",
            Type: "movie",
            Poster: "https://example.com/dupe.jpg",
        },
        {
            Title: "Duplicate Movie Again",
            imdbID: "tt0000005",
            Type: "movie",
            Poster: "https://example.com/dupe.jpg",
        },
    ],
};

export const omdbSearchLimitedResultsResponse = {
    Response: "True" as const,
    totalResults: "1",
    Search: [
        {
            Title: "Limited Movie",
            imdbID: "tt0000006",
            Type: "movie",
            Poster: "https://example.com/limited.jpg",
        },
    ],
};

export const omdbDetailLimitedMovieResponse = {
    Response: "True" as const,
    Title: "Limited Movie",
    imdbID: "tt0000006",
    Type: "movie",
    Plot: "A standalone story.",
    Poster: "https://example.com/limited.jpg",
    Released: "2022-09-15",
    Genre: "Drama",
    Country: "USA",
    totalSeasons: "N/A",
    totalEpisodes: "N/A",
};

export const omdbSearchOffsetResponse = {
    Response: "True" as const,
    totalResults: "25",
    Search: Array.from({ length: 10 }).map((_, index) => ({
        Title: `Paged Movie ${index + 1}`,
        imdbID: `ttOffset${index + 1}`,
        Type: "movie",
        Poster: "https://example.com/paged.jpg",
    })),
};

export const omdbSearchSecondPageResponse = {
    Response: "True" as const,
    totalResults: "25",
    Search: Array.from({ length: 10 }).map((_, index) => ({
        Title: `Paged Movie ${index + 11}`,
        imdbID: `ttOffset${index + 11}`,
        Type: "movie",
        Poster: "https://example.com/paged.jpg",
    })),
};

export const omdbDetailOffsetMovieResponse = {
    Response: "True" as const,
    Title: "Paged Movie 11",
    imdbID: "ttOffset11",
    Type: "movie",
    Plot: "Next page start movie.",
    Poster: "https://example.com/paged.jpg",
    Released: "2021-03-12",
    Genre: "Adventure",
    Country: "USA",
    totalSeasons: "N/A",
    totalEpisodes: "N/A",
};
