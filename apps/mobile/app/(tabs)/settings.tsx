import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, Text } from "react-native";

export default function SettingsScreen() {
    return (
        <SafeAreaView style={styles.container}>
            <Text style={styles.title}>Settings</Text>
            <Text style={styles.subtitle}>
                Manage preferences and account settings here.
            </Text>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: "600",
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 16,
        color: "#555",
        textAlign: "center",
    },
});
