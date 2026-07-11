from pathlib import Path
import re


def fail(message: str):
    print(f"::error::{message}")
    raise SystemExit(message)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        fail(f"{label}: expected one match, got {count}")
    return text.replace(old, new, 1)

path = Path("frontend/app/journal/page.tsx")
text = path.read_text(encoding="utf-8-sig")
text = replace_once(text, 'import { AiSelection, ModelSelector } from "@/components/ModelSelector";', 'import { AiSelection, ModelSelector } from "@/components/ModelSelector";\nimport { AiMarkdown } from "@/components/AiMarkdown";', "journal import")
text = replace_once(text, ' const [lastSavedTask, setLastSavedTask] = useState("");', ' const [lastSavedTask, setLastSavedTask] = useState("");\n const [mentorFeedback, setMentorFeedback] = useState("");', "journal state")
text, count = re.subn(r'(setLastSavedTask\(""\);\s*)(try \{)', r'\1setMentorFeedback("");\n\n \2', text, count=1)
if count != 1:
    fail(f"journal clear: expected one match, got {count}")
text = replace_once(text, ' setLastSavedTask(data.journal.tomorrowTask || "Saved. Dashboard can now build the plan.");', ' setLastSavedTask(data.journal.tomorrowTask || "Saved. Dashboard can now build the plan.");\n setMentorFeedback(data.rawAiOutput || data.journal.aiFeedback || "");', "journal response")
opening = re.search(r'<AppShell\b[^>]*>', text)
if not opening:
    fail("journal AppShell opening not found")
feedback = '''
 {mentorFeedback ? (
 <PageSection title="Mentor feedback" eyebrow="AI review">
 <div className="surface-flat mb-5 p-4 sm:p-5">
 <AiMarkdown content={mentorFeedback} />
 </div>
 </PageSection>
 ) : null}
'''
text = text[:opening.end()] + feedback + text[opening.end():]
path.write_text(text, encoding="utf-8")

path = Path("frontend/app/tracker/page.tsx")
text = path.read_text(encoding="utf-8-sig")
text = replace_once(text, 'import { AnimatedNumber, EmptyState, MicroInteractionButton, ProgressBar } from "@/components/MotionComponents";', 'import { AnimatedNumber, EmptyState, MicroInteractionButton, ProgressBar } from "@/components/MotionComponents";\nimport { AiMarkdown } from "@/components/AiMarkdown";', "tracker import")
text = replace_once(text, ' hasAvoidanceWarning: boolean;\n}', ' hasAvoidanceWarning: boolean;\n aiRecommendation?: string | null;\n}', "tracker interface")
needle = '{Array.isArray(subject.topics) ? subject.topics.join(", ") : "Topics will appear after seeding."}'
addition = '''

 {subject.aiRecommendation ? (
 <div className="mt-3 border-t border-[var(--border)] pt-3">
 <p className="section-label mb-2">AI recommendation</p>
 <AiMarkdown content={subject.aiRecommendation} />
 </div>
 ) : null}'''
text = replace_once(text, needle, needle + addition, "tracker recommendation")
path.write_text(text, encoding="utf-8")

path = Path("frontend/app/interview/page.tsx")
text = path.read_text(encoding="utf-8-sig")
text = replace_once(text, 'import { MicroInteractionButton, ProgressBar } from "@/components/MotionComponents";', 'import { MicroInteractionButton, ProgressBar } from "@/components/MotionComponents";\nimport { AiMarkdown } from "@/components/AiMarkdown";', "interview import")
text = replace_once(text, '<p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--text-secondary)]">{feedback.improved}</p>', '<div className="mt-2 text-[var(--text-secondary)]"><AiMarkdown content={feedback.improved} /></div>', "interview answer")
path.write_text(text, encoding="utf-8")
