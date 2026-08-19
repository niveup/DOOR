import React, { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { AppScreen } from "@/src/components/screen";
import { useAuth } from "@/src/providers/auth-provider";
import { useTheme } from "@/src/providers/theme-provider";
import { useNotify } from "@/src/providers/notification-provider";
import { colors, radii } from "@/src/theme/tokens";
import { queryPersister } from "@/src/services/query-client";
import { api } from "@/src/services/api";

const backendUrl = process.env.EXPO_PUBLIC_API_URL || "https://api.door.app";

export default function ProfileScreen() {
  const { lock } = useAuth();
  const client = useQueryClient();
  const notify = useNotify();
  const { theme, isDark } = useTheme();

  const [testingPing, setTestingPing] = useState(false);

  // Fetch settings & tracker info
  const trackerQuery = useQuery({
    queryKey: ["tracker"],
    queryFn: api.tracker.status,
    staleTime: 10_000,
  });

  const dailyGoal = Number(trackerQuery.data?.dailyAvailableHours) || 4;

  const testBackendPing = async () => {
    try {
      setTestingPing(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const startTime = Date.now();
      await api.health();
      const latency = Date.now() - startTime;
      notify.success("Backend Connected", `Health check passed · ${latency}ms latency`);
    } catch {
      notify.error("Connection Failed", "Could not reach backend API. Check network.");
    } finally {
      setTestingPing(false);
    }
  };

  const handleClearCache = () => {
    notify.confirm({
      title: "Clear Offline Cache?",
      message: "This clears cached screen data on this device. Cloud data remains untouched.",
      confirmLabel: "Clear Cache",
      tone: "warning",
      icon: "refresh-outline",
      onConfirm: async () => {
        client.clear();
        await queryPersister.removeClient();
        notify.success("Cache Cleared", "Offline data flushed. Re-fetching fresh state…");
        client.invalidateQueries();
      },
    });
  };

  const handleLockDevice = () => {
    notify.confirm({
      title: "Lock DOOR?",
      message: "This clears the active session and passcode from this device. Cloud data is safely preserved.",
      confirmLabel: "Lock Device",
      tone: "destructive",
      icon: "lock-closed-outline",
      onConfirm: async () => {
        await lock();
        client.clear();
        await queryPersister.removeClient();
        router.replace("/passcode");
      },
    });
  };

  return (
    <AppScreen
      title="Settings & Hub"
      subtitle="Apple & Google flagship architecture · Private & local"
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero Identity Card */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: isDark ? "#121215" : "#ffffff",
              borderColor: isDark ? "#222226" : "#e2e8f0",
            },
          ]}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.avatarGlowWrapper}>
              <View
                style={[
                  styles.avatarCircle,
                  {
                    backgroundColor: isDark ? "#18181D" : "#f1f5f9",
                    borderColor: colors.emerald,
                  },
                ]}
              >
                <Text style={styles.avatarInitials}>GA</Text>
              </View>
              <View style={styles.onlineBadge} />
            </View>

            <View style={styles.heroDetails}>
              <View style={styles.heroTitleRow}>
                <Text
                  style={[
                    styles.heroName,
                    { color: isDark ? "#FAFAFA" : theme.text },
                  ]}
                >
                  GATE Aspirant
                </Text>
                <View
                  style={[
                    styles.tierPill,
                    {
                      backgroundColor: isDark
                        ? "rgba(16, 185, 129, 0.15)"
                        : "rgba(5, 150, 105, 0.10)",
                      borderColor: isDark
                        ? "rgba(16, 185, 129, 0.3)"
                        : "rgba(5, 150, 105, 0.25)",
                    },
                  ]}
                >
                  <Text style={styles.tierText}>CS / IT 2026</Text>
                </View>
              </View>

              <Text
                style={[
                  styles.heroSubtitle,
                  { color: isDark ? "#A1A1AA" : theme.textMuted },
                ]}
              >
                DOOR Academic OS · Encrypted Single-User
              </Text>
            </View>
          </View>

          {/* Quick Metrics Bar */}
          <View
            style={[
              styles.metricsBar,
              {
                backgroundColor: isDark ? "#0D0D10" : "#f8fafc",
                borderColor: isDark ? "#1F1F24" : "#e2e8f0",
              },
            ]}
          >
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{dailyGoal}h</Text>
              <Text
                style={[
                  styles.metricLabel,
                  { color: isDark ? "#71717A" : theme.textFaint },
                ]}
              >
                Daily Goal
              </Text>
            </View>

            <View
              style={[
                styles.metricDivider,
                { backgroundColor: isDark ? "#222226" : "#e2e8f0" },
              ]}
            />

            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, { color: colors.emerald }]}>
                Postgres
              </Text>
              <Text
                style={[
                  styles.metricLabel,
                  { color: isDark ? "#71717A" : theme.textFaint },
                ]}
              >
                Primary DB
              </Text>
            </View>

            <View
              style={[
                styles.metricDivider,
                { backgroundColor: isDark ? "#222226" : "#e2e8f0" },
              ]}
            />

            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, { color: colors.cyan }]}>
                AES-GCM
              </Text>
              <Text
                style={[
                  styles.metricLabel,
                  { color: isDark ? "#71717A" : theme.textFaint },
                ]}
              >
                Security
              </Text>
            </View>
          </View>
        </View>

        {/* Group 1: Intelligence & AI Mentor */}
        <Text
          style={[
            styles.groupHeader,
            { color: isDark ? "#71717A" : theme.textFaint },
          ]}
        >
          AI MENTOR & INTELLIGENCE
        </Text>
        <View
          style={[
            styles.insetGroup,
            {
              backgroundColor: isDark ? "#121215" : "#ffffff",
              borderColor: isDark ? "#222226" : "#e2e8f0",
            },
          ]}
        >
          <View style={styles.groupRow}>
            <View
              style={[
                styles.iconTile,
                {
                  backgroundColor: "rgba(139, 92, 246, 0.12)",
                  borderColor: "rgba(139, 92, 246, 0.25)",
                },
              ]}
            >
              <Ionicons name="sparkles" size={18} color="#A78BFA" />
            </View>
            <View style={styles.rowContent}>
              <Text
                style={[
                  styles.rowTitle,
                  { color: isDark ? "#FAFAFA" : theme.text },
                ]}
              >
                AI Reasoning Engine
              </Text>
              <Text
                style={[
                  styles.rowSubtitle,
                  { color: isDark ? "#A1A1AA" : theme.textMuted },
                ]}
              >
                OpenRouter / Cerebras / NVIDIA
              </Text>
            </View>
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: isDark
                    ? "rgba(139, 92, 246, 0.12)"
                    : "rgba(139, 92, 246, 0.08)",
                },
              ]}
            >
              <Text style={[styles.statusPillText, { color: "#A78BFA" }]}>
                Active
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.rowSeparator,
              { backgroundColor: isDark ? "#1C1C22" : "#f1f5f9" },
            ]}
          />

          <View style={styles.groupRow}>
            <View
              style={[
                styles.iconTile,
                {
                  backgroundColor: "rgba(6, 182, 212, 0.12)",
                  borderColor: "rgba(6, 182, 212, 0.25)",
                },
              ]}
            >
              <Ionicons name="bulb-outline" size={18} color="#22D3EE" />
            </View>
            <View style={styles.rowContent}>
              <Text
                style={[
                  styles.rowTitle,
                  { color: isDark ? "#FAFAFA" : theme.text },
                ]}
              >
                Weekly Jujum Analysis
              </Text>
              <Text
                style={[
                  styles.rowSubtitle,
                  { color: isDark ? "#A1A1AA" : theme.textMuted },
                ]}
              >
                7-day rolling performance mentor
              </Text>
            </View>
            <Text
              style={[
                styles.rowValueText,
                { color: isDark ? "#71717A" : theme.textFaint },
              ]}
            >
              Daily Auto
            </Text>
          </View>
        </View>

        {/* Group 2: System Health & Connection */}
        <Text
          style={[
            styles.groupHeader,
            { color: isDark ? "#71717A" : theme.textFaint },
          ]}
        >
          SYSTEM HEALTH & NETWORK
        </Text>
        <View
          style={[
            styles.insetGroup,
            {
              backgroundColor: isDark ? "#121215" : "#ffffff",
              borderColor: isDark ? "#222226" : "#e2e8f0",
            },
          ]}
        >
          <Pressable
            onPress={testBackendPing}
            style={({ pressed }) => [
              styles.groupRowPressable,
              pressed && { opacity: 0.7 },
            ]}
          >
            <View
              style={[
                styles.iconTile,
                {
                  backgroundColor: "rgba(16, 185, 129, 0.12)",
                  borderColor: "rgba(16, 185, 129, 0.25)",
                },
              ]}
            >
              <Ionicons name="server-outline" size={18} color={colors.emerald} />
            </View>
            <View style={styles.rowContent}>
              <Text
                style={[
                  styles.rowTitle,
                  { color: isDark ? "#FAFAFA" : theme.text },
                ]}
              >
                Express API Gateway
              </Text>
              <Text
                style={[
                  styles.rowSubtitle,
                  { color: isDark ? "#A1A1AA" : theme.textMuted },
                ]}
                numberOfLines={1}
              >
                {backendUrl}
              </Text>
            </View>
            {testingPing ? (
              <ActivityIndicator size="small" color={colors.emerald} />
            ) : (
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: isDark
                      ? "rgba(16, 185, 129, 0.12)"
                      : "rgba(16, 185, 129, 0.08)",
                  },
                ]}
              >
                <Text style={[styles.statusPillText, { color: colors.emerald }]}>
                  Test Ping
                </Text>
              </View>
            )}
          </Pressable>

          <View
            style={[
              styles.rowSeparator,
              { backgroundColor: isDark ? "#1C1C22" : "#f1f5f9" },
            ]}
          />

          <View style={styles.groupRow}>
            <View
              style={[
                styles.iconTile,
                {
                  backgroundColor: "rgba(245, 158, 11, 0.12)",
                  borderColor: "rgba(245, 158, 11, 0.25)",
                },
              ]}
            >
              <Ionicons name="cube-outline" size={18} color={colors.amber} />
            </View>
            <View style={styles.rowContent}>
              <Text
                style={[
                  styles.rowTitle,
                  { color: isDark ? "#FAFAFA" : theme.text },
                ]}
              >
                Primary Database
              </Text>
              <Text
                style={[
                  styles.rowSubtitle,
                  { color: isDark ? "#A1A1AA" : theme.textMuted },
                ]}
              >
                PostgreSQL via Prisma ORM
              </Text>
            </View>
            <Text
              style={[
                styles.rowValueText,
                { color: isDark ? "#71717A" : theme.textFaint },
              ]}
            >
              Online
            </Text>
          </View>
        </View>

        {/* Group 3: Security & Cryptography */}
        <Text
          style={[
            styles.groupHeader,
            { color: isDark ? "#71717A" : theme.textFaint },
          ]}
        >
          SECURITY & PRIVACY
        </Text>
        <View
          style={[
            styles.insetGroup,
            {
              backgroundColor: isDark ? "#121215" : "#ffffff",
              borderColor: isDark ? "#222226" : "#e2e8f0",
            },
          ]}
        >
          <View style={styles.groupRow}>
            <View
              style={[
                styles.iconTile,
                {
                  backgroundColor: "rgba(16, 185, 129, 0.12)",
                  borderColor: "rgba(16, 185, 129, 0.25)",
                },
              ]}
            >
              <Ionicons name="shield-checkmark" size={18} color={colors.emerald} />
            </View>
            <View style={styles.rowContent}>
              <Text
                style={[
                  styles.rowTitle,
                  { color: isDark ? "#FAFAFA" : theme.text },
                ]}
              >
                Encrypted Session
              </Text>
              <Text
                style={[
                  styles.rowSubtitle,
                  { color: isDark ? "#A1A1AA" : theme.textMuted },
                ]}
              >
                Android Keystore & Expo SecureStore
              </Text>
            </View>
            <Ionicons
              name="lock-closed"
              size={16}
              color={isDark ? "#71717A" : theme.textFaint}
            />
          </View>

          <View
            style={[
              styles.rowSeparator,
              { backgroundColor: isDark ? "#1C1C22" : "#f1f5f9" },
            ]}
          />

          <View style={styles.groupRow}>
            <View
              style={[
                styles.iconTile,
                {
                  backgroundColor: "rgba(6, 182, 212, 0.12)",
                  borderColor: "rgba(6, 182, 212, 0.25)",
                },
              ]}
            >
              <Ionicons name="finger-print-outline" size={18} color={colors.cyan} />
            </View>
            <View style={styles.rowContent}>
              <Text
                style={[
                  styles.rowTitle,
                  { color: isDark ? "#FAFAFA" : theme.text },
                ]}
              >
                Minimal Permissions
              </Text>
              <Text
                style={[
                  styles.rowSubtitle,
                  { color: isDark ? "#A1A1AA" : theme.textMuted },
                ]}
              >
                Zero tracking, no location/camera sensors
              </Text>
            </View>
            <Ionicons
              name="checkmark-circle"
              size={16}
              color={colors.emerald}
            />
          </View>
        </View>

        {/* Group 4: Data & Maintenance Controls */}
        <Text
          style={[
            styles.groupHeader,
            { color: isDark ? "#71717A" : theme.textFaint },
          ]}
        >
          DATA & ACTIONS
        </Text>
        <View
          style={[
            styles.insetGroup,
            {
              backgroundColor: isDark ? "#121215" : "#ffffff",
              borderColor: isDark ? "#222226" : "#e2e8f0",
            },
          ]}
        >
          <Pressable
            onPress={handleClearCache}
            style={({ pressed }) => [
              styles.groupRowPressable,
              pressed && { opacity: 0.7 },
            ]}
          >
            <View
              style={[
                styles.iconTile,
                {
                  backgroundColor: "rgba(245, 158, 11, 0.12)",
                  borderColor: "rgba(245, 158, 11, 0.25)",
                },
              ]}
            >
              <Ionicons name="refresh-outline" size={18} color={colors.amber} />
            </View>
            <View style={styles.rowContent}>
              <Text
                style={[
                  styles.rowTitle,
                  { color: isDark ? "#FAFAFA" : theme.text },
                ]}
              >
                Clear Offline Cache
              </Text>
              <Text
                style={[
                  styles.rowSubtitle,
                  { color: isDark ? "#A1A1AA" : theme.textMuted },
                ]}
              >
                Purges local query persister store
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={isDark ? "#71717A" : theme.textFaint}
            />
          </Pressable>

          <View
            style={[
              styles.rowSeparator,
              { backgroundColor: isDark ? "#1C1C22" : "#f1f5f9" },
            ]}
          />

          <Pressable
            onPress={handleLockDevice}
            style={({ pressed }) => [
              styles.groupRowPressable,
              pressed && { opacity: 0.7 },
            ]}
          >
            <View
              style={[
                styles.iconTile,
                {
                  backgroundColor: "rgba(244, 63, 94, 0.12)",
                  borderColor: "rgba(244, 63, 94, 0.25)",
                },
              ]}
            >
              <Ionicons name="log-out-outline" size={18} color={colors.rose} />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: colors.rose }]}>
                Lock & Sign Out
              </Text>
              <Text
                style={[
                  styles.rowSubtitle,
                  { color: isDark ? "#A1A1AA" : theme.textMuted },
                ]}
              >
                Flushes passcode session from this device
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.rose} />
          </Pressable>
        </View>

        {/* Footer info */}
        <View style={styles.footer}>
          <Text
            style={[
              styles.footerText,
              { color: isDark ? "#71717A" : theme.textFaint },
            ]}
          >
            DOOR Mobile Suite · React Native 0.76 · Expo SDK 54
          </Text>
          <Text
            style={[
              styles.footerSubtext,
              { color: isDark ? "#52525B" : theme.textFaint },
            ]}
          >
            Engineered for GATE 2026 Aspirants
          </Text>
        </View>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
    gap: 16,
  },

  // Hero Card
  heroCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarGlowWrapper: {
    position: "relative",
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    color: colors.emerald,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  onlineBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: colors.emerald,
    borderWidth: 2,
    borderColor: "#121215",
  },
  heroDetails: {
    flex: 1,
    gap: 3,
  },
  heroTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroName: {
    fontSize: 16.5,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  tierPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  tierText: {
    color: colors.emerald,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  heroSubtitle: {
    fontSize: 12,
    fontWeight: "500",
  },
  metricsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  metricItem: {
    alignItems: "center",
    gap: 2,
    flex: 1,
  },
  metricValue: {
    color: "#FAFAFA",
    fontSize: 14,
    fontWeight: "800",
  },
  metricLabel: {
    fontSize: 10.5,
    fontWeight: "600",
  },
  metricDivider: {
    width: 1,
    height: 22,
  },

  // Inset Groups (Apple Settings style)
  groupHeader: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    paddingHorizontal: 6,
    marginTop: 4,
  },
  insetGroup: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  groupRowPressable: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  iconTile: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  rowSubtitle: {
    fontSize: 11.5,
    fontWeight: "500",
  },
  rowValueText: {
    fontSize: 12.5,
    fontWeight: "600",
  },
  rowSeparator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 60,
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusPillText: {
    fontSize: 11.5,
    fontWeight: "700",
  },

  // Footer
  footer: {
    alignItems: "center",
    gap: 4,
    marginTop: 12,
    paddingVertical: 8,
  },
  footerText: {
    fontSize: 11,
    fontWeight: "600",
  },
  footerSubtext: {
    fontSize: 10.5,
    fontWeight: "500",
  },
});
