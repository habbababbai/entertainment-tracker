import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface HomeState {
    submittedSearch: string;
    scrollOffset: number;
    setSubmittedSearch: (submittedSearch: string) => void;
    setScrollOffset: (scrollOffset: number) => void;
}

export const useHomeStore = create<HomeState>()(
    persist(
        (set) => ({
            submittedSearch: "chainsaw man",
            scrollOffset: 0,
            setSubmittedSearch: (submittedSearch) => set({ submittedSearch }),
            setScrollOffset: (scrollOffset) => set({ scrollOffset }),
        }),
        {
            name: "home-storage",
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);

