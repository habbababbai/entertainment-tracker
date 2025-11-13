import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { en, type AppTranslationContent } from "./locales/en";

const defaultNS = "translation";

const resources = {
    en: {
        translation: en,
    },
} as const;

export type AppResources = typeof resources;
export type AppTranslations = AppTranslationContent;

if (!i18n.isInitialized) {
    void i18n.use(initReactI18next).init({
        resources,
        lng: "en",
        fallbackLng: "en",
        defaultNS,
        interpolation: {
            escapeValue: false,
        },
        initImmediate: false,
    });
}

declare module "react-i18next" {
    interface CustomTypeOptions {
        defaultNS: typeof defaultNS;
        resources: (typeof resources)["en"];
    }
}

export default i18n;


