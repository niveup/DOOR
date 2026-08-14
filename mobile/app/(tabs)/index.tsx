import { Alert, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export default function TodayScreen() {
  const date = todayInKolkata();
  const queryClient = useQueryClient();
  const routineQuery = useQuery({ queryKey: ["routine", date], queryFn: () => api.routine.today(date) });
  const taskMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: RoutineStatus }) => api.routine.updateTask(taskId, status),
    onMutate: async ({ taskId, status }) => {
      await queryClient.cancelQueries({ queryKey: ["routine", date] });
      const previous = queryClient.getQueryData<RoutinePlan>(["routine", date]);
      queryClient.setQueryData<RoutinePlan>(["routine", date], (plan) => plan ? { ...plan, tasks: plan.tasks.map((task) => task.taskId === taskId ? { ...task, status } : task) } : plan);
      return { previous };
    },
    onError: (_error, _input, context) => queryClient.setQueryData(["routine", date], context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["routine", date] }),
  });
  const clearMutation = useMutation({ mutationFn: () => api.routine.clear(date), onSuccess: () => queryClient.setQueryData(["routine", date], null) });
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
  const weightedCompletion = tasks.length ? Math.round(tasks.reduce((sum, task) => sum + (task.status === "COMPLETED" ? 1 : task.status === "PARTIAL" ? 0.5 : 0), 0) / tasks.length * 100) : 0;
  const completed = tasks.filter((task) => task.status === "COMPLETED").length;
  const totalMinutes = tasks.reduce((sum, task) => sum + task.durationMin, 0);
  const updateTask = async (task: RoutineTask) => { const status = nextStatus[task.status]; await Haptics.impactAsync(status === "COMPLETED" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light); taskMutation.mutate({ taskId: task.taskId, status }); };
  const clearPlan = () => Alert.alert("Clear today’s plan?", "This removes the current plan from your backend. It cannot be restored.", [{ text: "Cancel", style: "cancel" }, { text: "Clear", style: "destructive", onPress: () => clearMutation.mutate() }]);

  return <AppScreen title="Daily Coach" subtitle={new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "short" }).format(new Date())} refreshing={routineQuery.isRefetching} onRefresh={routineQuery.refetch} action={plan ? <IconButton icon="trash-outline" label="Clear today’s plan" onPress={clearPlan} tone={colors.rose} /> : undefined}>
    {routineQuery.isLoading ? <LoadingCard /> : null}
    {routineQuery.error ? <EmptyState icon="cloud-offline-outline" title="Couldn’t load today" description="Your last synced data stays available offline. Pull down when you’re connected again." action={<ActionButton label="Try again" compact onPress={() => routineQuery.refetch()} />} /> : null}
    {!routineQuery.isLoading && !routineQuery.error && !plan ? <EmptyState icon="calendar-outline" title="No plan for today" description="Generate your personalized schedule based on your available capacity and weak topics." action={<ActionButton label={generateMutation.isPending ? "Generating plan…" : "Generate today’s plan"} tone="emerald" disabled={generateMutation.isPending} onPress={() => generateMutation.mutate()} />} /> : null}
    {plan ? <>
      <Card style={styles.hero}><View style={ui.spread}><View><Text style={styles.heroLabel}>TODAY’S READINESS</Text><Text style={styles.heroValue}>{weightedCompletion}%</Text></View><View style={styles.priority}><Ionicons name="flash" color={colors.amber} size={18} /><Text style={styles.priorityText}>{plan.mainPriority || "Start with your priority task"}</Text></View></View><ProgressBar value={weightedCompletion} tone={weightedCompletion >= 70 ? colors.emerald : colors.cyan} /><Text style={styles.heroNote}>{plan.greeting || "Small, honest progress compounds."}</Text></Card>
      <Card style={styles.metrics}><Metric label="Done" value={`${completed}/${tasks.length}`} accent={colors.emerald} /><Metric label="Focus" value={`${totalMinutes}m`} accent={colors.blue} /><Metric label="Streak" value={weightedCompletion >= 80 ? "On" : "Build"} accent={colors.amber} /></Card>
      <SectionTitle title="Today’s tasks" trailing={<Text style={styles.helper}>Tap to update</Text>} />
      <View style={styles.tasks}>{tasks.map((task) => <TaskRow key={task.taskId} task={task} busy={taskMutation.isPending} onPress={() => updateTask(task)} />)}</View>
    </> : null}
  </AppScreen>;
}

function TaskRow({ task, onPress, busy }: { task: RoutineTask; onPress: () => void; busy: boolean }) {
  const completed = task.status === "COMPLETED";
  return <Card style={[styles.task, completed && styles.completedTask]}><View style={[styles.taskIcon, { borderColor: statusTone[task.status] }]}><Ionicons name={completed ? "checkmark" : task.status === "PARTIAL" ? "remove" : "ellipse-outline"} size={19} color={statusTone[task.status]} /></View><View style={styles.taskCopy}><Text style={[styles.taskTitle, completed && styles.doneText]}>{task.title}</Text><Text style={styles.taskMeta}>{task.taskType.toUpperCase()} · {task.durationMin} MIN {task.isPriority ? "· PRIORITY" : ""}</Text></View><ActionButton label={task.status === "NOT" ? "Start" : task.status === "PARTIAL" ? "Finish" : "Reset"} compact tone={completed ? "ghost" : task.status === "PARTIAL" ? "emerald" : "cyan"} disabled={busy} onPress={onPress} /></Card>;
}
const styles = StyleSheet.create({ hero: { borderColor: "#155e75", backgroundColor: "#0c2330", gap: 12 }, heroLabel: { color: colors.textMuted, fontSize: 10, fontWeight: "800", letterSpacing: 1 }, heroValue: { color: colors.cyan, fontSize: 42, fontWeight: "900", fontVariant: ["tabular-nums"] }, priority: { maxWidth: "58%", flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: "#172238", borderRadius: 12, padding: 10 }, priorityText: { color: colors.text, fontSize: 12, lineHeight: 17, fontWeight: "700", flex: 1 }, heroNote: { color: colors.textMuted, fontSize: 13, lineHeight: 19 }, metrics: { flexDirection: "row", gap: 8 }, helper: { color: colors.textFaint, fontSize: 11 }, tasks: { gap: 9 }, task: { padding: 12, flexDirection: "row", alignItems: "center", gap: 11 }, completedTask: { opacity: 0.68 }, taskIcon: { width: 34, height: 34, borderWidth: 1, borderRadius: 11, alignItems: "center", justifyContent: "center" }, taskCopy: { flex: 1, gap: 4 }, taskTitle: { color: colors.text, fontSize: 14, fontWeight: "800" }, doneText: { textDecorationLine: "line-through", color: colors.textMuted }, taskMeta: { color: colors.textFaint, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 } });
