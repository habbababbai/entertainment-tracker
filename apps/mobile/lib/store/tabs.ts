import { create } from "zustand";

type TabsState = {
    lastTab: string | null;
    setLastTab: (path: string) => void;
};

export const useTabsStore = create<TabsState>((set) => ({
    lastTab: null,
    setLastTab: (path: string) => {
        set({ lastTab: path });
    },
}));
