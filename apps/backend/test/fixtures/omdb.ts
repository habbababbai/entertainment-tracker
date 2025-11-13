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
