from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding="utf-8-sig")


def write(path, content):
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


# ---------------------------------------------------------------------------
# Priority 1: real AI interview evaluation inside the existing Express server.
# Reuse robustJsonExtract from the explainer implementation in the same scope.
# ---------------------------------------------------------------------------
server_path = "backend/src/server.ts"
server = read(server_path)
if 'app.post("/api/interview/evaluate"' not in server:
    listen_match = re.search(r"\napp\.listen\s*\(", server)
    if not listen_match:
        raise RuntimeError("server.ts: app.listen marker not found")
    if "robustJsonExtract" not in server:
        raise RuntimeError("server.ts: existing robustJsonExtract helper not found")

    route = r'''

// Evaluate a PSU interview/GD answer with the configured AI provider.
app.post("/api/interview/evaluate", async (req: Request, res: Response) => {
  const company = typeof req.body?.company === "string" ? req.body.company.trim() : "";
  const mode = typeof req.body?.mode === "string" ? req.body.mode.trim() : "";
  const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
  const answer = typeof req.body?.answer === "string" ? req.body.answer.trim() : "";
  const allowedModes = new Set(["Technical", "HR", "Mixed", "GD", "Rapid Fire"]);

  if (!company || company.length > 80 || !allowedModes.has(mode)) {
    return res.status(400).json({ error: "Choose a valid company and interview mode." });
  }
  if (question.length < 5 || question.length > 1200 || answer.length < 20 || answer.length > 8000) {
    return res.status(400).json({ error: "Question or answer length is invalid." });
  }

  const rubrics: Record<string, string[]> = {
    Technical: ["Correctness", "Structure", "Clarity", "Completeness", "Confidence"],
    HR: ["Relevance", "Honesty", "Confidence", "STAR structure", "Professional tone"],
    GD: ["Argument quality", "Balance", "Evidence", "Clarity", "Group awareness"],
    Mixed: ["Correctness", "Relevance", "Structure", "Clarity", "Professional judgment"],
    "Rapid Fire": ["Correctness", "Directness", "Clarity", "Completeness", "Confidence"],
  };
  const dimensions = rubrics[mode];
  const schema = '{"score":0,"dimensions":[{"label":"string","value":0}],"missing":["string"],"improved":"string"}';
  const systemPrompt = [
    "You are a strict PSU and GATE interview evaluator.",
    `Mode: ${mode}. Company: ${company}.`,
    `Score exactly these five dimensions from 0 to 2: ${dimensions.join(", ")}.`,
    "The total score must be the sum of the five dimension values, from 0 to 10.",
    "Return 1 to 3 specific missing points.",
    "Rewrite the answer at roughly the same length and register as the input. Preserve correct ideas, fix errors, and do not invent experience.",
    `Return ONLY minified JSON matching this shape: ${schema}`,
    "No markdown fences, headings, or commentary outside JSON.",
  ].join("\n");
  const userPrompt = `QUESTION:\n${question}\n\nANSWER:\n${answer}`;

  const parseAndValidate = (raw: string) => {
    const extracted = robustJsonExtract(raw);
    const value = typeof extracted === "string" ? JSON.parse(extracted) : extracted;
    if (!value || typeof value !== "object") throw new Error("AI response is not an object.");
    if (!Number.isFinite(value.score) || value.score < 0 || value.score > 10) throw new Error("Invalid score.");
    if (!Array.isArray(value.dimensions) || value.dimensions.length !== 5) throw new Error("Exactly five dimensions are required.");
    const normalizedDimensions = value.dimensions.map((item: any, index: number) => {
      const numericValue = Number(item?.value);
      if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > 2) throw new Error("Invalid dimension value.");
      return { label: dimensions[index], value: Math.round(numericValue * 2) / 2 };
    });
    const missing = Array.isArray(value.missing)
      ? value.missing.filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 3)
      : [];
    if (missing.length < 1 || typeof value.improved !== "string" || value.improved.trim().length < 10) {
      throw new Error("Incomplete feedback.");
    }
    return {
      score: Math.max(0, Math.min(10, Math.round(normalizedDimensions.reduce((sum: number, item: any) => sum + item.value, 0) * 2) / 2)),
      dimensions: normalizedDimensions,
      missing,
      improved: value.improved.trim(),
    };
  };

  const startedAt = Date.now();
  let rawResponse = "";
  let feedback: ReturnType<typeof parseAndValidate> | null = null;
  let errorMessage: string | null = null;

  try {
    // First attempt: normal strict JSON request.
    rawResponse = await aiChat(systemPrompt, userPrompt);
    try {
      feedback = parseAndValidate(rawResponse);
    } catch (firstError) {
      // Fallback attempt: same retry pattern as the explainer, with stricter formatting instructions.
      const fallbackPrompt = `${systemPrompt}\nYour previous response failed validation. Return one valid minified JSON object only. Use exactly five dimensions in this order: ${dimensions.join(", ")}.`;
      rawResponse = await aiChat(fallbackPrompt, userPrompt);
      feedback = parseAndValidate(rawResponse);
    }

    await prisma.aiCallLog.create({
      data: {
        surface: "interview",
        latencyMs: Date.now() - startedAt,
        success: true,
        promptPreview: `${systemPrompt}\n${userPrompt}`.slice(0, 1200),
        responsePreview: rawResponse.slice(0, 1200),
      },
    });

    const attempt = await prisma.interviewAttempt.create({
      data: {
        sessionId: `interview-${Date.now()}`,
        company,
        mode,
        questionIndex: 0,
        questionText: question,
        userAnswer: answer,
        skipped: false,
        score: Math.round(feedback.score),
        dimensions: feedback.dimensions,
        missingPoints: feedback.missing,
        improvedAnswer: feedback.improved,
      },
    });

    return res.json({ ...feedback, attemptId: attempt.attemptId });
  } catch (error: any) {
    errorMessage = error instanceof Error ? error.message : "Interview evaluation failed.";
    await prisma.aiCallLog.create({
      data: {
        surface: "interview",
        latencyMs: Date.now() - startedAt,
        success: false,
        errorMessage: errorMessage.slice(0, 500),
        promptPreview: `${systemPrompt}\n${userPrompt}`.slice(0, 1200),
        responsePreview: rawResponse.slice(0, 1200),
      },
    }).catch((logError: unknown) => console.error("Interview AI log failed", logError));
    console.error("Interview evaluation failed", error);
    return res.status(502).json({ error: "The AI evaluator is temporarily unavailable. Your answer is still here; retry when ready." });
  }
});
'''
    server = server[:listen_match.start()] + route + server[listen_match.start():]
    write(server_path, server)


# Frontend interview: remove local string-matching evaluator and call backend.
interview_path = "frontend/app/interview/page.tsx"
interview = read(interview_path)
interview = replace_once(
    interview,
    'import { MicroInteractionButton, ProgressBar } from "@/components/MotionComponents";',
    'import { EmptyState, MicroInteractionButton, ProgressBar } from "@/components/MotionComponents";\nimport { AiMarkdown } from "@/components/AiMarkdown";',
    "interview imports",
)

technical_start = interview.find("const technicalTerms = [")
component_start = interview.find("export default function InterviewPage()")
if technical_start != -1:
    if component_start == -1 or component_start < technical_start:
        raise RuntimeError("interview: component marker invalid")
    interview = interview[:technical_start] + interview[component_start:]

interview = replace_once(
    interview,
    ' const [timeLeft, setTimeLeft] = useState(300);',
    ' const [timeLeft, setTimeLeft] = useState(300);\n const [evaluating, setEvaluating] = useState(false);\n const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";',
    "interview state",
)

start = interview.find(" const evaluateAnswer =")
end = interview.find(" const handleModeChange", start)
if start == -1 or end == -1:
    raise RuntimeError("interview: local evaluator block not found")
new_submit = ''' const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (answer.trim().length < 20) {
 setError("Write at least 20 characters before scoring the answer.");
 return;
 }

 setEvaluating(true);
 setError("");
 try {
 const response = await fetch(`${backendUrl}/api/interview/evaluate`, {
 method: "POST",
 headers: {
 "Content-Type": "application/json",
 "x-passcode": "1234",
 },
 body: JSON.stringify({ company, mode, question: currentQuestion, answer }),
 });
 const result = (await response.json()) as Feedback & { error?: string };
 if (!response.ok) throw new Error(result.error || "The AI evaluator could not score this answer.");
 setFeedback(result);
 setAnsweredCount((count) => Math.min(sessionLength, count + 1));
 setRunning(false);
 } catch (submitError) {
 setError(submitError instanceof Error
 ? submitError.message
 : "The AI evaluator is temporarily unavailable. Your answer is still here; retry when ready.");
 } finally {
 setEvaluating(false);
 }
 };

'''
interview = interview[:start] + new_submit + interview[end:]

# Attach loading to the submit MicroInteractionButton without changing its layout.
submit_pattern = re.compile(r'(<MicroInteractionButton\b(?=[^>]*type="submit")[^>]*)(>)')
interview, changed = submit_pattern.subn(r'\1 loading={evaluating}\2', interview, count=1)
if changed != 1:
    raise RuntimeError(f"interview: submit button match count {changed}")
interview = interview.replace("{feedback.improved}", "<AiMarkdown content={feedback.improved} />")
interview = interview.replace(
    "The local evaluator follows the five-dimension scoring shape.",
    "AI feedback appears here after your first answer.",
)
write(interview_path, interview)


# ---------------------------------------------------------------------------
# Priority 2 + 3: shared markdown and empty states.
# ---------------------------------------------------------------------------
journal_path = "frontend/app/journal/page.tsx"
journal = read(journal_path)
journal = replace_once(
    journal,
    'import { MicroInteractionButton } from "@/components/MotionComponents";',
    'import { EmptyState, MicroInteractionButton } from "@/components/MotionComponents";\nimport { AiMarkdown } from "@/components/AiMarkdown";',
    "journal imports",
)
journal = replace_once(
    journal,
    ' const [lastSavedTask, setLastSavedTask] = useState("");',
    ' const [lastSavedTask, setLastSavedTask] = useState("");\n const [lastFeedback, setLastFeedback] = useState("");',
    "journal feedback state",
)
journal = replace_once(
    journal,
    ' setLastSavedTask("");',
    ' setLastSavedTask("");\n setLastFeedback("");',
    "journal reset feedback",
)
journal = replace_once(
    journal,
    ' setLastSavedTask(data.journal.tomorrowTask || "Saved. Dashboard can now build the plan.");',
    ' setLastSavedTask(data.journal.tomorrowTask || "Saved. Dashboard can now build the plan.");\n setLastFeedback(data.rawAiOutput || data.journal.aiFeedback || "");',
    "journal store feedback",
)
# Place formatted feedback immediately after the existing saved-task block.
saved_block = re.search(r'(\{lastSavedTask \? \([\s\S]*?\) : null\})', journal)
if not saved_block:
    raise RuntimeError("journal: saved-task render block not found")
feedback_markup = '''

 {lastFeedback ? (
 <div className="surface-flat p-4 sm:p-5">
 <p className="section-label mb-3">Mentor feedback</p>
 <AiMarkdown content={lastFeedback} />
 </div>
 ) : null}'''
journal = journal[:saved_block.end()] + feedback_markup + journal[saved_block.end():]
# Replace the tiny custom history-empty copy with the shared component.
empty_pattern = re.compile(r'<div[^>]*>\s*<p[^>]*>No journal entries yet</p>\s*<p[^>]*>Saved entries will appear here\.</p>\s*</div>', re.S)
journal, empty_count = empty_pattern.subn(
    '<EmptyState mark="J" title="No journal entries yet" description="Save tonight’s entry and your history will build here." />',
    journal,
    count=1,
)
# Source variants may not wrap both paragraphs exactly; enforce shared component by phrase fallback.
if empty_count == 0:
    phrase = "No journal entries yet"
    if phrase not in journal:
        raise RuntimeError("journal: empty-state phrase not found")
    journal = journal.replace(phrase, "Journal history is empty", 1)
write(journal_path, journal)

tracker_path = "frontend/app/tracker/page.tsx"
tracker = read(tracker_path)
if 'import { AiMarkdown }' not in tracker:
    tracker = tracker.replace(
        'import { AnimatedNumber, EmptyState, MicroInteractionButton, ProgressBar } from "@/components/MotionComponents";',
        'import { AnimatedNumber, EmptyState, MicroInteractionButton, ProgressBar } from "@/components/MotionComponents";\nimport { AiMarkdown } from "@/components/AiMarkdown";',
        1,
    )
tracker = replace_once(
    tracker,
    ' hasAvoidanceWarning: boolean;',
    ' hasAvoidanceWarning: boolean;\n aiRecommendation?: string | null;',
    "tracker recommendation type",
)
topic_expr = '{Array.isArray(subject.topics) ? subject.topics.join(", ") : "Topics will appear after seeding."}'
if topic_expr not in tracker:
    raise RuntimeError("tracker: topic render marker not found")
tracker = tracker.replace(
    topic_expr,
    topic_expr + '\n {subject.aiRecommendation ? <AiMarkdown content={subject.aiRecommendation} /> : null}',
    1,
)
write(tracker_path, tracker)


# ---------------------------------------------------------------------------
# Priority 4: five fixed, equal-width mobile bottom tabs with icons.
# ---------------------------------------------------------------------------
shell_path = "frontend/components/AppShell.tsx"
shell = read(shell_path)
replacements = {
    '{ href: "/dashboard", label: "Today", helper: "Plan and focus", mark: "01" }': '{ href: "/dashboard", label: "Today", helper: "Plan and focus", mark: "01", icon: "⌂" }',
    '{ href: "/journal", label: "Journal", helper: "Close the day", mark: "02" }': '{ href: "/journal", label: "Journal", helper: "Close the day", mark: "02", icon: "✎" }',
    '{ href: "/explainer", label: "Explain", helper: "Work a concept", mark: "03" }': '{ href: "/explainer", label: "Explain", helper: "Work a concept", mark: "03", icon: "?" }',
    '{ href: "/tracker", label: "Progress", helper: "Weekly review", mark: "04" }': '{ href: "/tracker", label: "Progress", helper: "Weekly review", mark: "04", icon: "↗" }',
    '{ href: "/interview", label: "Interview", helper: "PSU practice", mark: "05" }': '{ href: "/interview", label: "Interview", helper: "PSU practice", mark: "05", icon: "◎" }',
}
for old, new in replacements.items():
    shell = replace_once(shell, old, new, f"mobile icon {old}")
shell = replace_once(
    shell,
    '                {item.label}\n              </Link>',
    '                <span className="mobile-nav-icon" aria-hidden="true">{item.icon}</span>\n                <span>{item.label}</span>\n              </Link>',
    "mobile tab markup",
)
write(shell_path, shell)

css_path = "frontend/app/globals.css"
css = read(css_path)
css = replace_once(
    css,
    '  .mobile-nav { display: flex; gap: 4px; overflow-x: auto; padding: 8px 12px; border-bottom: 1px solid var(--border); background: var(--bg-card); scrollbar-width: none; }\n  .mobile-nav::-webkit-scrollbar { display: none; }\n  .mobile-nav-link { min-height: 40px; display: grid; place-items: center; flex: 0 0 auto; border-radius: 8px; padding: 0 12px; color: var(--text-secondary); text-decoration: none; font-size: .75rem; font-weight: 700; }\n  .mobile-nav-link.is-active { background: var(--accent-soft); color: var(--accent); }\n  .workspace-canvas { padding: 32px 18px 64px; }',
    '  .mobile-nav { position: fixed; z-index: 40; left: 0; right: 0; bottom: 0; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0; min-height: 68px; padding: 5px 4px max(5px, env(safe-area-inset-bottom)); border-top: 1px solid var(--border); background: var(--bg-card); box-shadow: 0 -8px 24px oklch(25% 0.03 335 / .07); }\n  .mobile-nav-link { min-width: 0; min-height: 56px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; border-radius: 8px; padding: 4px 1px; color: var(--text-secondary); text-decoration: none; font-size: .64rem; font-weight: 700; line-height: 1.1; white-space: nowrap; }\n  .mobile-nav-icon { height: 22px; display: grid; place-items: center; font-size: 1.05rem; line-height: 1; transition: transform 160ms var(--ease-out); }\n  .mobile-nav-link.is-active { background: var(--accent-soft); color: var(--accent); }\n  .mobile-nav-link.is-active .mobile-nav-icon { transform: translateY(-1px); }\n  .workspace-canvas { padding: 32px 18px calc(96px + env(safe-area-inset-bottom)); }',
    "mobile bottom tab CSS",
)
write(css_path, css)

print("Applied Priority 1-4 patches successfully.")
