import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { darkColors, lightColors } from "@/src/theme/tokens";

export type ThemeMode = "dark" | "light" | "system";
export type ColorTheme = typeof darkColors;

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  theme: ColorTheme;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "door_mobile_theme_mode_v1";

export function AppThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>("dark");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === "light" || saved === "dark" || saved === "system") {
        setMode(saved);
      }
    });
  }, []);

  const isDark = useMemo(() => {
    if (mode === "system") return systemScheme === "dark";
    return mode === "dark";
  }, [mode, systemScheme]);

  const theme = useMemo(() => {
    return isDark ? darkColors : (lightColors as unknown as ColorTheme);
  }, [isDark]);

  const setThemeMode = async (newMode: ThemeMode) => {
    setMode(newMode);
    await AsyncStorage.setItem(STORAGE_KEY, newMode).catch(() => {});
  };

  const toggleTheme = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const nextMode: ThemeMode = isDark ? "light" : "dark";
    await setThemeMode(nextMode);
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      isDark,
      theme,
      toggleTheme,
      setThemeMode,
    }),
    [mode, isDark, theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      mode: "dark" as ThemeMode,
      isDark: true,
      theme: darkColors,
      toggleTheme: () => {},
      setThemeMode: () => {},
    };
  }
  return context;
}
