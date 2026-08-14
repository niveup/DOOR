import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { AppScreen } from "@/src/components/screen";
import { Card, ProgressBar, SectionTitle } from "@/src/components/ui";
import { todayInKolkata } from "@/src/lib/format";
import { useTheme } from "@/src/providers/theme-provider";

type TodoTag = "GATE" | "Quick" | "College" | "Personal";

interface PersonalTodo {
  id: string;
  text: string;
  completed: boolean;
  tag: TodoTag;
  createdAt: number;
}

const DEFAULT_TODOS: PersonalTodo[] = [
  { id: "def-1", text: "Revise 1 weak topic formula sheet", completed: false, tag: "GATE", createdAt: Date.now() - 3000 },
  { id: "def-2", text: "Complete 15 practice PYQs", completed: false, tag: "GATE", createdAt: Date.now() - 2000 },
  { id: "def-3", text: "Log today's cashflow expenses", completed: false, tag: "Quick", createdAt: Date.now() - 1000 },
];

export default function TodayScreen() {
  const date = todayInKolkata();
  const { theme, isDark, toggleTheme } = useTheme();

  const TAG_CONFIG: Record<TodoTag, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = useMemo(
    () => ({
      GATE: { label: "GATE", color: theme.emerald, icon: "school-outline" },
      Quick: { label: "Quick", color: theme.amber, icon: "cafe-outline" },
      College: { label: "College", color: theme.violet, icon: "book-outline" },
      Personal: { label: "Personal", color: theme.cyan, icon: "leaf-outline" },
    }),
    [theme]
  );

  // --- State ---
  const [todos, setTodos] = useState<PersonalTodo[]>([]);
  const [isTodosLoaded, setIsTodosLoaded] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [newTodoText, setNewTodoText] = useState("");
  const [selectedTag, setSelectedTag] = useState<TodoTag>("GATE");

  // Load To-Dos from AsyncStorage
  useEffect(() => {
    async function loadTodos() {
      try {
        const stored = await AsyncStorage.getItem(`door_todos_${date}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setTodos(parsed);
            setIsTodosLoaded(true);
            return;
          }
        }
        setTodos(DEFAULT_TODOS);
      } catch {
        setTodos(DEFAULT_TODOS);
      } finally {
        setIsTodosLoaded(true);
      }
    }
    loadTodos();
  }, [date]);

  // Persist To-Dos on Change
  useEffect(() => {
    if (isTodosLoaded) {
      AsyncStorage.setItem(`door_todos_${date}`, JSON.stringify(todos)).catch(() => {});
    }
  }, [todos, isTodosLoaded, date]);

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
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newEntry: PersonalTodo = {
      id: `todo-${Date.now()}`,
      text: newTodoText.trim(),
      completed: false,
      tag: selectedTag,
      createdAt: Date.now(),
    };
    setTodos((current) => [newEntry, ...current]);
    setNewTodoText("");
    setShowAddCard(false);
  };

  const toggleTodo = async (id: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTodos((current) =>
      current.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const deleteTodo = async (id: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTodos((current) => current.filter((t) => t.id !== id));
  };

  const clearCompletedTodos = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTodos((current) => current.filter((t) => !t.completed));
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
              <Text style={[styles.heroPercent, { color: theme.text }]}>{progressPercent}%</Text>
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
                    ? "rgba(16, 185, 129, 0.18)"
                    : "#1a1a20"
                  : progressPercent === 100
                  ? "rgba(5, 150, 105, 0.14)"
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
          tone={progressPercent >= 80 ? theme.emerald : progressPercent >= 40 ? theme.cyan : theme.amber}
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
                  backgroundColor: isDark ? "rgba(16, 185, 129, 0.14)" : "rgba(5, 150, 105, 0.12)",
                  borderColor: theme.emerald,
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name={showAddCard ? "close" : "add"} size={16} color={theme.emerald} />
              <Text style={[styles.addPillText, { color: theme.emerald }]}>
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
                borderColor: theme.emerald,
              },
            ]}
          >
            <TextInput
              style={[
                styles.inlineAddInput,
                {
                  backgroundColor: isDark ? "#09090b" : "#f8fafc",
                  borderColor: isDark ? "#27272a" : "#e2e8f0",
                  color: theme.text,
                },
              ]}
              value={newTodoText}
              onChangeText={setNewTodoText}
              placeholder="What do you need to focus on?"
              placeholderTextColor={theme.textFaint}
              autoFocus={true}
              autoCapitalize="sentences"
              returnKeyType="done"
              onSubmitEditing={handleSaveNewTodo}
            />

            <View style={styles.inlineBottomRow}>
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

              <Pressable
                onPress={handleSaveNewTodo}
                disabled={!newTodoText.trim()}
                style={({ pressed }) => [
                  styles.inlineAddButton,
                  { backgroundColor: theme.emerald },
                  !newTodoText.trim() && { opacity: 0.35 },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Ionicons name="arrow-up" size={18} color="#ffffff" />
              </Pressable>
            </View>
          </Card>
        )}

        {/* List of Tasks */}
        <View style={styles.todoList}>
          {todos.map((item) => {
            const tagCfg = TAG_CONFIG[item.tag] || TAG_CONFIG.Quick;
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
                      item.completed && [styles.todoTitleCompleted, { color: theme.textFaint }],
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
  },
  inlineAddInput: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 46,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  inlineBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  inlineTagRow: {
    flex: 1,
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
  inlineAddButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
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
});
