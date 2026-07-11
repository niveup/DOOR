from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if text.count(old) != 1:
        raise SystemExit(f"{label}: expected exactly one match, got {text.count(old)}")
    return text.replace(old, new, 1)

# Journal: retain and render the full current AI response.
path = Path("frontend/app/journal/page.tsx")
text = path.read_text(encoding="utf-8-sig")
text = replace_once(
    text,
    'import { AiSelection, ModelSelector } from "@/components/ModelSelector";',
    'import { AiSelection, ModelSelector } from "@/components/ModelSelector";\nimport { AiMarkdown } from "@/components/AiMarkdown";',
    "journal import",
)
text = replace_once(
    text,
    ' const [lastSavedTask, setLastSavedTask] = useState("");',
    ' const [lastSavedTask, setLastSavedTask] = useState("");\n const [mentorFeedback, setMentorFeedback] = useState("");',
    "journal feedback state",
)
text = replace_once(
    text,
    ' setLastSavedTask("");\n\n try {',
    ' setLastSavedTask("");\n setMentorFeedback("");\n\n try {',
    "journal clear state",
)
text = replace_once(
    text,
    ' setLastSavedTask(data.journal.tomorrowTask || "Saved. Dashboard can now build the plan.");',
    ' setLastSavedTask(data.journal.tomorrowTask || "Saved. Dashboard can now build the plan.");\n setMentorFeedback(data.rawAiOutput || data.journal.aiFeedback || "");',
    "journal response state",
)
anchor = ''' {lastSavedTask ? (
 <div className="rounded-lg border border-[var(--success)]/20 bg-[var(--success-soft)] p-3">
 <p className="section-label text-[var(--success)]">Saved</p>
 <p className="mt-1 text-xs font-semibold text-[var(--success)]">{lastSavedTask}</p>
 </div>
 ) : null}'''
if anchor not in text:
    # The pre-redesign markup uses the same state but different classes. Insert
    # before the branch that closes today's view instead of guessing wrappers.
    marker = ' {lastSavedTask ? ('
    start = text.find(marker)
    if start < 0:
        raise SystemExit("journal render anchor not found")
    end = text.find(' ) : null}', start)
    if end < 0:
        raise SystemExit("journal render block end not found")
    end += len(' ) : null}')
    anchor = text[start:end]
replacement = anchor + '''

 {mentorFeedback ? (
 <PageSection title="Mentor feedback" eyebrow="AI review">
 <div className="surface-flat p-4 sm:p-5">
 <AiMarkdown content={mentorFeedback} />
 </div>
 </PageSection>
 ) : null}'''
text = text.replace(anchor, replacement, 1)
path.write_text(text, encoding="utf-8")

# Tracker: render per-subject AI recommendation whenever the API provides it.
path = Path("frontend/app/tracker/page.tsx")
text = path.read_text(encoding="utf-8-sig")
text = replace_once(
    text,
    'import { AnimatedNumber, EmptyState, MicroInteractionButton, ProgressBar } from "@/components/MotionComponents";',
    'import { AnimatedNumber, EmptyState, MicroInteractionButton, ProgressBar } from "@/components/MotionComponents";\nimport { AiMarkdown } from "@/components/AiMarkdown";',
    "tracker import",
)
text = replace_once(
    text,
    ' hasAvoidanceWarning: boolean;\n}',
    ' hasAvoidanceWarning: boolean;\n aiRecommendation?: string | null;\n}',
    "tracker interface",
)
needle = '{Array.isArray(subject.topics) ? subject.topics.join(", ") : "Topics will appear after seeding."}'
if text.count(needle) != 1:
    raise SystemExit(f"tracker recommendation anchor count {text.count(needle)}")
text = text.replace(
    needle,
    needle + '''

 {subject.aiRecommendation ? (
 <div className="mt-3 border-t border-[var(--border)] pt-3">
 <p className="section-label mb-2">AI recommendation</p>
 <AiMarkdown content={subject.aiRecommendation} />
 </div>
 ) : null}''',
    1,
)
path.write_text(text, encoding="utf-8")

# Interview: technical improved answers may contain Markdown and LaTeX.
path = Path("frontend/app/interview/page.tsx")
text = path.read_text(encoding="utf-8-sig")
text = replace_once(
    text,
    'import { MicroInteractionButton, ProgressBar } from "@/components/MotionComponents";',
    'import { MicroInteractionButton, ProgressBar } from "@/components/MotionComponents";\nimport { AiMarkdown } from "@/components/AiMarkdown";',
    "interview import",
)
old = '<p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--text-secondary)]">{feedback.improved}</p>'
new = '<div className="mt-2 text-[var(--text-secondary)]"><AiMarkdown content={feedback.improved} /></div>'
text = replace_once(text, old, new, "interview improved answer")
path.write_text(text, encoding="utf-8")
