import * as SecureStore from "expo-secure-store";

const PASSCODE_KEY = "door.app.passcode.v1";

export const securePasscode = {
  read: () => SecureStore.getItemAsync(PASSCODE_KEY),
  save: (passcode: string) => SecureStore.setItemAsync(PASSCODE_KEY, passcode),
  clear: () => SecureStore.deleteItemAsync(PASSCODE_KEY),
};
