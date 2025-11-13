const expoPreset = require("jest-expo/universal/jest-preset");

const {
    setupFilesAfterEnv = [],
    moduleNameMapper = {},
    transformIgnorePatterns = [],
    projects: presetProjects = [],
    watchPlugins: _watchPlugins,
    ...basePreset
} = expoPreset;

const projects = presetProjects.map(({ watchPlugins, ...projectConfig }) => ({
    ...projectConfig,
}));

module.exports = {
    ...basePreset,
    projects,
    setupFilesAfterEnv: [...setupFilesAfterEnv, "<rootDir>/jest.setup.ts"],
    moduleNameMapper: {
        ...moduleNameMapper,
        "^@/(.*)$": "<rootDir>/$1",
        "^~/(.*)$": "<rootDir>/$1",
    },
    transformIgnorePatterns: [
        ...transformIgnorePatterns,
        "node_modules/(?!(@?react-native|react-native-safe-area-context|@react-native(-community)?|expo(nent)?|expo-router|@expo(nent)?/.*|@tanstack)/)",
    ],
    testMatch: [
        "<rootDir>/__tests__/**/*.test.[jt]s?(x)",
        "<rootDir>/**/*.test.[jt]s?(x)",
        "<rootDir>/**/*.spec.[jt]s?(x)",
    ],
};
