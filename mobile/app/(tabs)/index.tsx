import { useEffect, useMemo, useRef, useState } from "react";
import {
  BackHandler,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { Ionicons } from "@expo/vector-icons";
import { AppScreen } from "@/src/components/screen";
import { Card, ProgressBar, SectionTitle } from "@/src/components/ui";
import { FullScreenGlitterOverlay } from "@/src/components/glitter-overlay";
import { todayInKolkata } from "@/src/lib/format";
import { api } from "@/src/services/api";
import { useTheme } from "@/src/providers/theme-provider";
import { useNotify } from "@/src/providers/notification-provider";

type TodoTag = "GATE" | "College" | "Personal";

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
  Personal: 15,
};

const DIALER_OPTIONS = [
  5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60,
  75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240
];

const ITEM_HEIGHT = 44;
const VISIBLE_COUNT = 5; // 2 above, 1 selected in center, 2 below

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

// -------------------------------------------------------------
// Large, Silky-Smooth Pure Black & White Scroll Wheel Picker
// -------------------------------------------------------------
function CompactDurationDialerModal({
  visible,
  initialMinutes,
  taskTitle,
  onClose,
  onSave,
}: {
  visible: boolean;
  initialMinutes: number;
  taskTitle?: string;
  onClose: () => void;
  onSave: (mins: number) => void;
}) {
  const [selectedMins, setSelectedMins] = useState(initialMinutes);
  const scrollRef = useRef<ScrollView>(null);
  const isUserScrolling = useRef(false);
  const lastIndex = useRef<number>(-1);

  // Compute nearest index
  const initialIndex = useMemo(() => {
    const exact = DIALER_OPTIONS.indexOf(initialMinutes);
    if (exact !== -1) return exact;
    let closest = 0;
    let minDiff = 9999;
    DIALER_OPTIONS.forEach((val, idx) => {
      const diff = Math.abs(val - initialMinutes);
      if (diff < minDiff) {
        minDiff = diff;
        closest = idx;
      }
    });
    return closest;
  }, [initialMinutes]);

  useEffect(() => {
    if (visible) {
      setSelectedMins(initialMinutes);
      lastIndex.current = initialIndex;
      const t = setTimeout(() => {
        scrollRef.current?.scrollTo({
          y: initialIndex * ITEM_HEIGHT,
          animated: false,
        });
      }, 40);
      return () => clearTimeout(t);
    }
  }, [visible, initialMinutes, initialIndex]);

  const updateSelectionFromOffset = (offsetY: number) => {
    const rawIdx = Math.round(offsetY / ITEM_HEIGHT);
    const clampedIdx = Math.max(0, Math.min(DIALER_OPTIONS.length - 1, rawIdx));
    if (clampedIdx !== lastIndex.current) {
      lastIndex.current = clampedIdx;
      setSelectedMins(DIALER_OPTIONS[clampedIdx]);
      Haptics.selectionAsync().catch(() => {});
    }
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!isUserScrolling.current) return;
    updateSelectionFromOffset(e.nativeEvent.contentOffset.y);
  };

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    isUserScrolling.current = false;
    updateSelectionFromOffset(e.nativeEvent.contentOffset.y);
  };

  const handleItemPress = (index: number) => {
    Haptics.selectionAsync().catch(() => {});
    lastIndex.current = index;
    setSelectedMins(DIALER_OPTIONS[index]);
    scrollRef.current?.scrollTo({
      y: index * ITEM_HEIGHT,
      animated: true,
    });
  };

  return (
    <Modal
      transparent={true}
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.compactModalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.compactCardContainer}>
          {/* Header Bar */}
          <View style={styles.compactTopBar}>
            <Pressable onPress={onClose} hitSlop={10} style={styles.compactBarBtn}>
              <Text style={styles.compactCancelText}>Cancel</Text>
            </Pressable>

            <Text style={styles.compactHeaderTitle} numberOfLines={1}>
              {taskTitle ? taskTitle : "Target Duration"}
            </Text>

            <Pressable
              onPress={() => onSave(selectedMins)}
              hitSlop={10}
              style={styles.compactBarBtn}
            >
              <Text style={styles.compactDoneText}>Done</Text>
            </Pressable>
          </View>

          {/* Small Subtle Current Selection Pill */}
          <View style={styles.compactValueRow}>
            <View style={styles.compactSelectedPill}>
              <Ionicons name="time-outline" size={13} color="#38BDF8" />
              <Text style={styles.compactSelectedPillText}>{selectedMins} min</Text>
            </View>
          </View>

          {/* Large Spacious 5-Slot Wheel Frame (Up to 240 min) */}
          <View style={styles.compactWheelFrame}>
            {/* Center Selection Lens */}
            <View style={styles.compactCenterLens} pointerEvents="none" />

            <ScrollView
              ref={scrollRef}
              showsVerticalScrollIndicator={false}
              snapToInterval={ITEM_HEIGHT}
              snapToAlignment="start"
              decelerationRate="fast"
              onScrollBeginDrag={() => {
                isUserScrolling.current = true;
              }}
              onScroll={handleScroll}
              onMomentumScrollEnd={handleMomentumScrollEnd}
              onScrollEndDrag={handleMomentumScrollEnd}
              scrollEventThrottle={32}
              contentContainerStyle={{
                paddingVertical: ITEM_HEIGHT * 2, // 2 items offset top & bottom for 5-slot center alignment
              }}
            >
              {DIALER_OPTIONS.map((mins, idx) => {
                const isSelected = mins === selectedMins;
                return (
                  <Pressable
                    key={mins}
                    onPress={() => handleItemPress(idx)}
                    style={styles.compactItemRow}
                  >
                    <Text
                      style={[
                        styles.compactItemText,
                        isSelected && styles.compactItemTextSelected,
                      ]}
                    >
                      {mins} min
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function TodayScreen() {
  const date = todayInKolkata();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const { theme, isDark, toggleTheme } = useTheme();
  const cheerPlayer = useAudioPlayer(require("@/assets/sounds/cheer.mp3"));

  // 3 Distinct & Harmonious Tag System (Spacious Layout)
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
  
  // Wheel Dialer State
  const [editingTask, setEditingTask] = useState<PersonalTodo | null>(null);
  const [isAddingDurationDialerOpen, setIsAddingDurationDialerOpen] = useState(false);

  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);
  const [toastText, setToastText] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  // The player is preloaded by useAudioPlayer and automatically released on unmount.
  useEffect(() => {
    void setupAudio();

    // Load mobile tags mapping
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
    staleTime: 10_000,
  });

  // Sync backend tasks with mobile UI
  useEffect(() => {
    if (routineQuery.data && Array.isArray(routineQuery.data.tasks)) {
      const serverTasks: PersonalTodo[] = routineQuery.data.tasks.map((task: any, index: number) => {
        const rawTag = (tagMap[task.taskId] || tagMap[task.title] || (index === 0 ? "GATE" : "College")) as string;
        const localTag: TodoTag = rawTag === "College" ? "College" : rawTag === "Personal" ? "Personal" : "GATE";
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

    const newEntry: PersonalTodo = {
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

  // Open Dialer for a Task in list
  const openDurationPicker = (task: PersonalTodo) => {
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

          {/* Compact Scroll Wheel Duration Modal for Task Rows */}
          {editingTask && (
            <CompactDurationDialerModal
              visible={!!editingTask}
              initialMinutes={editingTask.durationMin || 30}
              taskTitle={editingTask.text}
              onClose={() => setEditingTask(null)}
              onSave={handleSaveDuration}
            />
          )}

          {/* Compact Scroll Wheel Duration Modal for Add Task Form */}
          {isAddingDurationDialerOpen && (
            <CompactDurationDialerModal
              visible={isAddingDurationDialerOpen}
              initialMinutes={customDuration}
              taskTitle="Set Target Duration"
              onClose={() => setIsAddingDurationDialerOpen(false)}
              onSave={(mins) => {
                setCustomDuration(mins);
                setIsAddingDurationDialerOpen(false);
              }}
            />
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

              {/* Tag Selection Row (3 Tags: GATE, College, Personal + Duration Button) */}
              <View style={styles.inlineTagAndDurationRow}>
                {/* 3 Spacious Category Chips */}
                <View style={styles.inlineTagRow}>
                  {(["GATE", "College", "Personal"] as const).map((t) => {
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
                          size={13}
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

                {/* Duration Picker Trigger */}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setIsAddingDurationDialerOpen(true);
                  }}
                  style={[
                    styles.addDurationTrigger,
                    {
                      backgroundColor: isDark ? "#18181D" : "#f1f5f9",
                      borderColor: isDark ? "#2A2A32" : "#e2e8f0",
                    },
                  ]}
                >
                  <Ionicons
                    name="time-outline"
                    size={13}
                    color={isDark ? "#38BDF8" : "#0284c7"}
                  />
                  <Text style={[styles.addDurationTriggerText, { color: isDark ? "#F5F5F7" : theme.text }]}>
                    {customDuration}m
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={11}
                    color={isDark ? "#71717A" : theme.textFaint}
                  />
                </Pressable>
              </View>
            </Card>
          )}

          {/* List of Tasks */}
          <View style={styles.todoList}>
            {todos.length === 0 && !routineQuery.isLoading && !showAddCard && (
              <Pressable
                onPress={toggleAddCard}
                style={({ pressed }) => [
                  styles.emptyTasksBlock,
                  {
                    backgroundColor: isDark ? "#151518" : "#ffffff",
                    borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#e2e8f0",
                  },
                  pressed && { opacity: 0.82, transform: [{ scale: 0.99 }] },
                ]}
              >
                <View
                  style={[
                    styles.emptyTasksIconBadge,
                    {
                      backgroundColor: isDark ? "rgba(59, 130, 246, 0.12)" : "rgba(37, 99, 235, 0.08)",
                      borderColor: isDark ? "rgba(59, 130, 246, 0.22)" : "rgba(37, 99, 235, 0.15)",
                    },
                  ]}
                >
                  <Ionicons
                    name="checkbox-outline"
                    size={20}
                    color={isDark ? "#60A5FA" : "#2563EB"}
                  />
                </View>
                <Text style={[styles.emptyTasksHeadline, { color: isDark ? "#F5F5F7" : theme.text }]}>
                  No tasks set for today
                </Text>
                <Text style={[styles.emptyTasksSubtext, { color: isDark ? "#A1A1AA" : theme.textMuted }]}>
                  Tap to plan your focus blocks or daily goals
                </Text>
              </Pressable>
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

                      {/* Interactive Time Badge (Opens Compact Scroll Wheel Dialer) */}
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
  inlineTagAndDurationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inlineTagRow: {
    flex: 1,
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
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1,
  },
  inlineTagText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  addDurationTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
  },
  addDurationTriggerText: {
    fontSize: 11.5,
    fontWeight: "700",
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
  emptyTasksBlock: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 4,
  },
  emptyTasksIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTasksHeadline: {
    fontSize: 14.5,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.2,
  },
  emptyTasksSubtext: {
    fontSize: 12.5,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 17,
    maxWidth: 280,
  },

  // -------------------------------------------------------------
  // Large & Clean Pure Black & White Wheel Modal
  // -------------------------------------------------------------
  compactModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    zIndex: 10000,
  },
  compactCardContainer: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#0C0C0F",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#222228",
    paddingTop: 14,
    paddingBottom: 16,
    paddingHorizontal: 16,
    gap: 12,
    shadowColor: "#000000",
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 16,
  },
  compactTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1F1F26",
    paddingBottom: 10,
  },
  compactBarBtn: {
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  compactCancelText: {
    fontSize: 13.5,
    color: "#8E8E93",
    fontWeight: "600",
  },
  compactHeaderTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    flex: 1,
    textAlign: "center",
    paddingHorizontal: 6,
  },
  compactDoneText: {
    fontSize: 13.5,
    color: "#38BDF8",
    fontWeight: "800",
  },
  compactValueRow: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 1,
  },
  compactSelectedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#16161C",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#25252E",
  },
  compactSelectedPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  compactWheelFrame: {
    height: ITEM_HEIGHT * VISIBLE_COUNT, // 220px
    position: "relative",
    overflow: "hidden",
    borderRadius: 14,
    backgroundColor: "#070709",
    borderWidth: 1,
    borderColor: "#18181F",
  },
  compactCenterLens: {
    position: "absolute",
    top: ITEM_HEIGHT * 2, // Center slot (index 2 out of 0..4)
    left: 6,
    right: 6,
    height: ITEM_HEIGHT,
    backgroundColor: "rgba(56, 189, 248, 0.08)",
    borderRadius: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.28)",
    zIndex: 1,
  },
  compactItemRow: {
    height: ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  compactItemText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#4B4B52",
    fontVariant: ["tabular-nums"],
  },
  compactItemTextSelected: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
