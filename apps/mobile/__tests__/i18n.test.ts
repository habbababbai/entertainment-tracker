describe("i18n configuration", () => {
    let i18n: typeof import("../lib/i18n").default;

    beforeAll(() => {
        jest.resetModules();
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const i18nModule = require("../lib/i18n") as {
            default: typeof import("../lib/i18n").default;
        };
        i18n = i18nModule.default;
    });

    it("initializes once with English as the default locale", () => {
        expect(i18n.isInitialized).toBe(true);
        expect(i18n.language).toBe("en");
    });

    it("exposes English translations for common strings", () => {
        expect(i18n.t("home.title")).toBe("Entertainment Tracker");
        expect(i18n.t("common.pullToRetry")).toBe("Pull to retry.");
    });

    it("falls back to English when another locale is requested", () => {
        const translateFrench = i18n.getFixedT("fr");
        expect(translateFrench("home.subtitle")).toBe(
            "Browse your watchlist powered by OMDb."
        );
    });
});

describe("i18n initialization guard", () => {
    afterEach(() => {
        jest.resetModules();
        jest.dontMock("i18next");
        jest.dontMock("react-i18next");
    });

    it("does not reinitialize when already initialized", async () => {
        const useMock = jest.fn().mockReturnThis();
        const initMock = jest.fn();

        jest.resetModules();

        jest.doMock("i18next", () => ({
            __esModule: true,
            default: {
                use: useMock,
                init: initMock,
                isInitialized: true,
            },
        }));

        jest.doMock("react-i18next", () => ({
            __esModule: true,
            initReactI18next: Symbol("initReactI18next"),
        }));

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("../lib/i18n");

        expect(useMock).not.toHaveBeenCalled();
        expect(initMock).not.toHaveBeenCalled();
    });
});
