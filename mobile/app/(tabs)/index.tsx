import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { AppScreen } from "@/src/components/screen";
import { Card, Metric, ProgressBar, SectionTitle, ui } from "@/src/components/ui";
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
  { id: "def-4", text: "Review engineering math notes", completed: false, tag: "College", createdAt: Date.now() },
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

  // --- Personal To-Do State ---
  const [todos, setTodos] = useState<PersonalTodo[]>([]);
  const [isTodosLoaded, setIsTodosLoaded] = useState(false);
  const [newTodoText, setNewTodoText] = useState("");
  const [selectedTag, setSelectedTag] = useState<TodoTag>("GATE");
  const [showAddBox, setShowAddBox] = useState(false);
  const [filterTag, setFilterTag] = useState<TodoTag | "All">("All");

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

  const filteredTodos = useMemo(() => {
    if (filterTag === "All") return todos;
    return todos.filter((t) => t.tag === filterTag);
  }, [todos, filterTag]);

  return (
    <AppScreen
      title="Daily Focus"
      subtitle={new Intl.DateTimeFormat("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "short",
      }).format(new Date())}
      action={
        <View style={styles.topActions}>
          {/* Apple Style Dark / Light Mode Switcher */}
          <Pressable
            onPress={toggleTheme}
            style={({ pressed }) => [
              styles.themeSwitchButton,
              {
                backgroundColor: isDark ? "#1a1a1f" : "#f1f5f9",
                borderColor: isDark ? "#27272a" : "#e2e8f0",
              },
              pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] },
            ]}
          >
            <Ionicons
              name={isDark ? "sunny-outline" : "moon-outline"}
              size={18}
              color={isDark ? theme.amber : theme.text}
            />
            <Text style={[styles.themeSwitchText, { color: theme.text }]}>
              {isDark ? "Light" : "Dark"}
            </Text>
          </Pressable>
        </View>
      }
    >
      {/* Daily Progress Hero Card (Neutral Obsidian in Dark, Clean White in Light) */}
      <Card
        style={[
          styles.hero,
          {
            backgroundColor: isDark ? "#121215" : "#ffffff",
            borderColor: isDark ? "#27272a" : "#e2e8f0",
          },
        ]}
      >
        <View style={ui.spread}>
          <View>
            <Text style={[styles.heroLabel, { color: theme.textFaint }]}>TODAY'S COMPLETION</Text>
            <Text style={[styles.heroValue, { color: theme.text }]}>{progressPercent}%</Text>
          </View>
          <View
            style={[
              styles.priority,
              {
                backgroundColor: isDark ? "#1a1a1f" : "#f8fafc",
                borderColor: isDark ? "#27272a" : "#e2e8f0",
              },
            ]}
          >
            <Ionicons
              name={progressPercent === 100 ? "sparkles" : "checkmark-circle-outline"}
              color={theme.emerald}
              size={18}
            />
            <Text style={[styles.priorityText, { color: theme.text }]}>
              {progressPercent === 100
                ? "All finished! Superb work."
                : `${pendingCount} focus ${pendingCount === 1 ? "task" : "tasks"} remaining`}
            </Text>
          </View>
        </View>
        <ProgressBar
          value={progressPercent}
          tone={progressPercent >= 75 ? theme.emerald : progressPercent >= 40 ? theme.cyan : theme.amber}
        />
        <Text style={[styles.heroNote, { color: theme.textMuted }]}>
          Small, honest daily actions compound into huge breakthroughs.
        </Text>
      </Card>

      {/* Quick Metrics */}
      <Card
        style={[
          styles.metrics,
          {
            backgroundColor: isDark ? "#121215" : "#ffffff",
            borderColor: isDark ? "#27272a" : "#e2e8f0",
          },
        ]}
      >
        <Metric label="Completed" value={`${completedCount}/${totalCount}`} accent={theme.emerald} />
        <Metric label="Remaining" value={pendingCount} accent={theme.amber} />
        <Metric
          label="Status"
          value={progressPercent >= 80 ? "On fire" : progressPercent > 0 ? "In flow" : "Ready"}
          accent={theme.cyan}
        />
      </Card>

      {/* Category Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
      >
        {(["All", "GATE", "Quick", "College", "Personal"] as const).map((tag) => {
          const active = filterTag === tag;
          const count = tag === "All" ? todos.length : todos.filter((t) => t.tag === tag).length;
          return (
            <Pressable
              key={tag}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFilterTag(tag);
              }}
              style={[
                styles.filterChip,
                {
                  backgroundColor: isDark ? "#121215" : "#ffffff",
                  borderColor: isDark ? "#27272a" : "#e2e8f0",
                },
                active && {
                  backgroundColor: isDark ? "rgba(16, 185, 129, 0.16)" : "rgba(5, 150, 105, 0.12)",
                  borderColor: theme.emerald,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: theme.textFaint },
                  active && { color: theme.emerald, fontWeight: "800" },
                ]}
              >
                {tag} {count > 0 ? `(${count})` : ""}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Focus Checklist Section */}
      <View style={styles.todoSection}>
        <SectionTitle
          title={filterTag === "All" ? "Today's Checklist" : `${filterTag} Tasks`}
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
                {showAddBox ? "Cancel" : "Add to-do"}
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
                backgroundColor: isDark ? "#141418" : "#ffffff",
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
              placeholder="What do you want to accomplish?"
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
                          backgroundColor: isDark ? "#1a1a1f" : "#f8fafc",
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
          {filteredTodos.map((item) => {
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
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  themeSwitchButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  themeSwitchText: {
    fontSize: 12,
    fontWeight: "700",
  },
  hero: {
    gap: 12,
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  heroValue: {
    fontSize: 42,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  priority: {
    maxWidth: "58%",
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  priorityText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    flex: 1,
  },
  heroNote: {
    fontSize: 13,
    lineHeight: 19,
  },
  metrics: {
    flexDirection: "row",
    gap: 8,
  },

  filterScroll: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "700",
  },

  // --- To-Do Section ---
  todoSection: {
    gap: 10,
    marginTop: 4,
  },
  addPillButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
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
    gap: 6,
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
