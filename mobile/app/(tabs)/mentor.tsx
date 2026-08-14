import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppScreen } from "@/src/components/screen";
import { ActionButton, Card, Chip, EmptyState, LoadingCard, SectionTitle } from "@/src/components/ui";
import { api } from "@/src/services/api";
import { todayInKolkata } from "@/src/lib/format";
import { JournalEntry } from "@/src/types/domain";
import { colors } from "@/src/theme/tokens";

type MentorMode = "journal" | "explain" | "interview";
const moods = ["1", "2", "3", "4", "5"];

export default function MentorScreen() {
  const client = useQueryClient();
  const [mode, setMode] = useState<MentorMode>("journal");
  const date = todayInKolkata();
  const entry = useQuery({ queryKey: ["journal", date], queryFn: () => api.journal.entry(date), enabled: mode === "journal" });
  const history = useQuery({ queryKey: ["journal-history"], queryFn: api.journal.history, enabled: mode === "journal" });
  const refresh = async () => { await Promise.all([entry.refetch(), history.refetch()]); };
  return <AppScreen title="Jujum Mentor" subtitle="Reflect, learn, then practice under pressure." refreshing={entry.isRefetching || history.isRefetching} onRefresh={refresh}>
    <View style={styles.tabs}>{(["journal", "explain", "interview"] as MentorMode[]).map((item) => <Chip key={item} label={item === "journal" ? "Journal" : item === "explain" ? "Explainer" : "Interview"} active={mode === item} tone={item === "journal" ? colors.violet : item === "explain" ? colors.cyan : colors.amber} onPress={() => setMode(item)} />)}</View>
    {mode === "journal" ? <JournalPanel existing={entry.data?.entry || null} loading={entry.isLoading} error={entry.error ? "The private journal is unavailable right now." : ""} historyCount={history.data?.entries.length || 0} onSaved={() => { client.invalidateQueries({ queryKey: ["journal"] }); client.invalidateQueries({ queryKey: ["journal-history"] }); }} /> : null}
    {mode === "explain" ? <ExplainerPanel /> : null}
    {mode === "interview" ? <InterviewPanel /> : null}
  </AppScreen>;
}

function JournalPanel({ existing, loading, error, historyCount, onSaved }: { existing: JournalEntry | null; loading: boolean; error: string; historyCount: number; onSaved: () => void }) {
  const [content, setContent] = useState(existing?.entryText || "");
  const [mood, setMood] = useState(existing?.mood || "3");
  const [tags, setTags] = useState("");
  const save = useMutation({ mutationFn: api.journal.save, onSuccess: async () => { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onSaved(); } });
  useEffect(() => {
    if (existing) {
      setContent(existing.entryText);
      setMood(existing.mood || "3");
      setTags(existing.tags.join(", "));
    }
  }, [existing]);
  const submit = () => { if (content.trim().length < 20) return; save.mutate({ content: content.trim(), mood, tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 6), date: todayInKolkata() }); };
  if (loading) return <LoadingCard label="Opening your private journal…" />;
  if (error) return <EmptyState icon="lock-closed-outline" title="Private journal unavailable" description={error} />;
  return <>
    <Card style={styles.privacy}><Ionicons name="shield-checkmark-outline" size={18} color={colors.violet} /><Text style={styles.privacyText}>Your journal is encrypted server-side before it reaches the private journal store. It is never kept in the app’s regular cache.</Text></Card>
    {existing?.aiFeedback ? <Card style={styles.feedback}><Text style={styles.feedbackLabel}>TODAY’S MENTOR FEEDBACK</Text><Text style={styles.feedbackText}>{existing.aiFeedback}</Text>{existing.tomorrowTask ? <View style={styles.tomorrow}><Ionicons name="arrow-forward-circle-outline" size={17} color={colors.amber} /><Text style={styles.tomorrowText}>{existing.tomorrowTask}</Text></View> : null}</Card> : null}
    <Card style={styles.form}><Text style={styles.formTitle}>{existing ? "Update today’s reflection" : "Accountability journal"}</Text><Text style={styles.formSubtitle}>Write what happened—not the version that sounds impressive.</Text><Text style={styles.fieldLabel}>MOOD · 1 LOW → 5 CLEAR</Text><View style={styles.moodRow}>{moods.map((item) => <Chip key={item} label={item} active={mood === item} tone={colors.violet} onPress={() => setMood(item)} />)}</View><TextInput value={content} onChangeText={setContent} multiline textAlignVertical="top" style={styles.textarea} placeholder="What happened today? What did you avoid? What is the smallest honest next step?" placeholderTextColor={colors.textFaint} /><TextInput value={tags} onChangeText={setTags} style={styles.tagInput} placeholder="Tags, comma separated (optional)" placeholderTextColor={colors.textFaint} /><ActionButton label={save.isPending ? "Sending to mentor…" : "Get honest feedback"} icon="sparkles-outline" tone="emerald" disabled={save.isPending || content.trim().length < 20} onPress={submit} />{save.error ? <Text style={styles.error}>Couldn’t save this entry. It remains in the editor; try again when connected.</Text> : null}</Card>
    <Text style={styles.history}>{historyCount ? `${historyCount} encrypted journal entries in your history.` : "Your reflections will build a private history here."}</Text>
  </>;
}

function ExplainerPanel() {
  const [subject, setSubject] = useState("GATE CSE");
  const [topic, setTopic] = useState("");
  const [question, setQuestion] = useState("");
  const explain = useMutation({ mutationFn: api.explain, onSuccess: () => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } });
  const submit = () => { const userQuery = question.trim() || topic.trim(); if (userQuery.length >= 2) explain.mutate({ subject, topic: topic.trim(), userQuery }); };
  const result = explain.data?.data as Record<string, any> | undefined;
  const sections = Array.isArray(result?.sections) ? result.sections : [];
  return <>
    <Card style={styles.form}><Text style={styles.formTitle}>GATE concept explainer</Text><Text style={styles.formSubtitle}>Ask exactly where the concept breaks down. Jujum returns a structured Hinglish breakdown and practice prompts.</Text><TextInput value={subject} onChangeText={setSubject} style={styles.tagInput} placeholder="Subject" placeholderTextColor={colors.textFaint} /><TextInput value={topic} onChangeText={setTopic} style={styles.tagInput} placeholder="Topic, e.g. Deadlocks" placeholderTextColor={colors.textFaint} /><TextInput value={question} onChangeText={setQuestion} multiline textAlignVertical="top" style={[styles.textarea, styles.shortTextArea]} placeholder="Your doubt or what you want explained" placeholderTextColor={colors.textFaint} /><ActionButton label={explain.isPending ? "Thinking…" : "Explain this"} icon="bulb-outline" disabled={explain.isPending} onPress={submit} />{explain.error ? <Text style={styles.error}>The explainer is temporarily unavailable. Your question is still here.</Text> : null}</Card>
    {result ? <Card style={styles.explanation}><Text style={styles.feedbackLabel}>{result.session?.topic || result.concept || topic || "CONCEPT BREAKDOWN"}</Text>{result.overview || result.summary ? <Text style={styles.explanationText}>{String(result.overview || result.summary)}</Text> : null}{sections.map((section: any, index: number) => <View key={index} style={styles.section}><Text style={styles.sectionHeading}>{section.title || section.heading || `Part ${index + 1}`}</Text><Text style={styles.sectionText}>{typeof section.content === "string" ? section.content : JSON.stringify(section)}</Text></View>)}{result.quiz?.length ? <View style={styles.quiz}><Text style={styles.sectionHeading}>Practice MCQs</Text><Text style={styles.sectionText}>{result.quiz.map((item: any, index: number) => `${index + 1}. ${item.question || item}`).join("\n\n")}</Text></View> : null}</Card> : null}
  </>;
}

function InterviewPanel() {
  const [company, setCompany] = useState("PSU");
  const [question, setQuestion] = useState("Explain a technical decision you made and how you evaluated trade-offs.");
  const [answer, setAnswer] = useState("");
  const [sessionId] = useState(() => `mobile-${Date.now()}`);
  const evaluate = useMutation({ mutationFn: api.interview, onSuccess: () => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } });
  const submit = () => { if (answer.trim().length >= 20 && question.trim()) evaluate.mutate({ sessionId, questionIndex: 0, sessionLength: 1, company, mode: "Mobile practice", question, answer }); };
  const feedback = evaluate.data || null;
  const dimensions = Array.isArray(feedback?.dimensions) ? feedback.dimensions as Array<{ label?: string; name?: string; value?: number; score?: number }> : [];
  return <>
    <Card style={styles.form}><Text style={styles.formTitle}>Mock interview</Text><Text style={styles.formSubtitle}>A focused round: answer, receive a five-dimension rubric, and improve before the next one.</Text><View style={styles.moodRow}>{["PSU", "Product", "Service"].map((item) => <Chip key={item} label={item} active={company === item} tone={colors.amber} onPress={() => setCompany(item)} />)}</View><TextInput value={question} onChangeText={setQuestion} multiline textAlignVertical="top" style={[styles.textarea, styles.shortTextArea]} placeholder="Interview question" placeholderTextColor={colors.textFaint} /><TextInput value={answer} onChangeText={setAnswer} multiline textAlignVertical="top" style={styles.textarea} placeholder="Write your answer in at least a few sentences…" placeholderTextColor={colors.textFaint} /><ActionButton label={evaluate.isPending ? "Scoring…" : "Evaluate answer"} icon="analytics-outline" tone="rose" disabled={evaluate.isPending || answer.trim().length < 20} onPress={submit} />{evaluate.error ? <Text style={styles.error}>The evaluator could not score this answer. Keep it here and try again.</Text> : null}</Card>
    {feedback ? <Card style={styles.feedback}><Text style={styles.feedbackLabel}>INTERVIEW RUBRIC</Text>{typeof feedback.score === "number" ? <Text style={styles.score}>{feedback.score}/10</Text> : null}{dimensions.map((dimension, index) => <View key={index} style={styles.dimension}><Text style={styles.dimensionLabel}>{dimension.label || dimension.name || `Dimension ${index + 1}`}</Text><Text style={styles.dimensionValue}>{dimension.value ?? dimension.score ?? "—"}</Text></View>)}{typeof feedback.improvedAnswer === "string" ? <><SectionTitle title="Stronger answer" /><Text style={styles.feedbackText}>{feedback.improvedAnswer}</Text></> : null}{typeof feedback.summary === "string" ? <Text style={styles.feedbackText}>{feedback.summary}</Text> : null}</Card> : null}
  </>;
}

const styles = StyleSheet.create({ tabs: { flexDirection: "row", gap: 8 }, privacy: { flexDirection: "row", gap: 10, backgroundColor: "#21123d", borderColor: "#4c1d95", alignItems: "flex-start" }, privacyText: { flex: 1, color: colors.textMuted, fontSize: 12, lineHeight: 18 }, feedback: { borderColor: "#4c1d95", backgroundColor: "#17112b" }, feedbackLabel: { color: colors.violet, fontSize: 10, fontWeight: "900", letterSpacing: 1 }, feedbackText: { color: colors.text, fontSize: 13, lineHeight: 21 }, tomorrow: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, borderRadius: 10, backgroundColor: "#2e1f06" }, tomorrowText: { flex: 1, color: colors.amber, fontSize: 12, lineHeight: 18, fontWeight: "700" }, form: { gap: 12 }, formTitle: { color: colors.text, fontSize: 18, fontWeight: "900" }, formSubtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 19 }, fieldLabel: { color: colors.textMuted, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 }, moodRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" }, textarea: { minHeight: 154, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.canvas, padding: 13, color: colors.text, fontSize: 14, lineHeight: 20 }, shortTextArea: { minHeight: 88 }, tagInput: { minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.canvas, paddingHorizontal: 13, color: colors.text, fontSize: 14 }, error: { color: colors.rose, fontSize: 12, lineHeight: 17 }, history: { color: colors.textFaint, fontSize: 11, textAlign: "center" }, explanation: { gap: 13 }, explanationText: { color: colors.text, fontSize: 14, lineHeight: 21 }, section: { gap: 5, borderLeftWidth: 2, borderColor: colors.cyan, paddingLeft: 11 }, sectionHeading: { color: colors.cyan, fontSize: 13, fontWeight: "900" }, sectionText: { color: colors.textMuted, fontSize: 13, lineHeight: 20 }, quiz: { backgroundColor: "#083344", padding: 12, borderRadius: 12, gap: 7 }, score: { color: colors.rose, fontSize: 34, fontWeight: "900" }, dimension: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.borderMuted, paddingVertical: 8 }, dimensionLabel: { color: colors.textMuted, fontSize: 13 }, dimensionValue: { color: colors.text, fontWeight: "900" } });
