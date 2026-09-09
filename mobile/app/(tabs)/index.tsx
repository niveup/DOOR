import React, { useEffect, useMemo, useState } from "react";
import {
  BackHandler,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { Ionicons } from "@/src/components/app-icon";
import { AppScreen } from "@/src/components/screen";
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
import { useTabPagerLock } from "@/src/components/tab-pager-context";
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
        color: isDark ? theme.blue : "#2563eb",
        bg: isDark ? "rgba(59, 130, 246, 0.12)" : "rgba(37, 99, 235, 0.08)",
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
  const [editingId, setEditingId] = useState<string | null>(null);

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
    if (!showAddCard && !editingTask && !isAddingDurationDialerOpen && !editingId) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (editingId) {
        setEditingId(null);
        Keyboard.dismiss();
        return true;
      }
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
  }, [showAddCard, editingTask, isAddingDurationDialerOpen, editingId]);

  const toggleAddCard = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (!showAddCard) {
      setNewTodoText("");
      setSelectedTag("GATE");
      setCustomDuration(DEFAULT_DURATIONS.GATE);
    }
    setShowAddCard((prev) => !prev);
  };

  const dismissAddCard = () => {
    if (!showAddCard) return false;
    Keyboard.dismiss();
    setShowAddCard(false);
    return true;
  };

  const deselectTask = () => {
    if (!editingId) return false;
    setEditingId(null);
    Keyboard.dismiss();
    return true;
  };

  const { setLocked, setIntercept } = useTabPagerLock();

  useEffect(() => {
    setLocked(showAddCard);
    setIntercept(showAddCard ? dismissAddCard : null);
    return () => {
      setIntercept(null);
    };
  }, [showAddCard, setLocked, setIntercept]);

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
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
          setTagMap((prev) => {
            const next: Record<string, TodoTag> = { ...prev, [actualId]: tagChoice };
            delete next[tempId];
            AsyncStorage.setItem("door_mobile_tags_map", JSON.stringify(next)).catch(() => {});
            return next;
          });
          AsyncStorage.removeItem(`door_todos_${date}`).catch(() => {});
        }
      })
      .catch(() => {
        setTodos((prev) => {
          const next = prev.filter((t) => t.id !== tempId);
          AsyncStorage.setItem(`door_todos_${date}`, JSON.stringify(next)).catch(() => {});
          return next;
        });
        queryClient.setQueryData(["routine", date], (old: any) => {
          if (!old || !Array.isArray(old.tasks)) return old;
          return {
            ...old,
            tasks: old.tasks.filter((t: any) => t.taskId !== tempId),
          };
        });
        setTagMap((prev) => {
          if (!(tempId in prev) && !(title in prev)) return prev;
          const next = { ...prev };
          delete next[tempId];
          delete next[title];
          AsyncStorage.setItem("door_mobile_tags_map", JSON.stringify(next)).catch(() => {});
          return next;
        });
        setToastText("Couldn't save task — check connection");
        setTimeout(() => setToastText(null), 2500);
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

  // Rename Task Title from Inline Tap-to-Edit
  const handleRenameTodo = (id: string, title: string) => {
    const clean = title.trim();
    if (!clean) return;
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, text: clean } : t)));

    queryClient.setQueryData(["routine", date], (old: any) => {
      if (!old || !Array.isArray(old.tasks)) return old;
      return {
        ...old,
        tasks: old.tasks.map((t: any) => (t.taskId === id ? { ...t, title: clean } : t)),
      };
    });

    setTodos((current) => {
      AsyncStorage.setItem(`door_todos_${date}`, JSON.stringify(current)).catch(() => {});
      return current;
    });

    if (!id.startsWith("temp-")) {
      api.routine.updateTask(id, { title: clean }).catch(() => {});
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
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch {}
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
      keyboardShouldPersistTaps="always"
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
      <View style={styles.screenScrollContent}>
        {/* 1. Daily Focus & Progress Card */}
        <TodayProgressCard
          completedCount={completedCount}
          totalCount={totalCount}
          progressPercent={progressPercent}
          nextPendingTaskText={nextPendingTask?.text}
        />

        {/* 2. Today's Tasks Section */}
        <View style={styles.tasksSection}>
          <View style={styles.tasksHeader}>
            <Text style={[styles.tasksTitle, { color: theme.textMuted }]}>
              Today's Tasks{totalCount > 0 ? ` · ${totalCount}` : ""}
            </Text>
            <Pressable
              onPress={toggleAddCard}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={showAddCard ? "Cancel task creation" : "Add task"}
              style={({ pressed }) => [pressed && { opacity: 0.55 }]}
            >
              <Text
                style={[
                  styles.tasksAction,
                  { color: showAddCard ? theme.textFaint : theme.accent },
                ]}
              >
                {showAddCard ? "Cancel" : "+ Add"}
              </Text>
            </Pressable>
          </View>

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
            />
          ) : null}

          {/* Task List */}
          <Pressable onPress={showAddCard ? () => { dismissAddCard(); } : () => { deselectTask(); Keyboard.dismiss(); }}>
          <View style={styles.tasksList}>
            {todos.length === 0 && !routineQuery.isLoading && !showAddCard ? (
              <Pressable
                onPress={toggleAddCard}
                accessibilityRole="button"
                accessibilityLabel="Add your first task"
                style={({ pressed }) => [pressed && { opacity: 0.6 }]}
              >
                <Animated.View
                  entering={FadeInDown.duration(240)}
                  style={styles.emptySimple}
                >
                  <Ionicons
                    name="checkbox-outline"
                    size={20}
                    color={theme.textFaint}
                    style={styles.emptySimpleIcon}
                  />
                  <Text style={[styles.emptySimpleTitle, { color: theme.textMuted }]}>
                    No tasks yet
                  </Text>
                  <Text style={[styles.emptySimpleSub, { color: theme.textFaint }]}>
                    Tap + Add above to plan your day
                  </Text>
                </Animated.View>
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
                editing={editingId === item.id}
                onBeginEdit={() => setEditingId(item.id)}
                onEndEdit={() => setEditingId((cur) => (cur === item.id ? null : cur))}
                onRename={(title) => handleRenameTodo(item.id, title)}
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
          </Pressable>
        </View>
      </View>
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
  tasksHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: spacing.xxs,
  },
  tasksTitle: {
    ...typography.bodySmall,
    fontSize: 13,
    fontWeight: fontWeights.semibold,
  },
  tasksAction: {
    ...typography.bodySmall,
    fontSize: 13.5,
    fontWeight: fontWeights.bold,
  },
  tasksList: {
    gap: spacing.xs,
  },
  emptySimple: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: spacing.xxl,
  },
  emptySimpleTitle: {
    ...typography.body,
    fontSize: 15,
    fontWeight: fontWeights.semibold,
  },
  emptySimpleSub: {
    ...typography.caption,
    fontSize: 12.5,
    fontWeight: fontWeights.regular,
  },
  emptySimpleIcon: {
    marginBottom: spacing.xxs,
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

