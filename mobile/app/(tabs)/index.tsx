import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { AppScreen } from "@/src/components/screen";
import { Card, ProgressBar, SectionTitle } from "@/src/components/ui";
import { FullScreenGlitterOverlay } from "@/src/components/glitter-overlay";
import { todayInKolkata } from "@/src/lib/format";
import { api } from "@/src/services/api";
import { useTheme } from "@/src/providers/theme-provider";

type TodoTag = "GATE" | "Quick" | "College" | "Personal";

interface PersonalTodo {
  id: string;
  text: string;
  completed: boolean;
  tag: TodoTag;
  durationMin: number;
  createdAt: number;
}

const DEFAULT_DURATIONS: Record<TodoTag, number> = {
  GATE: 45,
  College: 30,
  Quick: 10,
  Personal: 15,
};

const DURATION_PRESETS = [10, 20, 30, 40, 50, 60, 90, 120];

let cheerSoundObject: Audio.Sound | null = null;

async function setupAudio() {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch {}
}

async function playAchievementCheer() {
  try {
    await setupAudio();
    if (!cheerSoundObject) {
      const { sound } = await Audio.Sound.createAsync(
        require("@/assets/sounds/cheer.mp3"),
        { shouldPlay: true, volume: 1.0 }
      );
      cheerSoundObject = sound;
    } else {
      await cheerSoundObject.replayAsync();
    }
  } catch {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require("@/assets/sounds/cheer.mp3"),
        { shouldPlay: true, volume: 1.0 }
      );
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch {}
  }
}

export default function TodayScreen() {
  const date = todayInKolkata();
  const queryClient = useQueryClient();
  const { theme, isDark, toggleTheme } = useTheme();

  // Distinct & Harmonious Tag System
  const TAG_CONFIG: Record<
    TodoTag,
    { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }
  > = useMemo(
    () => ({
      GATE: {
        label: "GATE",
        color: isDark ? "#38bdf8" : "#0284c7",
        bg: isDark ? "rgba(56, 189, 248, 0.12)" : "rgba(2, 132, 199, 0.08)",
        icon: "school-outline",
      },
      Quick: {
        label: "Quick",
        color: isDark ? "#f59e0b" : "#d97706",
        bg: isDark ? "rgba(245, 158, 11, 0.12)" : "rgba(217, 119, 6, 0.08)",
        icon: "flash-outline",
      },
      College: {
        label: "College",
        color: isDark ? "#fb7185" : "#e11d48",
        bg: isDark ? "rgba(251, 113, 133, 0.12)" : "rgba(225, 29, 72, 0.08)",
        icon: "book-outline",
      },
      Personal: {
        label: "Personal",
        color: isDark ? "#34d399" : "#059669",
        bg: isDark ? "rgba(52, 211, 153, 0.12)" : "rgba(5, 150, 105, 0.08)",
        icon: "leaf-outline",
      },
    }),
    [isDark]
  );

  // --- State ---
  const [todos, setTodos] = useState<PersonalTodo[]>([]);
  const [tagMap, setTagMap] = useState<Record<string, TodoTag>>({});
  const [showAddCard, setShowAddCard] = useState(false);
  const [newTodoText, setNewTodoText] = useState("");
  const [selectedTag, setSelectedTag] = useState<TodoTag>("GATE");
  const [customDuration, setCustomDuration] = useState<number>(45);
  const [showAddDurationDropdown, setShowAddDurationDropdown] = useState(false);
  
  // Time Dialer / Slider Modal State
  const [editingTask, setEditingTask] = useState<PersonalTodo | null>(null);
  const [dialerMinutes, setDialerMinutes] = useState<number>(45);

  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);
  const [toastText, setToastText] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  // Pre-load audio instance on mount
  useEffect(() => {
    setupAudio();
    Audio.Sound.createAsync(
      require("@/assets/sounds/cheer.mp3"),
      { shouldPlay: false, volume: 1.0 }
    )
      .then(({ sound }) => {
        cheerSoundObject = sound;
      })
      .catch(() => {});

    // Load mobile tags mapping
    AsyncStorage.getItem("door_mobile_tags_map").then((res) => {
      if (res) {
        try {
          setTagMap(JSON.parse(res));
        } catch {}
      }
    });

    return () => {
      if (cheerSoundObject) {
        cheerSoundObject.unloadAsync().catch(() => {});
        cheerSoundObject = null;
      }
    };
  }, []);

  // Sync with Backend Routine Query
  const routineQuery = useQuery({
    queryKey: ["routine", date],
    queryFn: () => api.routine.today(date),
    staleTime: 10_000,
  });

  // Sync backend tasks with mobile UI
  useEffect(() => {
    if (routineQuery.data && Array.isArray(routineQuery.data.tasks)) {
      const serverTasks: PersonalTodo[] = routineQuery.data.tasks.map((task: any, index: number) => {
        const localTag = (tagMap[task.taskId] || tagMap[task.title] || (index === 0 ? "GATE" : "Quick")) as TodoTag;
        return {
          id: task.taskId,
          text: task.title,
          completed: task.status === "COMPLETED",
          tag: localTag,
          durationMin: task.durationMin || DEFAULT_DURATIONS[localTag] || 30,
          createdAt: task.createdAt ? new Date(task.createdAt).getTime() : Date.now(),
        };
      });
      setTodos(serverTasks);
      AsyncStorage.removeItem(`door_todos_${date}`).catch(() => {});
    } else if (!routineQuery.isLoading && !routineQuery.data) {
      AsyncStorage.getItem(`door_todos_${date}`).then((stored) => {
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              setTodos(parsed);
              return;
            }
          } catch {}
        }
        setTodos([]);
      });
    }
  }, [routineQuery.data, routineQuery.isLoading, date, tagMap]);

  // Handle Android Back Button
  useEffect(() => {
    if (!showAddCard && !editingTask) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (editingTask) {
        setEditingTask(null);
        return true;
      }
      if (showAddCard) {
        setShowAddCard(false);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [showAddCard, editingTask]);

  const toggleAddCard = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (!showAddCard) {
      setNewTodoText("");
      setSelectedTag("GATE");
      setCustomDuration(DEFAULT_DURATIONS.GATE);
      setShowAddDurationDropdown(false);
    }
    setShowAddCard((prev) => !prev);
  };

  const handleTagSelect = (tag: TodoTag) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedTag(tag);
    setCustomDuration(DEFAULT_DURATIONS[tag]);
  };

  // Instant Optimistic Add Task
  const handleSaveNewTodo = () => {
    const title = newTodoText.trim();
    if (!title) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const tempId = `temp-${Date.now()}`;
    const tagChoice = selectedTag;
    const duration = customDuration || DEFAULT_DURATIONS[tagChoice];

    const newEntry: PersonalTodo = {
      id: tempId,
      text: title,
      completed: false,
      tag: tagChoice,
      durationMin: duration,
      createdAt: Date.now(),
    };

    setShowAddCard(false);
    setShowAddDurationDropdown(false);
    setNewTodoText("");
    setShowCelebration(false);
    setRecentlyAddedId(tempId);
    setToastText(`Task added · Tap time to change (${duration}m)`);
    setTodos((current) => [newEntry, ...current]);

    queryClient.setQueryData(["routine", date], (old: any) => {
      const serverTask = {
        taskId: tempId,
        title,
        status: "NOT",
        durationMin: duration,
        createdAt: new Date().toISOString(),
      };
      if (!old) return { tasks: [serverTask] };
      const tasks = Array.isArray(old.tasks) ? old.tasks : [];
      return { ...old, tasks: [serverTask, ...tasks] };
    });

    const nextMap = { ...tagMap, [tempId]: tagChoice, [title]: tagChoice };
    setTagMap(nextMap);

    api.routine
      .addTask({ title, durationMin: duration, date })
      .then((res) => {
        if (res?.task?.taskId) {
          const actualId = res.task.taskId;
          setTodos((prev) =>
            prev.map((t) => (t.id === tempId ? { ...t, id: actualId } : t))
          );
          queryClient.setQueryData(["routine", date], (old: any) => {
            if (!old || !Array.isArray(old.tasks)) return old;
            return {
              ...old,
              tasks: old.tasks.map((t: any) =>
                t.taskId === tempId ? { ...t, taskId: actualId } : t
              ),
            };
          });
          const cleanedMap: Record<string, TodoTag> = { ...nextMap, [actualId]: tagChoice };
          delete cleanedMap[tempId];
          setTagMap(cleanedMap);
          AsyncStorage.setItem("door_mobile_tags_map", JSON.stringify(cleanedMap)).catch(() => {});
          AsyncStorage.removeItem(`door_todos_${date}`).catch(() => {});
        }
      })
      .catch(() => {
        AsyncStorage.setItem(`door_todos_${date}`, JSON.stringify([newEntry, ...todos])).catch(() => {});
      });

    setTimeout(() => setRecentlyAddedId(null), 4000);
    setTimeout(() => setToastText(null), 3000);
  };

  // Open Dialer for a Task
  const openDurationPicker = (task: PersonalTodo) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setEditingTask(task);
    setDialerMinutes(task.durationMin || 30);
  };

  // Adjust dialer time by step (10 minutes)
  const adjustDialerMinutes = (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setDialerMinutes((prev) => Math.max(10, Math.min(240, prev + delta)));
  };

  // Save Duration Change
  const handleSaveDuration = () => {
    if (!editingTask) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const targetId = editingTask.id;
    const newMinutes = dialerMinutes;

    setTodos((prev) =>
      prev.map((t) => (t.id === targetId ? { ...t, durationMin: newMinutes } : t))
    );
    setEditingTask(null);
    setToastText(`Updated time to ${newMinutes} mins`);
    setTimeout(() => setToastText(null), 2000);

    queryClient.setQueryData(["routine", date], (old: any) => {
      if (!old || !Array.isArray(old.tasks)) return old;
      return {
        ...old,
        tasks: old.tasks.map((t: any) =>
          t.taskId === targetId ? { ...t, durationMin: newMinutes } : t
        ),
      };
    });

    if (!targetId.startsWith("temp-")) {
      api.routine.updateTask(targetId, { durationMin: newMinutes }).catch(() => {});
    }
  };

  // Instant Optimistic Toggle
  const toggleTodo = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const target = todos.find((t) => t.id === id);
    const willBeCompleted = target ? !target.completed : false;

    const nextTodos = todos.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t));
    const willAllBeCompleted = willBeCompleted && nextTodos.length > 0 && nextTodos.every((t) => t.completed);

    if (willAllBeCompleted) {
      playAchievementCheer();
      setShowCelebration(true);
    } else {
      setShowCelebration(false);
    }

    setTodos(nextTodos);

    queryClient.setQueryData(["routine", date], (old: any) => {
      if (!old || !Array.isArray(old.tasks)) return old;
      return {
        ...old,
        tasks: old.tasks.map((t: any) =>
          t.taskId === id ? { ...t, status: willBeCompleted ? "COMPLETED" : "NOT" } : t
        ),
      };
    });
    AsyncStorage.setItem(`door_todos_${date}`, JSON.stringify(nextTodos)).catch(() => {});

    if (!id.startsWith("temp-")) {
      api.routine.updateTask(id, willBeCompleted ? "COMPLETED" : "NOT").catch(() => {});
    }
  };

  // Delete via Long Press
  const confirmDeleteTodo = (item: PersonalTodo) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    Alert.alert("Delete Task", item.text, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          const nextTodos = todos.filter((t) => t.id !== item.id);
          setTodos(nextTodos);
          setShowCelebration(false);

          queryClient.setQueryData(["routine", date], (old: any) => {
            if (!old || !Array.isArray(old.tasks)) return old;
            return {
              ...old,
              tasks: old.tasks.filter((t: any) => t.taskId !== item.id),
            };
          });
          AsyncStorage.setItem(`door_todos_${date}`, JSON.stringify(nextTodos)).catch(() => {});

          if (!item.id.startsWith("temp-")) {
            api.routine.deleteTask(item.id).catch(() => {});
          }
        },
      },
    ]);
  };

  const clearCompletedTodos = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setShowCelebration(false);
    const remaining = todos.filter((t) => !t.completed);
    const completedList = todos.filter((t) => t.completed);

    setTodos(remaining);
    queryClient.setQueryData(["routine", date], (old: any) => {
      if (!old || !Array.isArray(old.tasks)) return old;
      return {
        ...old,
        tasks: old.tasks.filter((t: any) => t.status !== "COMPLETED"),
      };
    });
    AsyncStorage.setItem(`door_todos_${date}`, JSON.stringify(remaining)).catch(() => {});

    completedList.forEach((t) => {
      if (!t.id.startsWith("temp-")) {
        api.routine.deleteTask(t.id).catch(() => {});
      }
    });
  };

  // Calculations
  const completedCount = todos.filter((t) => t.completed).length;
  const totalCount = todos.length;
  const pendingCount = totalCount - completedCount;
  const progressPercent = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;
  const nextPendingTask = todos.find((t) => !t.completed);

  return (
    <AppScreen
      title="Daily Focus"
      subtitle={new Intl.DateTimeFormat("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "short",
      }).format(new Date())}
      refreshing={routineQuery.isRefetching}
      onRefresh={routineQuery.refetch}
      action={
        <Pressable
          onPress={toggleTheme}
          style={({ pressed }) => [
            styles.themeSwitchButton,
            {
              backgroundColor: isDark ? "#16161a" : "#f1f5f9",
              borderColor: isDark ? "#27272a" : "#e2e8f0",
            },
            pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] },
          ]}
          hitSlop={8}
          accessibilityLabel="Toggle color theme"
        >
          <Ionicons
            name={isDark ? "sunny-outline" : "moon-outline"}
            size={14}
            color={isDark ? theme.amber : theme.text}
          />
          <Text style={[styles.themeSwitchText, { color: theme.text }]}>
            {isDark ? "Light" : "Dark"}
          </Text>
        </Pressable>
      }
      overlay={
        <>
          {showCelebration && (
            <FullScreenGlitterOverlay onComplete={() => setShowCelebration(false)} />
          )}

          {toastText ? (
            <View style={styles.toastWrapper} pointerEvents="none">
              <View
                style={[
                  styles.toastPill,
                  {
                    backgroundColor: isDark ? "#18181c" : "#0f172a",
                    borderColor: isDark ? "#27272a" : "#1e293b",
                  },
                ]}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={isDark ? "#18B887" : "#059669"}
                />
                <Text style={[styles.toastText, { color: isDark ? "#fafafa" : "#ffffff" }]}>
                  {toastText}
                </Text>
              </View>
            </View>
          ) : null}

          {/* 10-Minute Step Time Dialer Modal */}
          {editingTask && (
            <Modal
              transparent={true}
              animationType="fade"
              visible={!!editingTask}
              onRequestClose={() => setEditingTask(null)}
            >
              <View style={styles.modalOverlay}>
                <Pressable
                  style={StyleSheet.absoluteFill}
                  onPress={() => setEditingTask(null)}
                />
                <Card
                  style={[
                    styles.dialerCard,
                    {
                      backgroundColor: isDark ? "#141418" : "#ffffff",
                      borderColor: isDark ? "#24242A" : "#e2e8f0",
                    },
                  ]}
                >
                  <View style={styles.dialerHeader}>
                    <View style={{ gap: 3, flex: 1 }}>
                      <Text style={[styles.dialerTitle, { color: isDark ? "#F5F5F7" : theme.text }]}>
                        Target Duration
                      </Text>
                      <Text
                        style={[styles.dialerTaskName, { color: isDark ? "#A1A1AA" : theme.textMuted }]}
                        numberOfLines={1}
                      >
                        {editingTask.text}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => setEditingTask(null)}
                      hitSlop={8}
                      style={styles.dialerCloseBtn}
                    >
                      <Ionicons name="close" size={20} color={isDark ? "#71717A" : theme.textFaint} />
                    </Pressable>
                  </View>

                  {/* Big Number & 10m Stepper */}
                  <View style={styles.dialerDisplayRow}>
                    <Pressable
                      onPress={() => adjustDialerMinutes(-10)}
                      disabled={dialerMinutes <= 10}
                      style={({ pressed }) => [
                        styles.dialerStepBtn,
                        {
                          backgroundColor: isDark ? "#1E1E24" : "#f1f5f9",
                          borderColor: isDark ? "#2A2A32" : "#e2e8f0",
                          opacity: dialerMinutes <= 10 ? 0.35 : 1,
                        },
                        pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
                      ]}
                    >
                      <Text style={[styles.dialerStepBtnText, { color: isDark ? "#F5F5F7" : theme.text }]}>
                        −10m
                      </Text>
                    </Pressable>

                    <View style={styles.dialerCenterValue}>
                      <Text style={[styles.dialerBigNumber, { color: isDark ? "#38BDF8" : "#0284c7" }]}>
                        {dialerMinutes}
                      </Text>
                      <Text style={[styles.dialerUnitText, { color: isDark ? "#A1A1AA" : theme.textMuted }]}>
                        minutes
                      </Text>
                    </View>

                    <Pressable
                      onPress={() => adjustDialerMinutes(10)}
                      disabled={dialerMinutes >= 240}
                      style={({ pressed }) => [
                        styles.dialerStepBtn,
                        {
                          backgroundColor: isDark ? "#1E1E24" : "#f1f5f9",
                          borderColor: isDark ? "#2A2A32" : "#e2e8f0",
                          opacity: dialerMinutes >= 240 ? 0.35 : 1,
                        },
                        pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
                      ]}
                    >
                      <Text style={[styles.dialerStepBtnText, { color: isDark ? "#F5F5F7" : theme.text }]}>
                        +10m
                      </Text>
                    </Pressable>
                  </View>

                  {/* 10-Minute Presets Dial Strip */}
                  <View style={styles.presetStripRow}>
                    {DURATION_PRESETS.map((mins) => {
                      const active = dialerMinutes === mins;
                      return (
                        <Pressable
                          key={mins}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            setDialerMinutes(mins);
                          }}
                          style={[
                            styles.presetPill,
                            {
                              backgroundColor: active
                                ? isDark
                                  ? "rgba(56, 189, 248, 0.16)"
                                  : "rgba(2, 132, 199, 0.1)"
                                : isDark
                                ? "#1A1A20"
                                : "#f8fafc",
                              borderColor: active
                                ? isDark
                                  ? "#38BDF8"
                                  : "#0284c7"
                                : isDark
                                ? "#24242A"
                                : "#e2e8f0",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.presetPillText,
                              {
                                color: active
                                  ? isDark
                                    ? "#38BDF8"
                                    : "#0284c7"
                                  : isDark
                                  ? "#71717A"
                                  : theme.textFaint,
                                fontWeight: active ? "800" : "600",
                              },
                            ]}
                          >
                            {mins}m
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Save Button */}
                  <Pressable
                    onPress={handleSaveDuration}
                    style={({ pressed }) => [
                      styles.dialerSaveBtn,
                      {
                        backgroundColor: isDark ? "#38BDF8" : "#0284c7",
                      },
                      pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                    ]}
                  >
                    <Text style={styles.dialerSaveBtnText}>
                      Set Duration ({dialerMinutes} mins)
                    </Text>
                  </Pressable>
                </Card>
              </View>
            </Modal>
          )}
        </>
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.screenScrollContent}
      >
        {/* 1. High-Contrast Hero Progress Card */}
        <Card
          style={[
            styles.heroCard,
            {
              backgroundColor: isDark ? "#121215" : "#ffffff",
              borderColor: isDark ? "#202025" : "#e2e8f0",
            },
          ]}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.heroLeftBlock}>
              <Text style={[styles.heroLabel, { color: isDark ? "#71717A" : theme.textFaint }]}>
                TODAY'S PROGRESS
              </Text>
              <View style={styles.heroValueRow}>
                <Text
                  style={[
                    styles.heroPercent,
                    {
                      color:
                        progressPercent === 100
                          ? "#18B887"
                          : isDark
                          ? "#F5F5F7"
                          : theme.text,
                    },
                  ]}
                >
                  {progressPercent}%
                </Text>
                <Text style={[styles.heroCountSub, { color: isDark ? "#A1A1AA" : theme.textMuted }]}>
                  ({completedCount}/{totalCount} done)
                </Text>
              </View>
            </View>

            {/* Real Status Badge (No Mock Data) */}
            <View
              style={[
                styles.heroStatusBadge,
                {
                  backgroundColor: isDark
                    ? progressPercent === 100
                      ? "rgba(24, 184, 135, 0.14)"
                      : "#1A1A20"
                    : progressPercent === 100
                    ? "rgba(5, 150, 105, 0.12)"
                    : "#f1f5f9",
                  borderColor: isDark
                    ? progressPercent === 100
                      ? "#18B887"
                      : "#27272A"
                    : progressPercent === 100
                    ? "#18B887"
                    : "#e2e8f0",
                },
              ]}
            >
              <Ionicons
                name={progressPercent === 100 ? "checkmark-circle" : "time-outline"}
                color={progressPercent === 100 ? "#18B887" : theme.amber}
                size={14}
              />
              <Text
                style={[
                  styles.heroStatusText,
                  {
                    color:
                      progressPercent === 100
                        ? "#18B887"
                        : isDark
                        ? "#F5F5F7"
                        : theme.text,
                  },
                ]}
              >
                {progressPercent === 100 ? "All completed" : `${pendingCount} remaining`}
              </Text>
            </View>
          </View>

          {/* High-Contrast Progress Fill */}
          <ProgressBar
            value={progressPercent}
            height={5.5}
            tone={
              progressPercent === 100
                ? "#18B887"
                : progressPercent >= 50
                ? isDark
                  ? "#38BDF8"
                  : "#0284c7"
                : "#F59E0B"
            }
          />

          {/* Clean Next Focus Section (No Quotes, Dedicated Hierarchy) */}
          <View style={styles.nextFocusContainer}>
            {progressPercent === 100 ? (
              <View style={styles.nextFocusRow}>
                <Ionicons name="sparkles" size={13} color="#18B887" />
                <Text style={[styles.nextFocusDoneText, { color: isDark ? "#A1A1AA" : theme.textMuted }]}>
                  All targets completed for today. Solid work!
                </Text>
              </View>
            ) : nextPendingTask ? (
              <View style={styles.nextFocusRow}>
                <Text style={[styles.nextFocusLabel, { color: isDark ? "#71717A" : theme.textFaint }]}>
                  Next up:
                </Text>
                <Text
                  style={[styles.nextFocusTitle, { color: isDark ? "#F5F5F7" : theme.text }]}
                  numberOfLines={1}
                >
                  {nextPendingTask.text}
                </Text>
              </View>
            ) : (
              <Text style={[styles.nextFocusMutedText, { color: isDark ? "#A1A1AA" : theme.textMuted }]}>
                Small, honest daily actions compound into huge breakthroughs.
              </Text>
            )}
          </View>
        </Card>

        {/* 2. Clean Task Checklist Section */}
        <View style={styles.todoSection}>
          <SectionTitle
            title="Today's Tasks"
            trailing={
              <Pressable
                onPress={toggleAddCard}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.addPillButton,
                  {
                    backgroundColor: isDark ? "#16161A" : "#f1f5f9",
                    borderColor: isDark ? "#24242A" : "#e2e8f0",
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons
                  name={showAddCard ? "close" : "add"}
                  size={15}
                  color={isDark ? "#FAFBFD" : "#0f172a"}
                />
                <Text
                  style={[
                    styles.addPillText,
                    { color: isDark ? "#FAFBFD" : "#0f172a" },
                  ]}
                >
                  {showAddCard ? "Cancel" : "Add task"}
                </Text>
              </Pressable>
            }
          />

          {/* Inline Quick Add */}
          {showAddCard && (
            <Card
              style={[
                styles.inlineAddCard,
                {
                  backgroundColor: isDark ? "#141418" : "#ffffff",
                  borderColor: isDark ? "#24242A" : "#e2e8f0",
                },
              ]}
            >
              <View
                style={[
                  styles.inputRowContainer,
                  {
                    backgroundColor: isDark ? "#09090b" : "#f8fafc",
                    borderColor: newTodoText.trim()
                      ? isDark
                        ? "#3f3f46"
                        : "#94a3b8"
                      : isDark
                      ? "#24242A"
                      : "#e2e8f0",
                  },
                ]}
              >
                <TextInput
                  style={[styles.inlineAddInput, { color: isDark ? "#F5F5F7" : theme.text }]}
                  value={newTodoText}
                  onChangeText={setNewTodoText}
                  placeholder="What do you need to focus on?"
                  placeholderTextColor={isDark ? "#71717A" : theme.textFaint}
                  autoFocus={true}
                  autoCapitalize="sentences"
                  returnKeyType="done"
                  onSubmitEditing={handleSaveNewTodo}
                />

                <Pressable
                  onPress={handleSaveNewTodo}
                  disabled={!newTodoText.trim()}
                  style={({ pressed }) => [
                    styles.inputDoneButton,
                    newTodoText.trim()
                      ? {
                          backgroundColor: isDark ? "#27272a" : "#1e293b",
                          borderColor: isDark ? "#3f3f46" : "#0f172a",
                        }
                      : {
                          backgroundColor: isDark ? "#141418" : "#f1f5f9",
                          borderColor: isDark ? "#24242A" : "#e2e8f0",
                          opacity: 0.35,
                        },
                    pressed && { opacity: 0.75, transform: [{ scale: 0.94 }] },
                  ]}
                >
                  <Ionicons
                    name="checkmark"
                    size={16}
                    color={
                      newTodoText.trim()
                        ? isDark
                          ? "#fafafa"
                          : "#ffffff"
                        : theme.textFaint
                    }
                  />
                </Pressable>
              </View>

              {/* Tag Selection (Clean, NO parentheses or hardcoded min) */}
              <View style={styles.inlineTagRow}>
                {(["GATE", "Quick", "College", "Personal"] as const).map((t) => {
                  const active = selectedTag === t;
                  const cfg = TAG_CONFIG[t];
                  return (
                    <Pressable
                      key={t}
                      onPress={() => handleTagSelect(t)}
                      style={[
                        styles.inlineTagChip,
                        {
                          backgroundColor: active
                            ? isDark
                              ? cfg.bg
                              : cfg.bg
                            : isDark
                            ? "#18181D"
                            : "#f8fafc",
                          borderColor: active
                            ? cfg.color
                            : isDark
                            ? "#24242A"
                            : "#e2e8f0",
                        },
                      ]}
                    >
                      <Ionicons
                        name={cfg.icon}
                        size={12}
                        color={active ? cfg.color : isDark ? "#71717A" : theme.textFaint}
                      />
                      <Text
                        style={[
                          styles.inlineTagText,
                          { color: active ? cfg.color : isDark ? "#A1A1AA" : theme.textMuted },
                          active && { fontWeight: "800" },
                        ]}
                        numberOfLines={1}
                      >
                        {cfg.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Quick Duration Dropdown / Selector for Add Form */}
              <View style={styles.addDurationRow}>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setShowAddDurationDropdown((prev) => !prev);
                  }}
                  style={[
                    styles.addDurationTrigger,
                    {
                      backgroundColor: isDark ? "#18181D" : "#f8fafc",
                      borderColor: isDark ? "#2A2A32" : "#e2e8f0",
                    },
                  ]}
                >
                  <Ionicons
                    name="time-outline"
                    size={12}
                    color={isDark ? "#38BDF8" : "#0284c7"}
                  />
                  <Text style={[styles.addDurationTriggerText, { color: isDark ? "#F5F5F7" : theme.text }]}>
                    Duration: {customDuration} min
                  </Text>
                  <Ionicons
                    name={showAddDurationDropdown ? "chevron-up" : "chevron-down"}
                    size={12}
                    color={isDark ? "#71717A" : theme.textFaint}
                  />
                </Pressable>

                {showAddDurationDropdown && (
                  <View style={styles.addDurationOptionsStrip}>
                    {DURATION_PRESETS.map((m) => {
                      const active = customDuration === m;
                      return (
                        <Pressable
                          key={m}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            setCustomDuration(m);
                            setShowAddDurationDropdown(false);
                          }}
                          style={[
                            styles.durationOptionPill,
                            {
                              backgroundColor: active
                                ? isDark
                                  ? "rgba(56, 189, 248, 0.18)"
                                  : "rgba(2, 132, 199, 0.12)"
                                : isDark
                                ? "#1A1A20"
                                : "#f1f5f9",
                              borderColor: active
                                ? isDark
                                  ? "#38BDF8"
                                  : "#0284c7"
                                : isDark
                                ? "#24242A"
                                : "#e2e8f0",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.durationOptionText,
                              {
                                color: active
                                  ? isDark
                                    ? "#38BDF8"
                                    : "#0284c7"
                                  : isDark
                                  ? "#A1A1AA"
                                  : theme.textMuted,
                                fontWeight: active ? "800" : "600",
                              },
                            ]}
                          >
                            {m}m
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            </Card>
          )}

          {/* List of Tasks */}
          <View style={styles.todoList}>
            {todos.length === 0 && !routineQuery.isLoading && (
              <View
                style={[
                  styles.emptyStateCard,
                  {
                    backgroundColor: isDark ? "#121215" : "#ffffff",
                    borderColor: isDark ? "#202025" : "#e2e8f0",
                  },
                ]}
              >
                <Ionicons
                  name="checkmark-done-outline"
                  size={20}
                  color={isDark ? "#71717a" : "#94a3b8"}
                />
                <Text style={[styles.emptyStateText, { color: isDark ? "#A1A1AA" : theme.textMuted }]}>
                  No tasks set for today · Tap "+ Add task" to plan.
                </Text>
              </View>
            )}

            {todos.map((item) => {
              const tagCfg = TAG_CONFIG[item.tag] || TAG_CONFIG.GATE;
              const isJustAdded = item.id === recentlyAddedId;
              const duration = item.durationMin || DEFAULT_DURATIONS[item.tag] || 30;

              return (
                <Pressable
                  key={item.id}
                  onPress={() => toggleTodo(item.id)}
                  onLongPress={() => confirmDeleteTodo(item)}
                  delayLongPress={400}
                  style={({ pressed }) => [
                    styles.todoRow,
                    {
                      backgroundColor: isDark ? "#121215" : "#ffffff",
                      borderColor: isDark ? "#202025" : "#e2e8f0",
                    },
                    isJustAdded && {
                      borderColor: isDark ? "rgba(56, 189, 248, 0.5)" : "rgba(2, 132, 199, 0.4)",
                      backgroundColor: isDark ? "rgba(56, 189, 248, 0.06)" : "rgba(238, 242, 255, 0.4)",
                    },
                    item.completed && {
                      backgroundColor: isDark ? "#0d0d0f" : "#f8fafc",
                      borderColor: isDark ? "#1a1a1e" : "#f1f5f9",
                      opacity: 0.6,
                    },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  {/* Apple Style Smooth Circular Checkbox */}
                  <View
                    style={[
                      styles.checkCircle,
                      {
                        borderColor: isDark ? "#3f3f46" : "#cbd5e1",
                      },
                      item.completed && {
                        borderColor: "#18B887",
                        backgroundColor: "#18B887",
                      },
                    ]}
                  >
                    {item.completed && <Ionicons name="checkmark" size={14} color="#ffffff" />}
                  </View>

                  {/* To-Do Content */}
                  <View style={styles.todoCopy}>
                    <Text
                      style={[
                        styles.todoTitle,
                        { color: isDark ? "#F5F5F7" : theme.text },
                        item.completed && [
                          styles.todoTitleCompleted,
                          { color: isDark ? "#71717A" : theme.textFaint, textDecorationColor: "#18B887" },
                        ],
                      ]}
                    >
                      {item.text}
                    </Text>

                    <View style={styles.todoMetaRow}>
                      <View
                        style={[
                          styles.metaTagBadge,
                          {
                            backgroundColor: tagCfg.bg,
                            borderColor: `${tagCfg.color}35`,
                          },
                        ]}
                      >
                        <Ionicons name={tagCfg.icon} size={10} color={tagCfg.color} />
                        <Text style={[styles.metaTagText, { color: tagCfg.color }]}>
                          {tagCfg.label}
                        </Text>
                      </View>

                      {/* Interactive Time Badge (Opens 10m Step Dialer — Does NOT toggle task) */}
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          openDurationPicker(item);
                        }}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        style={({ pressed }) => [
                          styles.durationInteractiveBadge,
                          {
                            backgroundColor: isDark ? "#18181D" : "#f1f5f9",
                            borderColor: isJustAdded
                              ? isDark
                                ? "#38BDF8"
                                : "#0284c7"
                              : isDark
                              ? "#2A2A32"
                              : "#e2e8f0",
                          },
                          pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] },
                        ]}
                      >
                        <Ionicons
                          name="time-outline"
                          size={11}
                          color={isDark ? "#38BDF8" : "#0284c7"}
                        />
                        <Text
                          style={[
                            styles.durationInteractiveText,
                            { color: isDark ? "#F5F5F7" : theme.text },
                          ]}
                        >
                          {duration}m
                        </Text>
                        <Ionicons
                          name="chevron-down"
                          size={9}
                          color={isDark ? "#71717A" : theme.textFaint}
                        />
                      </Pressable>

                      {/* Helpful Hint on Recently Added Task */}
                      {isJustAdded && (
                        <View style={styles.hintPointingBadge}>
                          <Ionicons name="arrow-back" size={10} color={isDark ? "#38BDF8" : "#0284c7"} />
                          <Text style={[styles.hintPointingText, { color: isDark ? "#38BDF8" : "#0284c7" }]}>
                            Tap time to change
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {completedCount > 0 && (
            <View style={styles.clearContainer}>
              <Pressable
                onPress={clearCompletedTodos}
                style={({ pressed }) => [styles.clearButton, pressed && { opacity: 0.7 }]}
              >
                <Text style={[styles.clearButtonText, { color: isDark ? "#71717A" : theme.textFaint }]}>
                  Clear {completedCount} completed {completedCount === 1 ? "task" : "tasks"}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  themeSwitchButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  themeSwitchText: {
    fontSize: 12,
    fontWeight: "700",
  },
  screenScrollContent: {
    gap: 16,
    paddingBottom: 90,
  },

  // Hero Card
  heroCard: {
    padding: 16,
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  heroLeftBlock: {
    gap: 2,
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  heroValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  heroPercent: {
    fontSize: 34,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  heroCountSub: {
    fontSize: 12,
    fontWeight: "600",
  },
  heroStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  heroStatusText: {
    fontSize: 12,
    fontWeight: "800",
  },
  nextFocusContainer: {
    paddingTop: 2,
  },
  nextFocusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  nextFocusLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  nextFocusTitle: {
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  nextFocusDoneText: {
    fontSize: 12.5,
    fontWeight: "500",
  },
  nextFocusMutedText: {
    fontSize: 12,
    lineHeight: 17,
  },

  // To-Do Section
  todoSection: {
    gap: 10,
    marginTop: 2,
  },
  addPillButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  addPillText: {
    fontSize: 11.5,
    fontWeight: "800",
  },

  // Instant Inline Quick Add
  inlineAddCard: {
    padding: 12,
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    width: "100%",
  },
  inputRowContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingLeft: 12,
    paddingRight: 6,
    height: 44,
    width: "100%",
    alignSelf: "stretch",
    overflow: "hidden",
    gap: 8,
  },
  inlineAddInput: {
    flex: 1,
    width: 0,
    minWidth: 0,
    height: 44,
    fontSize: 13.5,
    paddingVertical: 0,
    paddingRight: 4,
  },
  inputDoneButton: {
    width: 32,
    height: 32,
    flexShrink: 0,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  inlineTagRow: {
    flexDirection: "row",
    gap: 6,
  },
  inlineTagChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  inlineTagText: {
    fontSize: 11,
    fontWeight: "600",
  },
  addDurationRow: {
    gap: 6,
  },
  addDurationTrigger: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  addDurationTriggerText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  addDurationOptionsStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingTop: 2,
  },
  durationOptionPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  durationOptionText: {
    fontSize: 11,
  },

  todoList: {
    gap: 8,
  },
  todoRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    gap: 12,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  todoCopy: {
    flex: 1,
    gap: 4,
  },
  todoTitle: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 19,
  },
  todoTitleCompleted: {
    textDecorationLine: "line-through",
  },
  todoMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaTagBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  metaTagText: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  durationInteractiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  durationInteractiveText: {
    fontSize: 11,
    fontWeight: "700",
  },
  hintPointingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  hintPointingText: {
    fontSize: 10,
    fontWeight: "700",
  },

  clearContainer: {
    alignItems: "center",
    paddingVertical: 4,
  },
  clearButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  clearButtonText: {
    fontSize: 11.5,
    fontWeight: "600",
  },

  // Floating Toast Pill
  toastWrapper: {
    position: "absolute",
    bottom: 92,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  toastPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: "#000000",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  toastText: {
    fontSize: 13,
    fontWeight: "700",
  },
  emptyStateCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    marginTop: 10,
  },
  emptyStateText: {
    fontSize: 13,
    fontWeight: "500",
  },

  // Modal Overlay & Time Dialer
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    zIndex: 10000,
  },
  dialerCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    gap: 18,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  dialerHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  dialerTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  dialerTaskName: {
    fontSize: 13,
    fontWeight: "500",
  },
  dialerCloseBtn: {
    padding: 2,
  },
  dialerDisplayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  dialerStepBtn: {
    width: 60,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dialerStepBtnText: {
    fontSize: 13.5,
    fontWeight: "800",
  },
  dialerCenterValue: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  dialerBigNumber: {
    fontSize: 46,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  dialerUnitText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  presetStripRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
  },
  presetPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  presetPillText: {
    fontSize: 12,
  },
  dialerSaveBtn: {
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  dialerSaveBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
});
