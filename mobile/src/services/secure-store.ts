import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const PASSCODE_KEY = "door.app.passcode.v1";
const isWeb = Platform.OS === "web";

export const securePasscode = {
  read: async (): Promise<string | null> => {
    if (isWeb) {
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          return window.localStorage.getItem(PASSCODE_KEY);
        }
      } catch {
        return null;
      }
      return null;
    }
    try {
      return await SecureStore.getItemAsync(PASSCODE_KEY);
    } catch {
      return null;
    }
  },
  save: async (passcode: string): Promise<void> => {
    if (isWeb) {
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem(PASSCODE_KEY, passcode);
        }
      } catch {}
      return;
    }
    try {
      await SecureStore.setItemAsync(PASSCODE_KEY, passcode);
    } catch {}
  },
  clear: async (): Promise<void> => {
    if (isWeb) {
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.removeItem(PASSCODE_KEY);
        }
      } catch {}
      return;
    }
    try {
      await SecureStore.deleteItemAsync(PASSCODE_KEY);
    } catch {}
  },
};
