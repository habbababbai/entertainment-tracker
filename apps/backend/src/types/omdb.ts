export interface OmdbSearchItem {
    Title: string;
    Year?: string;
    imdbID: string;
    Type?: string;
    Poster?: string;
}

export interface OmdbSearchResponse {
    Search?: OmdbSearchItem[];
    totalResults?: string;
    Response: "True" | "False";
    Error?: string;
}

export interface OmdbDetailResponse extends OmdbSearchItem {
    Response: "True" | "False";
    Error?: string;
    Plot?: string;
    Released?: string;
    totalSeasons?: string;
    totalEpisodes?: string;
    Country?: string;
    Genre?: string;
    Poster?: string;
}


