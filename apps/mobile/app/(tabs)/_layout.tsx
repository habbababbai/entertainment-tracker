import { Tabs } from "expo-router";
import { useTheme } from "../../lib/theme";

export default function TabsLayout() {
    const colors = useTheme();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: colors.surface,
                    borderTopColor: colors.border,
                },
                tabBarActiveTintColor: colors.accent,
                tabBarInactiveTintColor: colors.textMuted,
            }}
        >
            <Tabs.Screen
                name="home"
                options={{
                    title: "Home",
                }}
            />
            <Tabs.Screen
                name="saved"
                options={{
                    title: "Saved",
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: "Settings",
                }}
            />
        </Tabs>
    );
}
