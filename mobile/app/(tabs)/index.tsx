import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { AppScreen } from "@/src/components/screen";
import { Card, ProgressBar, SectionTitle, ui } from "@/src/components/ui";
import { todayInKolkata } from "@/src/lib/format";
import { useTheme } from "@/src/providers/theme-provider";

type TodoTag = "GATE" | "Quick" | "College" | "Personal";

interface PersonalTodo {
  id: string;
  text: string;
  completed: boolean;
  tag: TodoTag;
  estimatedMin?: number;
  createdAt: number;
}

const DEFAULT_TODOS: PersonalTodo[] = [
  { id: "def-1", text: "Revise 1 weak topic formula sheet", completed: false, tag: "GATE", estimatedMin: 25, createdAt: Date.now() - 3000 },
  { id: "def-2", text: "Complete 15 practice PYQs", completed: false, tag: "GATE", estimatedMin: 30, createdAt: Date.now() - 2000 },
  { id: "def-3", text: "Log today's cashflow expenses", completed: false, tag: "Quick", estimatedMin: 5, createdAt: Date.now() - 1000 },
];

export default function TodayScreen() {
  const date = todayInKolkata();
  const { theme, isDark, toggleTheme } = useTheme();

  const TAG_CONFIG: Record<TodoTag, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = useMemo(
    () => ({
      GATE: { label: "GATE", color: theme.emerald, icon: "school-outline" },
      Quick: { label: "Quick", color: theme.amber, icon: "flash-outline" },
      College: { label: "College", color: theme.violet, icon: "book-outline" },
      Personal: { label: "Personal", color: theme.cyan, icon: "leaf-outline" },
    }),
    [theme]
  );

  // --- State ---
  const [todos, setTodos] = useState<PersonalTodo[]>([]);
  const [isTodosLoaded, setIsTodosLoaded] = useState(false);
  const [newTodoText, setNewTodoText] = useState("");
  const [selectedTag, setSelectedTag] = useState<TodoTag>("GATE");
  const [showAddBox, setShowAddBox] = useState(false);

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

  const toggleTodo = async (id: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTodos((current) =>
      current.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const addTodo = async () => {
    if (!newTodoText.trim()) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newEntry: PersonalTodo = {
      id: `todo-${Date.now()}`,
      text: newTodoText.trim(),
      completed: false,
      tag: selectedTag,
      estimatedMin: selectedTag === "GATE" ? 30 : selectedTag === "Quick" ? 5 : 20,
      createdAt: Date.now(),
    };
    setTodos((current) => [newEntry, ...current]);
    setNewTodoText("");
    setShowAddBox(false);
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

  // Next upcoming pending task
  const nextPendingTask = todos.find((t) => !t.completed);
  const totalEstimatedMinutes = todos
    .filter((t) => !t.completed)
    .reduce((sum, t) => sum + (t.estimatedMin || (t.tag === "GATE" ? 25 : 10)), 0);

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
      {/* 1. Spacious & Non-Overlapping Hero Card */}
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
            ? "✨ Superb discipline today! Every goal hit."
            : nextPendingTask
            ? `Next focus: "${nextPendingTask.text}"`
            : "Small, honest daily actions compound into huge breakthroughs."}
        </Text>
      </Card>

      {/* 2. Informative Focus & Momentum Insights Card */}
      <Card
        style={[
          styles.insightCard,
          {
            backgroundColor: isDark ? "#121215" : "#ffffff",
            borderColor: isDark ? "#27272a" : "#e2e8f0",
          },
        ]}
      >
        <View style={styles.insightHeader}>
          <Ionicons name="flash-outline" size={16} color={theme.amber} />
          <Text style={[styles.insightTitle, { color: theme.text }]}>Focus Velocity</Text>
        </View>

        <View style={styles.insightGrid}>
          <View
            style={[
              styles.insightTile,
              { backgroundColor: isDark ? "#18181d" : "#f8fafc", borderColor: isDark ? "#27272a" : "#f1f5f9" },
            ]}
          >
            <Text style={[styles.insightTileLabel, { color: theme.textFaint }]}>EST. TIME</Text>
            <Text style={[styles.insightTileValue, { color: theme.cyan }]}>
              {pendingCount > 0 ? `~${totalEstimatedMinutes}m` : "Done"}
            </Text>
          </View>

          <View
            style={[
              styles.insightTile,
              { backgroundColor: isDark ? "#18181d" : "#f8fafc", borderColor: isDark ? "#27272a" : "#f1f5f9" },
            ]}
          >
            <Text style={[styles.insightTileLabel, { color: theme.textFaint }]}>PRIORITY</Text>
            <Text style={[styles.insightTileValue, { color: theme.emerald }]}>
              {nextPendingTask ? nextPendingTask.tag : "Free"}
            </Text>
          </View>

          <View
            style={[
              styles.insightTile,
              { backgroundColor: isDark ? "#18181d" : "#f8fafc", borderColor: isDark ? "#27272a" : "#f1f5f9" },
            ]}
          >
            <Text style={[styles.insightTileLabel, { color: theme.textFaint }]}>FLOW</Text>
            <Text style={[styles.insightTileValue, { color: theme.amber }]}>
              {progressPercent >= 80 ? "On fire" : progressPercent > 0 ? "Building" : "Ready"}
            </Text>
          </View>
        </View>
      </Card>

      {/* 3. Clean Task Checklist Section (No clutter filter chips) */}
      <View style={styles.todoSection}>
        <SectionTitle
          title="Today's Tasks"
          trailing={
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowAddBox((prev) => !prev);
              }}
              style={({ pressed }) => [
                styles.addPillButton,
                {
                  backgroundColor: isDark ? "rgba(16, 185, 129, 0.14)" : "rgba(5, 150, 105, 0.12)",
                  borderColor: theme.emerald,
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name={showAddBox ? "close" : "add"} size={16} color={theme.emerald} />
              <Text style={[styles.addPillText, { color: theme.emerald }]}>
                {showAddBox ? "Cancel" : "Add task"}
              </Text>
            </Pressable>
          }
        />

        {/* Quick Add Form */}
        {showAddBox && (
          <Card
            style={[
              styles.addCard,
              {
                backgroundColor: isDark ? "#16161b" : "#ffffff",
                borderColor: theme.emerald,
              },
            ]}
          >
            <TextInput
              style={[
                styles.addInput,
                {
                  backgroundColor: isDark ? "#09090b" : "#f8fafc",
                  borderColor: isDark ? "#27272a" : "#cbd5e1",
                  color: theme.text,
                },
              ]}
              value={newTodoText}
              onChangeText={setNewTodoText}
              placeholder="What do you need to focus on?"
              placeholderTextColor={theme.textFaint}
              autoFocus
              autoCapitalize="sentences"
              onSubmitEditing={addTodo}
              returnKeyType="done"
            />
            <View style={styles.addActionsRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagPicker}>
                {(["GATE", "Quick", "College", "Personal"] as const).map((tag) => {
                  const active = selectedTag === tag;
                  const cfg = TAG_CONFIG[tag];
                  return (
                    <Pressable
                      key={tag}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedTag(tag);
                      }}
                      style={[
                        styles.tagChip,
                        {
                          backgroundColor: isDark ? "#1a1a20" : "#f8fafc",
                          borderColor: isDark ? "#27272a" : "#e2e8f0",
                        },
                        active && { backgroundColor: `${cfg.color}22`, borderColor: cfg.color },
                      ]}
                    >
                      <Ionicons
                        name={cfg.icon}
                        size={12}
                        color={active ? cfg.color : theme.textFaint}
                      />
                      <Text
                        style={[
                          styles.tagChipText,
                          { color: theme.textFaint },
                          active && { color: cfg.color, fontWeight: "800" },
                        ]}
                      >
                        {cfg.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Pressable
                onPress={addTodo}
                disabled={!newTodoText.trim()}
                style={({ pressed }) => [
                  styles.saveTodoButton,
                  { backgroundColor: theme.emerald },
                  !newTodoText.trim() && styles.saveTodoDisabled,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Ionicons name="arrow-up" size={17} color="#ffffff" />
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
                    {item.estimatedMin && !item.completed ? (
                      <Text style={[styles.metaTimeText, { color: theme.textFaint }]}>
                        {item.estimatedMin}m
                      </Text>
                    ) : null}
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

  // 1. Hero Card
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

  // 2. Insight Card
  insightCard: {
    padding: 14,
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  insightTitle: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  insightGrid: {
    flexDirection: "row",
    gap: 8,
  },
  insightTile: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 3,
  },
  insightTileLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  insightTileValue: {
    fontSize: 15,
    fontWeight: "900",
  },

  // 3. To-Do Section
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
    borderRadius: 12,
    borderWidth: 1,
  },
  addPillText: {
    fontSize: 11,
    fontWeight: "800",
  },
  addCard: {
    padding: 12,
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  addInput: {
    fontSize: 14,
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  addActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  tagPicker: {
    flexDirection: "row",
    gap: 6,
  },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  tagChipText: {
    fontSize: 11,
    fontWeight: "600",
  },
  saveTodoButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  saveTodoDisabled: {
    opacity: 0.3,
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
  metaTimeText: {
    fontSize: 10,
    fontWeight: "600",
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
