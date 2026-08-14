import { useEffect, useMemo, useState } from "react";
import {
  BackHandler,
  Pressable,
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
  createdAt: number;
}

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

  // Distinct & Harmonious Tag System (Mobile-Only UI)
  const TAG_CONFIG: Record<TodoTag, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = useMemo(
    () => ({
      GATE: { label: "GATE", color: isDark ? "#38bdf8" : "#0284c7", icon: "school-outline" },
      Quick: { label: "Quick", color: theme.amber, icon: "cafe-outline" },
      College: { label: "College", color: isDark ? "#fb7185" : "#e11d48", icon: "book-outline" },
      Personal: { label: "Personal", color: theme.cyan, icon: "leaf-outline" },
    }),
    [theme, isDark]
  );

  // --- State ---
  const [todos, setTodos] = useState<PersonalTodo[]>([]);
  const [tagMap, setTagMap] = useState<Record<string, TodoTag>>({});
  const [showAddCard, setShowAddCard] = useState(false);
  const [newTodoText, setNewTodoText] = useState("");
  const [selectedTag, setSelectedTag] = useState<TodoTag>("GATE");
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);
  const [toastText, setToastText] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  // Pre-load audio instance on mount for zero-latency instant playback
  useEffect(() => {
    setupAudio();
    Audio.Sound.createAsync(
      require("@/assets/sounds/cheer.mp3"),
      { shouldPlay: false, volume: 1.0 }
    ).then(({ sound }) => {
      cheerSoundObject = sound;
    }).catch(() => {});

    // Load mobile-only tags mapping
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

  // Sync with Desktop Plan via Backend Routine Query
  const routineQuery = useQuery({
    queryKey: ["routine", date],
    queryFn: () => api.routine.today(date),
    staleTime: 10_000,
  });

  // Sync backend tasks with mobile UI
  useEffect(() => {
    if (routineQuery.data && Array.isArray(routineQuery.data.tasks)) {
      const serverTasks: PersonalTodo[] = routineQuery.data.tasks.map((task: any, index: number) => {
        const localTag = tagMap[task.taskId] || tagMap[task.title] || (index === 0 ? "GATE" : "Quick");
        return {
          id: task.taskId,
          text: task.title,
          completed: task.status === "COMPLETED",
          tag: localTag as TodoTag,
          createdAt: task.createdAt ? new Date(task.createdAt).getTime() : Date.now(),
        };
      });
      setTodos(serverTasks);
    } else if (!routineQuery.isLoading && !routineQuery.data) {
      // Fallback to local cache if no plan exists
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

  // Handle Android Back Button to close add box
  useEffect(() => {
    if (!showAddCard) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setShowAddCard(false);
      return true;
    });
    return () => sub.remove();
  }, [showAddCard]);

  const toggleAddCard = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!showAddCard) {
      setNewTodoText("");
      setSelectedTag("GATE");
    }
    setShowAddCard((prev) => !prev);
  };

  const handleSaveNewTodo = async () => {
    if (!newTodoText.trim()) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const title = newTodoText.trim();
    const tempId = `todo-${Date.now()}`;
    const tagChoice = selectedTag;

    const newEntry: PersonalTodo = {
      id: tempId,
      text: title,
      completed: false,
      tag: tagChoice,
      createdAt: Date.now(),
    };

    // Optimistic mobile update
    setTodos((current) => [newEntry, ...current]);
    setRecentlyAddedId(tempId);
    setToastText(`Task added to ${tagChoice}`);
    setNewTodoText("");
    setShowAddCard(false);

    // Save mobile-only tag mapping
    const nextMap = { ...tagMap, [tempId]: tagChoice, [title]: tagChoice };
    setTagMap(nextMap);
    AsyncStorage.setItem("door_mobile_tags_map", JSON.stringify(nextMap)).catch(() => {});

    // Sync to Desktop Plan backend
    try {
      const res = await api.routine.addTask({ title, date });
      if (res?.task?.taskId) {
        const actualId = res.task.taskId;
        const updatedMap = { ...nextMap, [actualId]: tagChoice };
        setTagMap(updatedMap);
        AsyncStorage.setItem("door_mobile_tags_map", JSON.stringify(updatedMap)).catch(() => {});
        queryClient.invalidateQueries({ queryKey: ["routine", date] });
      }
    } catch {
      // Local fallback cached
      AsyncStorage.setItem(`door_todos_${date}`, JSON.stringify([newEntry, ...todos])).catch(() => {});
    }

    setTimeout(() => setRecentlyAddedId(null), 2200);
    setTimeout(() => setToastText(null), 2200);
  };

  const toggleTodo = async (id: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const target = todos.find((t) => t.id === id);
    const willBeCompleted = target ? !target.completed : false;

    const nextTodos = todos.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t));
    const willAllBeCompleted = willBeCompleted && nextTodos.length > 0 && nextTodos.every((t) => t.completed);

    if (willAllBeCompleted) {
      playAchievementCheer();
      setShowCelebration(true);
    }

    setTodos(nextTodos);

    // Sync with backend / desktop plan
    try {
      await api.routine.updateTask(id, willBeCompleted ? "COMPLETED" : "NOT");
      queryClient.invalidateQueries({ queryKey: ["routine", date] });
    } catch {
      AsyncStorage.setItem(`door_todos_${date}`, JSON.stringify(nextTodos)).catch(() => {});
    }
  };

  const deleteTodo = async (id: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTodos((current) => current.filter((t) => t.id !== id));

    try {
      await api.routine.deleteTask(id);
      queryClient.invalidateQueries({ queryKey: ["routine", date] });
    } catch {
      AsyncStorage.setItem(`door_todos_${date}`, JSON.stringify(todos.filter((t) => t.id !== id))).catch(() => {});
    }
  };

  const clearCompletedTodos = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const remaining = todos.filter((t) => !t.completed);
    const completedList = todos.filter((t) => t.completed);
    setTodos(remaining);

    // Sync deletes with backend
    completedList.forEach((t) => {
      api.routine.deleteTask(t.id).catch(() => {});
    });
    queryClient.invalidateQueries({ queryKey: ["routine", date] });
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
        >
          <Ionicons
            name={isDark ? "sunny-outline" : "moon-outline"}
            size={16}
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
                  color={isDark ? "#fbbf24" : "#d97706"}
                />
                <Text style={[styles.toastText, { color: isDark ? "#fafafa" : "#ffffff" }]}>
                  {toastText}
                </Text>
              </View>
            </View>
          ) : null}
        </>
      }
    >
      {/* 1. Spacious Hero Progress Card */}
      <Card
        style={[
          styles.heroCard,
          {
            backgroundColor: isDark ? "#121215" : "#ffffff",
            borderColor: isDark ? "#27272a" : "#e2e8f0",
          },
        ]}
      >
        <View style={styles.heroTopRow}>
          <View style={styles.heroLeftBlock}>
            <Text style={[styles.heroLabel, { color: theme.textFaint }]}>TODAY'S PROGRESS</Text>
            <View style={styles.heroValueRow}>
              <Text style={[styles.heroPercent, { color: progressPercent === 100 ? theme.emerald : theme.text }]}>
                {progressPercent}%
              </Text>
              <Text style={[styles.heroCountSub, { color: theme.textMuted }]}>
                ({completedCount}/{totalCount} done)
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.heroStatusBadge,
              {
                backgroundColor: isDark
                  ? progressPercent === 100
                    ? "rgba(16, 185, 129, 0.16)"
                    : "#1a1a20"
                  : progressPercent === 100
                  ? "rgba(5, 150, 105, 0.12)"
                  : "#f1f5f9",
                borderColor: isDark
                  ? progressPercent === 100
                    ? theme.emerald
                    : "#27272a"
                  : progressPercent === 100
                  ? theme.emerald
                  : "#e2e8f0",
              },
            ]}
          >
            <Ionicons
              name={progressPercent === 100 ? "checkmark-circle" : "time-outline"}
              color={progressPercent === 100 ? theme.emerald : theme.amber}
              size={16}
            />
            <Text
              style={[
                styles.heroStatusText,
                { color: progressPercent === 100 ? theme.emerald : theme.text },
              ]}
            >
              {progressPercent === 100 ? "All completed!" : `${pendingCount} remaining`}
            </Text>
          </View>
        </View>

        <ProgressBar
          value={progressPercent}
          tone={progressPercent === 100 ? theme.emerald : progressPercent >= 60 ? (isDark ? "#38bdf8" : "#0284c7") : theme.amber}
        />

        <Text style={[styles.heroMessage, { color: theme.textMuted }]}>
          {progressPercent === 100
            ? "All tasks completed for today."
            : nextPendingTask
            ? `Next focus: "${nextPendingTask.text}"`
            : "Small, honest daily actions compound into huge breakthroughs."}
        </Text>
      </Card>

      {/* 2. Clean Task Checklist Section */}
      <View style={styles.todoSection}>
        <SectionTitle
          title="Today's Tasks"
          trailing={
            <Pressable
              onPress={toggleAddCard}
              style={({ pressed }) => [
                styles.addPillButton,
                {
                  backgroundColor: isDark ? "#18181c" : "#f1f5f9",
                  borderColor: isDark ? "#27272a" : "#e2e8f0",
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons
                name={showAddCard ? "close" : "add"}
                size={16}
                color={isDark ? "#fafafa" : "#0f172a"}
              />
              <Text
                style={[
                  styles.addPillText,
                  { color: isDark ? "#fafafa" : "#0f172a" },
                ]}
              >
                {showAddCard ? "Cancel" : "Add task"}
              </Text>
            </Pressable>
          }
        />

        {/* Ultra-Fast Instant Inline Quick Add (Zero Delay, 0ms Keyboard Lag) */}
        {showAddCard && (
          <Card
            style={[
              styles.inlineAddCard,
              {
                backgroundColor: isDark ? "#141418" : "#ffffff",
                borderColor: isDark ? "#27272a" : "#e2e8f0",
              },
            ]}
          >
            {/* Input Row with trailing Done icon button */}
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
                    ? "#27272a"
                    : "#e2e8f0",
                },
              ]}
            >
              <TextInput
                style={[styles.inlineAddInput, { color: theme.text }]}
                value={newTodoText}
                onChangeText={setNewTodoText}
                placeholder="What do you need to focus on?"
                placeholderTextColor={theme.textFaint}
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
                        borderColor: isDark ? "#27272a" : "#e2e8f0",
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

            {/* Category Tags (Mobile-Only) */}
            <View style={styles.inlineTagRow}>
              {(["GATE", "Quick", "College", "Personal"] as const).map((t) => {
                const active = selectedTag === t;
                const cfg = TAG_CONFIG[t];
                return (
                  <Pressable
                    key={t}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedTag(t);
                    }}
                    style={[
                      styles.inlineTagChip,
                      {
                        backgroundColor: isDark ? "#1a1a20" : "#f8fafc",
                        borderColor: isDark ? "#27272a" : "#e2e8f0",
                      },
                      active && {
                        backgroundColor: isDark ? `${cfg.color}25` : `${cfg.color}15`,
                        borderColor: cfg.color,
                      },
                    ]}
                  >
                    <Ionicons
                      name={cfg.icon}
                      size={12}
                      color={active ? cfg.color : theme.textFaint}
                    />
                    <Text
                      style={[
                        styles.inlineTagText,
                        { color: active ? cfg.color : theme.textFaint },
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
          </Card>
        )}

        {/* List of Tasks */}
        <View style={styles.todoList}>
          {todos.length === 0 && !routineQuery.isLoading && (
            <View
              style={[
                styles.emptyTasksCard,
                {
                  backgroundColor: isDark ? "#121215" : "#ffffff",
                  borderColor: isDark ? "#27272a" : "#e2e8f0",
                },
              ]}
            >
              <Ionicons
                name="checkmark-done-circle-outline"
                size={34}
                color={isDark ? "#3f3f46" : "#94a3b8"}
              />
              <Text style={[styles.emptyTasksTitle, { color: theme.text }]}>
                No tasks scheduled for today
              </Text>
              <Text style={[styles.emptyTasksSub, { color: theme.textFaint }]}>
                Tap "+ Add task" above to start your daily focus.
              </Text>
            </View>
          )}

          {todos.map((item) => {
            const tagCfg = TAG_CONFIG[item.tag] || TAG_CONFIG.GATE;
            const isJustAdded = item.id === recentlyAddedId;
            return (
              <Pressable
                key={item.id}
                onPress={() => toggleTodo(item.id)}
                style={({ pressed }) => [
                  styles.todoRow,
                  {
                    backgroundColor: isDark ? "#121215" : "#ffffff",
                    borderColor: isDark ? "#27272a" : "#e2e8f0",
                  },
                  isJustAdded && {
                    borderColor: isDark ? "rgba(251, 191, 36, 0.45)" : "rgba(217, 119, 6, 0.35)",
                    backgroundColor: isDark ? "rgba(251, 191, 36, 0.05)" : "rgba(254, 243, 199, 0.35)",
                  },
                  item.completed && {
                    backgroundColor: isDark ? "#0d0d0f" : "#f8fafc",
                    borderColor: isDark ? "#1f1f23" : "#f1f5f9",
                    opacity: 0.65,
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
                      borderColor: theme.emerald,
                      backgroundColor: theme.emerald,
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
                      { color: theme.text },
                      item.completed && [
                        styles.todoTitleCompleted,
                        { color: theme.textFaint, textDecorationColor: theme.emerald },
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
                          backgroundColor: `${tagCfg.color}15`,
                          borderColor: `${tagCfg.color}35`,
                        },
                      ]}
                    >
                      <Ionicons name={tagCfg.icon} size={10} color={tagCfg.color} />
                      <Text style={[styles.metaTagText, { color: tagCfg.color }]}>
                        {tagCfg.label}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Delete Button */}
                <Pressable
                  hitSlop={10}
                  onPress={(e) => {
                    e.stopPropagation();
                    deleteTodo(item.id);
                  }}
                  style={styles.deleteIconButton}
                >
                  <Ionicons name="close-circle-outline" size={18} color={theme.textFaint} />
                </Pressable>
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
              <Text style={[styles.clearButtonText, { color: theme.textFaint }]}>
                Clear {completedCount} completed {completedCount === 1 ? "task" : "tasks"}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
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
    letterSpacing: 1,
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
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  heroStatusText: {
    fontSize: 12,
    fontWeight: "800",
  },
  heroMessage: {
    fontSize: 12,
    lineHeight: 17,
  },

  // To-Do Section
  todoSection: {
    gap: 10,
    marginTop: 4,
  },
  addPillButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  addPillText: {
    fontSize: 11,
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
    fontSize: 14,
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
    gap: 5,
  },
  inlineTagChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 4,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  inlineTagText: {
    fontSize: 10,
    fontWeight: "700",
  },

  todoList: {
    gap: 8,
  },
  todoRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingVertical: 13,
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
    fontWeight: "700",
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
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  deleteIconButton: {
    padding: 4,
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
    fontSize: 11,
    fontWeight: "700",
  },

  // Floating Toast Pill Confirmation
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
  emptyTasksCard: {
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyTasksTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  emptyTasksSub: {
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
  },
});
