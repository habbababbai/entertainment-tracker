export const isTestEnv =
    typeof jest !== "undefined" || process.env.NODE_ENV === "test";
