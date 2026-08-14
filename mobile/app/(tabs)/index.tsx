import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { AppScreen } from "@/src/components/screen";
import { ActionButton, Card, EmptyState, IconButton, LoadingCard, Metric, ProgressBar, SectionTitle, ui } from "@/src/components/ui";
import { api } from "@/src/services/api";
import { todayInKolkata } from "@/src/lib/format";
import { RoutinePlan, RoutineStatus, RoutineTask } from "@/src/types/domain";
import { colors } from "@/src/theme/tokens";

const statusTone: Record<RoutineStatus, string> = { NOT: colors.textFaint, PARTIAL: colors.amber, COMPLETED: colors.emerald };
const nextStatus: Record<RoutineStatus, RoutineStatus> = { NOT: "PARTIAL", PARTIAL: "COMPLETED", COMPLETED: "NOT" };

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
  { id: "def-1", text: "Revise 1 weak topic formula sheet", completed: false, tag: "GATE", createdAt: Date.now() - 2000 },
  { id: "def-2", text: "Complete 15 practice PYQs", completed: false, tag: "GATE", createdAt: Date.now() - 1000 },
  { id: "def-3", text: "Log today's cashflow expenses", completed: false, tag: "Quick", createdAt: Date.now() },
];

export default function TodayScreen() {
  const date = todayInKolkata();
  const queryClient = useQueryClient();
  const routineQuery = useQuery({ queryKey: ["routine", date], queryFn: () => api.routine.today(date) });

  // --- Personal To-Do State ---
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
          if (Array.isArray(parsed)) {
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

  const taskMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: RoutineStatus }) =>
      api.routine.updateTask(taskId, status),
    onMutate: async ({ taskId, status }) => {
      await queryClient.cancelQueries({ queryKey: ["routine", date] });
      const previous = queryClient.getQueryData<RoutinePlan>(["routine", date]);
      queryClient.setQueryData<RoutinePlan>(["routine", date], (plan) =>
        plan
          ? {
              ...plan,
              tasks: plan.tasks.map((task) => (task.taskId === taskId ? { ...task, status } : task)),
            }
          : plan
      );
      return { previous };
    },
    onError: (_error, _input, context) => queryClient.setQueryData(["routine", date], context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["routine", date] }),
  });

  const clearMutation = useMutation({
    mutationFn: () => api.routine.clear(date),
    onSuccess: () => queryClient.setQueryData(["routine", date], null),
  });

  const generateMutation = useMutation({
    mutationFn: () => api.routine.generate(),
    onSuccess: async (newPlan) => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.setQueryData(["routine", date], newPlan);
    },
    onError: (error: any) => {
      Alert.alert("Could not generate plan", error?.message || "Check your internet connection.");
    },
  });

  const plan = routineQuery.data;
  const tasks = plan?.tasks || [];
  const weightedCompletion = tasks.length
    ? Math.round(
        (tasks.reduce((sum, task) => sum + (task.status === "COMPLETED" ? 1 : task.status === "PARTIAL" ? 0.5 : 0), 0) /
          tasks.length) *
          100
      )
    : 0;
  const completed = tasks.filter((task) => task.status === "COMPLETED").length;
  const totalMinutes = tasks.reduce((sum, task) => sum + task.durationMin, 0);

  const updateTask = async (task: RoutineTask) => {
    const status = nextStatus[task.status];
    await Haptics.impactAsync(
      status === "COMPLETED" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
    );
    taskMutation.mutate({ taskId: task.taskId, status });
  };

  const clearPlan = () =>
    Alert.alert(
      "Clear today’s plan?",
      "This removes the current plan from your backend. It cannot be restored.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear", style: "destructive", onPress: () => clearMutation.mutate() },
      ]
    );

  const completedTodosCount = todos.filter((t) => t.completed).length;
  const todoProgress = todos.length ? Math.round((completedTodosCount / todos.length) * 100) : 0;

  return (
    <AppScreen
      title="Daily Coach"
      subtitle={new Intl.DateTimeFormat("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "short",
      }).format(new Date())}
      refreshing={routineQuery.isRefetching}
      onRefresh={routineQuery.refetch}
      action={
        plan ? (
          <IconButton icon="trash-outline" label="Clear today’s plan" onPress={clearPlan} tone={colors.rose} />
        ) : undefined
      }
    >
      {routineQuery.isLoading ? <LoadingCard /> : null}
      {routineQuery.error ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn’t load today"
          description="Your last synced data stays available offline. Pull down when you’re connected again."
          action={<ActionButton label="Try again" compact onPress={() => routineQuery.refetch()} />}
        />
      ) : null}

      {!routineQuery.isLoading && !routineQuery.error && !plan ? (
        <EmptyState
          icon="calendar-outline"
          title="No AI plan for today"
          description="Generate your personalized schedule based on your available capacity and weak topics."
          action={
            <ActionButton
              label={generateMutation.isPending ? "Generating plan…" : "Generate today’s plan"}
              tone="emerald"
              disabled={generateMutation.isPending}
              onPress={() => generateMutation.mutate()}
            />
          }
        />
      ) : null}

      {plan ? (
        <>
          <Card style={styles.hero}>
            <View style={ui.spread}>
              <View>
                <Text style={styles.heroLabel}>TODAY’S READINESS</Text>
                <Text style={styles.heroValue}>{weightedCompletion}%</Text>
              </View>
              <View style={styles.priority}>
                <Ionicons name="flash" color={colors.amber} size={18} />
                <Text style={styles.priorityText}>{plan.mainPriority || "Start with your priority task"}</Text>
              </View>
            </View>
            <ProgressBar value={weightedCompletion} tone={weightedCompletion >= 70 ? colors.emerald : colors.cyan} />
            <Text style={styles.heroNote}>{plan.greeting || "Small, honest progress compounds."}</Text>
          </Card>
          <Card style={styles.metrics}>
            <Metric label="Done" value={`${completed}/${tasks.length}`} accent={colors.emerald} />
            <Metric label="Focus" value={`${totalMinutes}m`} accent={colors.blue} />
            <Metric label="Streak" value={weightedCompletion >= 80 ? "On" : "Build"} accent={colors.amber} />
          </Card>
          <SectionTitle title="Today’s schedule" trailing={<Text style={styles.helper}>Tap to update</Text>} />
          <View style={styles.tasks}>
            {tasks.map((task) => (
              <TaskRow
                key={task.taskId}
                task={task}
                busy={taskMutation.isPending}
                onPress={() => updateTask(task)}
              />
            ))}
          </View>
        </>
      ) : null}

      {/* --- Apple & Google Styled Focus Checklist / To-Dos --- */}
      <View style={styles.todoSection}>
        <SectionTitle
          title="Focus Checklist"
          trailing={
            <View style={styles.headerPills}>
              {todos.length > 0 && (
                <View style={styles.counterBadge}>
                  <Text style={styles.counterText}>
                    {completedTodosCount}/{todos.length} done
                  </Text>
                </View>
              )}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowAddBox((prev) => !prev);
                }}
                style={({ pressed }) => [styles.addPillButton, pressed && { opacity: 0.7 }]}
              >
                <Ionicons
                  name={showAddBox ? "close" : "add"}
                  size={15}
                  color={colors.cyan}
                />
                <Text style={styles.addPillText}>{showAddBox ? "Cancel" : "Add to-do"}</Text>
              </Pressable>
            </View>
          }
        />

        {todos.length > 0 && (
          <View style={styles.todoProgressBarContainer}>
            <ProgressBar value={todoProgress} tone={todoProgress === 100 ? colors.emerald : colors.cyan} />
          </View>
        )}

        {/* Quick Add Bar */}
        {showAddBox && (
          <Card style={styles.addCard}>
            <TextInput
              style={styles.addInput}
              value={newTodoText}
              onChangeText={setNewTodoText}
              placeholder="What do you want to accomplish today?"
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

        {/* List of To-Dos */}
        <View style={styles.todoList}>
          {todos.map((item) => {
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

                {/* Delete Action */}
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

        {completedTodosCount > 0 && (
          <View style={styles.clearContainer}>
            <Pressable
              onPress={clearCompletedTodos}
              style={({ pressed }) => [styles.clearButton, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.clearButtonText}>
                Clear {completedTodosCount} completed {completedTodosCount === 1 ? "task" : "tasks"}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </AppScreen>
  );
}

function TaskRow({ task, onPress, busy }: { task: RoutineTask; onPress: () => void; busy: boolean }) {
  const completed = task.status === "COMPLETED";
  return (
    <Card style={[styles.task, completed && styles.completedTask]}>
      <View style={[styles.taskIcon, { borderColor: statusTone[task.status] }]}>
        <Ionicons
          name={completed ? "checkmark" : task.status === "PARTIAL" ? "remove" : "ellipse-outline"}
          size={19}
          color={statusTone[task.status]}
        />
      </View>
      <View style={styles.taskCopy}>
        <Text style={[styles.taskTitle, completed && styles.doneText]}>{task.title}</Text>
        <Text style={styles.taskMeta}>
          {task.taskType.toUpperCase()} · {task.durationMin} MIN {task.isPriority ? "· PRIORITY" : ""}
        </Text>
      </View>
      <ActionButton
        label={task.status === "NOT" ? "Start" : task.status === "PARTIAL" ? "Finish" : "Reset"}
        compact
        tone={completed ? "ghost" : task.status === "PARTIAL" ? "emerald" : "cyan"}
        disabled={busy}
        onPress={onPress}
      />
    </Card>
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
  helper: { color: colors.textFaint, fontSize: 11 },
  tasks: { gap: 9 },
  task: { padding: 12, flexDirection: "row", alignItems: "center", gap: 11 },
  completedTask: { opacity: 0.68 },
  taskIcon: {
    width: 34,
    height: 34,
    borderWidth: 1,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  taskCopy: { flex: 1, gap: 4 },
  taskTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  doneText: { textDecorationLine: "line-through", color: colors.textMuted },
  taskMeta: { color: colors.textFaint, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },

  // --- To-Do Section (Apple + Google Modern Aesthetics) ---
  todoSection: {
    marginTop: 18,
    gap: 10,
  },
  headerPills: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  counterBadge: {
    backgroundColor: "#172238",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderMuted,
  },
  counterText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
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
  todoProgressBarContainer: {
    marginBottom: 4,
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
