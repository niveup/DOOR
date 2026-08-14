import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, ApiError } from "@/src/services/api";
import { useAuth } from "@/src/providers/auth-provider";
import { ActionButton, LabeledInput } from "@/src/components/ui";
import { colors } from "@/src/theme/tokens";

export default function PasscodeScreen() {
  const { unlock } = useAuth();
  const [passcode, setPasscode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    if (passcode.trim().length < 8) { setError("Enter the app passcode (at least 8 characters)."); return; }
    setSubmitting(true); setError("");
    try {
      await api.verifyPasscode(passcode.trim());
      await unlock(passcode.trim());
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (reason) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(reason instanceof ApiError ? reason.message : "Unable to unlock DOOR.");
    } finally { setSubmitting(false); }
  };
  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={styles.keyboard} behavior={Platform.select({ ios: "padding", android: undefined })}><View style={styles.content}>
    <View style={styles.mark}><Text style={styles.markText}>D</Text></View><Text style={styles.eyebrow}>DOOR / PERSONAL AI MENTOR</Text><Text style={styles.title}>Open your focused space.</Text>
    <Text style={styles.description}>Your passcode is checked securely with your existing DOOR server and stored only in Android encrypted storage.</Text>
    <LabeledInput label="App passcode" value={passcode} onChangeText={setPasscode} secureTextEntry autoFocus autoCapitalize="none" autoCorrect={false} onSubmitEditing={submit} returnKeyType="go" />
    {error ? <Text style={styles.error}>{error}</Text> : null}<ActionButton label={submitting ? "Verifying…" : "Unlock DOOR"} icon="lock-open-outline" onPress={submit} disabled={submitting} />
    <Text style={styles.note}>No social login. No account duplication. DOOR connects directly to your existing backend.</Text>
  </View></KeyboardAvoidingView></SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  keyboard: { flex: 1 },
  content: { flex: 1, justifyContent: "center", padding: 28, gap: 16 },
  mark: { width: 62, height: 62, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 20, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  markText: { color: colors.emerald, fontSize: 31, fontWeight: "900" },
  eyebrow: { color: colors.emerald, fontWeight: "800", letterSpacing: 1.5, fontSize: 10 },
  title: { color: colors.text, fontSize: 32, lineHeight: 38, letterSpacing: -1, fontWeight: "900" },
  description: { color: colors.textMuted, fontSize: 14, lineHeight: 21, marginBottom: 8 },
  error: { color: colors.rose, backgroundColor: "rgba(244, 63, 94, 0.14)", borderColor: colors.rose, borderWidth: 1, padding: 12, borderRadius: 10, fontSize: 13, fontWeight: "700" },
  note: { color: colors.textFaint, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 4 },
});
