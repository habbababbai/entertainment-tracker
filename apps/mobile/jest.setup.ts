import "@testing-library/jest-native/extend-expect";
import "./lib/i18n";
import type { ReactNode } from "react";

jest.mock("expo-router", () => ({
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
        back: jest.fn(),
        canGoBack: jest.fn(() => true),
    }),
    useSegments: jest.fn(() => []),
    useLocalSearchParams: jest.fn(() => ({})),
    useGlobalSearchParams: jest.fn(() => ({})),
    Stack: ({ children }: { children: ReactNode }) => children,
    Slot: ({ children }: { children: ReactNode }) => children,
    Tabs: ({ children }: { children: ReactNode }) => children,
}));
