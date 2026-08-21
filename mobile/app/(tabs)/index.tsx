import React, { useEffect, useMemo, useState } from "react";
import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { Ionicons } from "@expo/vector-icons";
import { AppScreen } from "@/src/components/screen";
import { SectionTitle } from "@/src/components/ui";
import { FullScreenGlitterOverlay } from "@/src/components/glitter-overlay";
import {
  DurationDialerModal,
} from "@/src/components/today/DurationDialerModal";
import {
  TodayProgressCard,
} from "@/src/components/today/TodayProgressCard";
import {
  TagConfigItem,
  TodayAddTaskForm,
  TodoTag,
} from "@/src/components/today/TodayAddTaskForm";
import {
  PersonalTodoItem,
  TodayTaskItem,
} from "@/src/components/today/TodayTaskItem";
import { todayInKolkata } from "@/src/lib/format";
import { api } from "@/src/services/api";
import { useTheme } from "@/src/providers/theme-provider";
import { useNotify } from "@/src/providers/notification-provider";
import { useAuth } from "@/src/providers/auth-provider";
import { fontWeights, radii, shadows, spacing, typography } from "@/src/theme/tokens";

const DEFAULT_DURATIONS: Record<TodoTag, number> = {
  GATE: 45,
  College: 30,
  Personal: 15,
};

async function setupAudio() {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: "duckOthers",
      shouldRouteThroughEarpiece: false,
    });
  } catch {}
}

export default function TodayScreen() {
  const date = todayInKolkata();
  const queryClient = useQueryClient();
  const { unlocked } = useAuth();
  const notify = useNotify();
  const { theme, isDark, toggleTheme } = useTheme();
  const cheerPlayer = useAudioPlayer(require("@/assets/sounds/cheer.mp3"));

  // Harmonious Tag Visual Tokens
  const TAG_CONFIG: Record<TodoTag, TagConfigItem> = useMemo(
    () => ({
      GATE: {
        label: "GATE",
        color: isDark ? theme.cyan : "#0284c7",
        bg: isDark ? "rgba(6, 182, 212, 0.12)" : "rgba(2, 132, 199, 0.08)",
        icon: "school-outline",
      },
      College: {
        label: "College",
        color: isDark ? theme.rose : "#e11d48",
        bg: isDark ? "rgba(244, 63, 94, 0.12)" : "rgba(225, 29, 72, 0.08)",
        icon: "book-outline",
      },
      Personal: {
        label: "Personal",
        color: isDark ? theme.emerald : "#059669",
        bg: isDark ? "rgba(16, 185, 129, 0.12)" : "rgba(5, 150, 105, 0.08)",
        icon: "leaf-outline",
      },
    }),
    [isDark, theme]
  );

  // --- State ---
  const [todos, setTodos] = useState<PersonalTodoItem[]>([]);
  const [tagMap, setTagMap] = useState<Record<string, TodoTag>>({});
  const [showAddCard, setShowAddCard] = useState(false);
  const [newTodoText, setNewTodoText] = useState("");
  const [selectedTag, setSelectedTag] = useState<TodoTag>("GATE");
  const [customDuration, setCustomDuration] = useState<number>(45);

  // Wheel Dialer State
  const [editingTask, setEditingTask] = useState<PersonalTodoItem | null>(null);
  const [isAddingDurationDialerOpen, setIsAddingDurationDialerOpen] = useState(false);

  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);
  const [toastText, setToastText] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  // Audio setup and cached tag map load
  useEffect(() => {
    void setupAudio();

    AsyncStorage.getItem("door_mobile_tags_map").then((res) => {
      if (res) {
        try {
          setTagMap(JSON.parse(res));
        } catch {}
      }
    });
  }, []);

  const playAchievementCheer = () => {
    void (async () => {
      try {
        await setupAudio();
        cheerPlayer.volume = 1;
        await cheerPlayer.seekTo(0);
        cheerPlayer.play();
      } catch {
        try {
          cheerPlayer.play();
        } catch {}
      }
    })();
  };

  // Sync with Backend Routine Query
  const routineQuery = useQuery({
    queryKey: ["routine", date],
    queryFn: () => api.routine.today(date),
    enabled: unlocked,
    staleTime: 10_000,
  });

  // Sync backend tasks with mobile state
  useEffect(() => {
    if (routineQuery.data && Array.isArray(routineQuery.data.tasks)) {
      const serverTasks: PersonalTodoItem[] = routineQuery.data.tasks.map(
        (task: any, index: number) => {
          const rawTag = (tagMap[task.taskId] ||
            tagMap[task.title] ||
            (index === 0 ? "GATE" : "College")) as string;
          const localTag: TodoTag =
            rawTag === "College" ? "College" : rawTag === "Personal" ? "Personal" : "GATE";
          return {
            id: task.taskId,
            text: task.title,
            completed: task.status === "COMPLETED",
            tag: localTag,
            durationMin: task.durationMin || DEFAULT_DURATIONS[localTag] || 30,
            createdAt: task.createdAt ? new Date(task.createdAt).getTime() : Date.now(),
          };
        }
      );
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
    if (!showAddCard && !editingTask && !isAddingDurationDialerOpen) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (editingTask) {
        setEditingTask(null);
        return true;
      }
      if (isAddingDurationDialerOpen) {
        setIsAddingDurationDialerOpen(false);
        return true;
      }
      if (showAddCard) {
        setShowAddCard(false);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [showAddCard, editingTask, isAddingDurationDialerOpen]);

  const toggleAddCard = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (!showAddCard) {
      setNewTodoText("");
      setSelectedTag("GATE");
      setCustomDuration(DEFAULT_DURATIONS.GATE);
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

    const newEntry: PersonalTodoItem = {
      id: tempId,
      text: title,
      completed: false,
      tag: tagChoice,
      durationMin: duration,
      createdAt: Date.now(),
    };

    setShowAddCard(false);
    setNewTodoText("");
    setShowCelebration(false);
    setRecentlyAddedId(tempId);
    setToastText(`Task added (${duration} min)`);
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

    setTimeout(() => setRecentlyAddedId(null), 3000);
    setTimeout(() => setToastText(null), 2500);
  };

  // Open Duration Dialer for an existing task
  const openDurationPicker = (task: PersonalTodoItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setEditingTask(task);
  };

  // Save Duration Change from Wheel Dialer
  const handleSaveDuration = (newMinutes: number) => {
    if (!editingTask) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const targetId = editingTask.id;

    setTodos((prev) =>
      prev.map((t) => (t.id === targetId ? { ...t, durationMin: newMinutes } : t))
    );
    setEditingTask(null);
    setToastText(`Target set to ${newMinutes} min`);
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
    const willAllBeCompleted =
      willBeCompleted && nextTodos.length > 0 && nextTodos.every((t) => t.completed);

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

  // Delete via Long Press with Confirmation Dialog
  const confirmDeleteTodo = (item: PersonalTodoItem) => {
    notify.confirm({
      title: "Delete Task?",
      message: `Remove "${item.text}" from today's routine?`,
      confirmLabel: "Delete Task",
      tone: "destructive",
      icon: "trash-outline",
      onConfirm: () => {
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
        notify.success("Task Removed", `"${item.text}" removed.`);
      },
    });
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

  // Progress Calculations
  const completedCount = todos.filter((t) => t.completed).length;
  const totalCount = todos.length;
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
              backgroundColor: isDark ? theme.surfaceElevated : theme.raised,
              borderColor: theme.border,
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
          {showCelebration ? (
            <FullScreenGlitterOverlay onComplete={() => setShowCelebration(false)} />
          ) : null}

          {toastText ? (
            <View style={styles.toastWrapper} pointerEvents="none">
              <View
                style={[
                  styles.toastPill,
                  {
                    backgroundColor: isDark ? "#18181c" : theme.surfaceElevated,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={theme.accent}
                />
                <Text style={[styles.toastText, { color: isDark ? "#fafafa" : theme.text }]}>
                  {toastText}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Duration Dialer for Existing Task */}
          {editingTask ? (
            <DurationDialerModal
              visible={Boolean(editingTask)}
              initialMinutes={editingTask.durationMin || 30}
              taskTitle={editingTask.text}
              onClose={() => setEditingTask(null)}
              onSave={handleSaveDuration}
            />
          ) : null}

          {/* Duration Dialer for Add Task Form */}
          {isAddingDurationDialerOpen ? (
            <DurationDialerModal
              visible={isAddingDurationDialerOpen}
              initialMinutes={customDuration}
              taskTitle="Set Target Duration"
              onClose={() => setIsAddingDurationDialerOpen(false)}
              onSave={(mins) => {
                setCustomDuration(mins);
                setIsAddingDurationDialerOpen(false);
              }}
            />
          ) : null}
        </>
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.screenScrollContent}
      >
        {/* 1. Daily Focus & Progress Card */}
        <TodayProgressCard
          completedCount={completedCount}
          totalCount={totalCount}
          progressPercent={progressPercent}
          nextPendingTaskText={nextPendingTask?.text}
        />

        {/* 2. Today's Tasks Section */}
        <View style={styles.tasksSection}>
          <SectionTitle
            title="Today's Tasks"
            trailing={
              <Pressable
                onPress={toggleAddCard}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.addPillButton,
                  {
                    backgroundColor: isDark ? theme.surfaceElevated : theme.raised,
                    borderColor: theme.border,
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons
                  name={showAddCard ? "close" : "add"}
                  size={15}
                  color={theme.text}
                />
                <Text
                  style={[
                    styles.addPillText,
                    { color: theme.text },
                  ]}
                >
                  {showAddCard ? "Cancel" : "Add task"}
                </Text>
              </Pressable>
            }
          />

          {/* Inline Quick Add Task Form */}
          {showAddCard ? (
            <TodayAddTaskForm
              newTodoText={newTodoText}
              setNewTodoText={setNewTodoText}
              selectedTag={selectedTag}
              onSelectTag={handleTagSelect}
              customDuration={customDuration}
              onOpenDurationDialer={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setIsAddingDurationDialerOpen(true);
              }}
              onSave={handleSaveNewTodo}
              onCancel={() => setShowAddCard(false)}
              tagConfig={TAG_CONFIG}
            />
          ) : null}

          {/* Task List */}
          <View style={styles.tasksList}>
            {todos.length === 0 && !routineQuery.isLoading && !showAddCard ? (
              <Pressable
                onPress={toggleAddCard}
                style={({ pressed }) => [
                  styles.emptyTasksBlock,
                  {
                    backgroundColor: isDark ? "#121216" : theme.surface,
                    borderColor: theme.border,
                  },
                  pressed && { opacity: 0.82, transform: [{ scale: 0.99 }] },
                ]}
              >
                <View
                  style={[
                    styles.emptyTasksIconBadge,
                    {
                      backgroundColor: isDark ? "rgba(59, 130, 246, 0.12)" : "rgba(37, 99, 235, 0.08)",
                      borderColor: isDark ? "rgba(59, 130, 246, 0.25)" : "rgba(37, 99, 235, 0.15)",
                    },
                  ]}
                >
                  <Ionicons
                    name="checkbox-outline"
                    size={20}
                    color={theme.info}
                  />
                </View>
                <Text style={[styles.emptyTasksHeadline, { color: theme.text }]}>
                  No tasks set for today
                </Text>
                <Text style={[styles.emptyTasksSubtext, { color: theme.textMuted }]}>
                  Tap to plan your focus blocks or daily goals
                </Text>
              </Pressable>
            ) : null}

            {todos.map((item) => (
              <TodayTaskItem
                key={item.id}
                item={item}
                isJustAdded={item.id === recentlyAddedId}
                onToggle={() => toggleTodo(item.id)}
                onLongPress={() => confirmDeleteTodo(item)}
                onOpenDurationPicker={() => openDurationPicker(item)}
                tagConfig={TAG_CONFIG}
              />
            ))}
          </View>

          {/* Clear Completed Action */}
          {completedCount > 0 ? (
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
          ) : null}
        </View>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  themeSwitchButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs + 1,
    paddingHorizontal: spacing.sm - 1,
    paddingVertical: spacing.xxs + 1,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  themeSwitchText: {
    ...typography.caption,
    fontWeight: fontWeights.bold,
  },
  screenScrollContent: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  tasksSection: {
    gap: spacing.sm,
    marginTop: spacing.xxs,
  },
  addPillButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm - 1,
    paddingVertical: spacing.xxs + 1,
    borderRadius: radii.control,
    borderWidth: 1,
  },
  addPillText: {
    ...typography.caption,
    fontWeight: fontWeights.bold,
  },
  tasksList: {
    gap: spacing.xs,
  },
  emptyTasksBlock: {
    borderRadius: radii.card,
    borderWidth: 1,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs - 2,
    marginTop: spacing.xxs,
  },
  emptyTasksIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xxs,
  },
  emptyTasksHeadline: {
    ...typography.body,
    fontWeight: fontWeights.bold,
    textAlign: "center",
  },
  emptyTasksSubtext: {
    ...typography.caption,
    textAlign: "center",
    lineHeight: 17,
    maxWidth: 280,
  },
  clearContainer: {
    alignItems: "center",
    paddingVertical: spacing.xxs,
  },
  clearButton: {
    paddingVertical: spacing.xs - 2,
    paddingHorizontal: spacing.sm,
  },
  clearButtonText: {
    ...typography.caption,
    fontWeight: fontWeights.semibold,
  },
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
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    borderRadius: radii.full,
    borderWidth: 1,
    ...shadows.lg,
  },
  toastText: {
    ...typography.bodySmall,
    fontWeight: fontWeights.bold,
  },
});

