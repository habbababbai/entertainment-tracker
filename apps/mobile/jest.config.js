const expoPreset = require("jest-expo/universal/jest-preset");

const {
    setupFilesAfterEnv = [],
    moduleNameMapper = {},
    transformIgnorePatterns = [],
    projects: presetProjects = [],
    watchPlugins: _watchPlugins,
    ...basePreset
} = expoPreset;

const projects = presetProjects.map(({ watchPlugins, ...projectConfig }) => {
    const displayName =
        typeof projectConfig.displayName === "string"
            ? projectConfig.displayName
            : projectConfig.displayName?.name;
    const normalized = displayName
        ? displayName.toString().toLowerCase()
        : undefined;

    const testPathIgnorePatterns = [
        ...(projectConfig.testPathIgnorePatterns ?? []),
    ];

    if (normalized === "web" || normalized === "node") {
        testPathIgnorePatterns.push(
            "<rootDir>/__tests__/.*\\.ui\\.test\\.[jt]sx?$",
            "<rootDir>/__tests__/store-auth\\.test\\.[jt]sx?$",
            "<rootDir>/__tests__/store-home\\.test\\.[jt]sx?$",
            "<rootDir>/__tests__/store-theme\\.test\\.[jt]sx?$"
        );
    }

    return {
        ...projectConfig,
        testPathIgnorePatterns,
    };
});

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
