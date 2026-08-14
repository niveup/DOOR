import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { AppScreen } from "@/src/components/screen";
import { Card, Metric, ProgressBar, SectionTitle, ui } from "@/src/components/ui";
import { todayInKolkata } from "@/src/lib/format";
import { colors } from "@/src/theme/tokens";

type TodoTag = "GATE" | "Quick" | "College" | "Personal";

interface PersonalTodo {
  id: string;
  text: string;
  completed: boolean;
  tag: TodoTag;
  createdAt: number;
}

const TAG_CONFIG: Record<TodoTag, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  GATE: { label: "GATE", color: colors.cyan, icon: "school-outline" },
  Quick: { label: "Quick", color: colors.amber, icon: "flash-outline" },
  College: { label: "College", color: colors.violet, icon: "book-outline" },
  Personal: { label: "Personal", color: colors.emerald, icon: "leaf-outline" },
};

const DEFAULT_TODOS: PersonalTodo[] = [
  { id: "def-1", text: "Revise 1 weak topic formula sheet", completed: false, tag: "GATE", createdAt: Date.now() - 3000 },
  { id: "def-2", text: "Complete 15 practice PYQs", completed: false, tag: "GATE", createdAt: Date.now() - 2000 },
  { id: "def-3", text: "Log today's cashflow expenses", completed: false, tag: "Quick", createdAt: Date.now() - 1000 },
  { id: "def-4", text: "Review engineering math notes", completed: false, tag: "College", createdAt: Date.now() },
];

export default function TodayScreen() {
  const date = todayInKolkata();

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

  const resetAllTodos = () => {
    Alert.alert("Reset Checklist?", "This will reset today's checklist to default starter tasks.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: () => {
          setTodos(DEFAULT_TODOS);
        },
      },
    ]);
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
        <Pressable
          onPress={resetAllTodos}
          hitSlop={10}
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="refresh-outline" size={20} color={colors.textFaint} />
        </Pressable>
      }
    >
      {/* Daily Progress Hero Card */}
      <Card style={styles.hero}>
        <View style={ui.spread}>
          <View>
            <Text style={styles.heroLabel}>TODAY'S COMPLETION</Text>
            <Text style={styles.heroValue}>{progressPercent}%</Text>
          </View>
          <View style={styles.priority}>
            <Ionicons name="sparkles" color={colors.emerald} size={18} />
            <Text style={styles.priorityText}>
              {progressPercent === 100
                ? "All actions finished! Superb work today."
                : `${pendingCount} focus ${pendingCount === 1 ? "task" : "tasks"} remaining`}
            </Text>
          </View>
        </View>
        <ProgressBar
          value={progressPercent}
          tone={progressPercent >= 75 ? colors.emerald : progressPercent >= 40 ? colors.cyan : colors.amber}
        />
        <Text style={styles.heroNote}>
          Small, honest daily actions compound into huge breakthroughs.
        </Text>
      </Card>

      {/* Quick Metrics */}
      <Card style={styles.metrics}>
        <Metric label="Completed" value={`${completedCount}/${totalCount}`} accent={colors.emerald} />
        <Metric label="Remaining" value={pendingCount} accent={colors.amber} />
        <Metric
          label="Status"
          value={progressPercent >= 80 ? "On fire" : progressPercent > 0 ? "In flow" : "Ready"}
          accent={colors.cyan}
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
                active && styles.filterChipActive,
              ]}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
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
              style={({ pressed }) => [styles.addPillButton, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name={showAddBox ? "close" : "add"} size={16} color={colors.cyan} />
              <Text style={styles.addPillText}>{showAddBox ? "Cancel" : "Add to-do"}</Text>
            </Pressable>
          }
        />

        {/* Quick Add Form */}
        {showAddBox && (
          <Card style={styles.addCard}>
            <TextInput
              style={styles.addInput}
              value={newTodoText}
              onChangeText={setNewTodoText}
              placeholder="What do you want to accomplish?"
              placeholderTextColor={colors.textFaint}
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
                        active && { backgroundColor: `${cfg.color}22`, borderColor: cfg.color },
                      ]}
                    >
                      <Ionicons
                        name={cfg.icon}
                        size={12}
                        color={active ? cfg.color : colors.textFaint}
                      />
                      <Text
                        style={[
                          styles.tagChipText,
                          active && { color: cfg.color, fontWeight: "700" },
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
                  item.completed && styles.todoRowCompleted,
                  pressed && { opacity: 0.85 },
                ]}
              >
                {/* Apple Style Smooth Circular Checkbox */}
                <View
                  style={[
                    styles.checkCircle,
                    item.completed && styles.checkCircleActive,
                  ]}
                >
                  {item.completed && (
                    <Ionicons name="checkmark" size={14} color="#ffffff" />
                  )}
                </View>

                {/* To-Do Content */}
                <View style={styles.todoCopy}>
                  <Text
                    style={[
                      styles.todoTitle,
                      item.completed && styles.todoTitleCompleted,
                    ]}
                  >
                    {item.text}
                  </Text>
                  <View style={styles.todoMetaRow}>
                    <View
                      style={[
                        styles.metaTagBadge,
                        { backgroundColor: `${tagCfg.color}18`, borderColor: `${tagCfg.color}40` },
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
                  <Ionicons name="close-circle-outline" size={18} color={colors.textFaint} />
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
              <Text style={styles.clearButtonText}>
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
  hero: { borderColor: "#155e75", backgroundColor: "#0c2330", gap: 12 },
  heroLabel: { color: colors.textMuted, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  heroValue: { color: colors.cyan, fontSize: 42, fontWeight: "900", fontVariant: ["tabular-nums"] },
  priority: {
    maxWidth: "58%",
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    backgroundColor: "#172238",
    borderRadius: 12,
    padding: 10,
  },
  priorityText: { color: colors.text, fontSize: 12, lineHeight: 17, fontWeight: "700", flex: 1 },
  heroNote: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  metrics: { flexDirection: "row", gap: 8 },

  filterScroll: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMuted,
  },
  filterChipActive: {
    backgroundColor: "rgba(6, 182, 212, 0.15)",
    borderColor: colors.cyan,
  },
  filterChipText: {
    color: colors.textFaint,
    fontSize: 12,
    fontWeight: "700",
  },
  filterChipTextActive: {
    color: colors.cyan,
  },

  // --- To-Do Section ---
  todoSection: {
    gap: 10,
    marginTop: 6,
  },
  addPillButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(6, 182, 212, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(6, 182, 212, 0.35)",
  },
  addPillText: {
    color: colors.cyan,
    fontSize: 11,
    fontWeight: "800",
  },
  addCard: {
    backgroundColor: "#0d1424",
    borderColor: "rgba(6, 182, 212, 0.4)",
    padding: 12,
    gap: 10,
  },
  addInput: {
    color: colors.text,
    fontSize: 14,
    minHeight: 38,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border,
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    backgroundColor: colors.surface,
  },
  tagChipText: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: "600",
  },
  saveTodoButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.cyan,
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
    backgroundColor: "#0f172a",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#1e293b",
    gap: 12,
  },
  todoRowCompleted: {
    backgroundColor: "#0b1220",
    borderColor: "#141e30",
    opacity: 0.65,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  checkCircleActive: {
    borderColor: colors.emerald,
    backgroundColor: colors.emerald,
  },
  todoCopy: {
    flex: 1,
    gap: 4,
  },
  todoTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19,
  },
  todoTitleCompleted: {
    textDecorationLine: "line-through",
    color: colors.textFaint,
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
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: "700",
  },
});
