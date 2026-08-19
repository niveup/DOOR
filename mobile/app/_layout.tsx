import "react-native-gesture-handler";
import "react-native-reanimated";
import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from "@react-navigation/native";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { colors } from "@/src/theme/tokens";
import { queryClient, queryPersister } from "@/src/services/query-client";
import { AuthProvider } from "@/src/providers/auth-provider";
import { AppThemeProvider, useTheme } from "@/src/providers/theme-provider";
import { NotificationProvider } from "@/src/providers/notification-provider";

function NavigationWrapper() {
  const { isDark, theme } = useTheme();

  const activeNavTheme = isDark
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          primary: theme.accent,
          background: theme.canvas,
          card: theme.surface,
          text: theme.text,
          border: theme.border,
          notification: theme.rose,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          primary: theme.accent,
          background: theme.canvas,
          card: theme.surface,
          text: theme.text,
          border: theme.border,
          notification: theme.rose,
        },
      };

  return (
    <NavThemeProvider value={activeNavTheme}>
      <AuthProvider>
        <NotificationProvider>
          <BottomSheetModalProvider>
            <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="passcode" options={{ animation: "fade" }} />
              <Stack.Screen name="(tabs)" />
            </Stack>
            <StatusBar style={isDark ? "light" : "dark"} backgroundColor={theme.canvas} />
          </BottomSheetModalProvider>
        </NotificationProvider>
      </AuthProvider>
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister: queryPersister,
          maxAge: 1000 * 60 * 60 * 24,
          dehydrateOptions: {
            shouldDehydrateQuery: (query) =>
              query.state.status === "success" &&
              !String(query.queryKey[0]).startsWith("journal"),
          },
        }}
      >
        <AppThemeProvider>
          <NavigationWrapper />
        </AppThemeProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}

export function LoadingApp() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  loading: { flex: 1, backgroundColor: colors.canvas, justifyContent: "center", alignItems: "center" },
});
