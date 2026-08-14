import { Alert, Linking, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { AppScreen } from "@/src/components/screen";
import { ActionButton, Card, SectionTitle, ui } from "@/src/components/ui";
import { useAuth } from "@/src/providers/auth-provider";
import { colors } from "@/src/theme/tokens";
import { queryPersister } from "@/src/services/query-client";

const backend = process.env.EXPO_PUBLIC_API_URL || "Not configured";

export default function ProfileScreen() {
  const { lock } = useAuth();
  const client = useQueryClient();
  const lockApp = () => Alert.alert("Lock DOOR?", "This removes the passcode and any regular offline cache from this device. Your backend data is unchanged.", [{ text: "Cancel", style: "cancel" }, { text: "Lock app", style: "destructive", onPress: async () => { await lock(); client.clear(); await queryPersister.removeClient(); router.replace("/passcode"); } }]);
  return <AppScreen title="Privacy & settings" subtitle="A small app footprint, deliberately." >
    <Card style={styles.security}><View style={styles.securityIcon}><Ionicons name="shield-checkmark" color={colors.emerald} size={24} /></View><View style={styles.securityCopy}><Text style={styles.securityTitle}>Secure passcode session</Text><Text style={styles.securityText}>Stored with Android Keystore through Expo SecureStore. The passcode is never written to a source file, cache, or app log.</Text></View></Card>
    <SectionTitle title="Connection" />
    <Card><Text style={styles.connectionLabel}>EXISTING EXPRESS BACKEND</Text><Text style={styles.connectionUrl} numberOfLines={2}>{backend}</Text><Text style={styles.connectionNote}>Every request carries your secure x-passcode header over HTTPS. There is no mobile-specific database or backend.</Text></Card>
    <SectionTitle title="Device access" />
    <Card style={styles.item}><Ionicons name="phone-portrait-outline" color={colors.cyan} size={20} /><View style={styles.itemCopy}><Text style={styles.itemTitle}>Minimal permissions</Text><Text style={styles.itemText}>DOOR does not request camera, microphone, location, contacts, storage, notifications, or sensor access.</Text></View></Card>
    <Card style={styles.item}><Ionicons name="cloud-done-outline" color={colors.cyan} size={20} /><View style={styles.itemCopy}><Text style={styles.itemTitle}>Offline-friendly, not offline-only</Text><Text style={styles.itemText}>Screen data is cached for quick loading; protected journal entries are intentionally excluded from regular cache.</Text></View></Card>
    <SectionTitle title="App controls" />
    <ActionButton label="Lock this device" icon="lock-closed-outline" tone="rose" onPress={lockApp} />
    <ActionButton label="Backend deployment guide" icon="open-outline" tone="ghost" onPress={() => Linking.openURL("https://render.com/docs") } />
    <View style={[ui.row, styles.footer]}><Text style={styles.footerText}>DOOR Android · Expo SDK 52</Text><Text style={styles.footerText}>v1.0.0</Text></View>
  </AppScreen>;
}
const styles = StyleSheet.create({
  security: { flexDirection: "row", gap: 12, backgroundColor: colors.surface, borderColor: colors.border, alignItems: "flex-start" },
  securityIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: colors.raised, borderColor: colors.border, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  securityCopy: { flex: 1, gap: 4 },
  securityTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
  securityText: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  connectionLabel: { color: colors.cyan, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  connectionUrl: { color: colors.text, fontSize: 13, lineHeight: 20, fontFamily: "monospace" },
  connectionNote: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  item: { flexDirection: "row", gap: 11, alignItems: "flex-start" },
  itemCopy: { flex: 1, gap: 3 },
  itemTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  itemText: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  footer: { justifyContent: "space-between", padding: 8 },
  footerText: { color: colors.textFaint, fontSize: 10, fontWeight: "700" },
});
