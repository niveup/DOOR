import "react-native-gesture-handler";
import "react-native-reanimated";
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { colors } from "@/src/theme/tokens";
import { queryClient, queryPersister } from "@/src/services/query-client";
import { AuthProvider } from "@/src/providers/auth-provider";

const navigationTheme = { ...DarkTheme, colors: { ...DarkTheme.colors, primary: colors.cyan, background: colors.canvas, card: colors.surface, text: colors.text, border: colors.border, notification: colors.rose } };

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: queryPersister, maxAge: 1000 * 60 * 60 * 24, dehydrateOptions: { shouldDehydrateQuery: (query) => !String(query.queryKey[0]).startsWith("journal") } }}>
        <ThemeProvider value={navigationTheme}>
          <AuthProvider>
            <BottomSheetModalProvider>
              <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="passcode" options={{ animation: "fade" }} />
                <Stack.Screen name="(tabs)" />
              </Stack>
              <StatusBar style="light" backgroundColor={colors.canvas} />
            </BottomSheetModalProvider>
          </AuthProvider>
        </ThemeProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}

export function LoadingApp() {
  return <View style={styles.loading}><ActivityIndicator color={colors.cyan} /></View>;
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.canvas }, loading: { flex: 1, backgroundColor: colors.canvas, justifyContent: "center", alignItems: "center" } });
