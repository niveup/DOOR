from pathlib import Path

explainer = Path("frontend/app/explainer/page.tsx")
text = explainer.read_text(encoding="utf-8-sig")

old = 'const suggestedPrompts = [\n "Explain Fourier Series",\n "What is Heap Memory?",\n "Kirchhoff\'s Laws",\n "Difference between Stack and Queue",\n "Why does Binary Search work?",\n];'
new = 'const suggestedPrompts = [\n "Explain entropy and irreversibility",\n "Mohr\'s circle for plane stress",\n "Boundary layer separation",\n "Vapour compression refrigeration cycle",\n "Casting defects and remedies",\n];'
if old in text: text = text.replace(old, new, 1)

replacements = [
 ('className="surface p-4 sm:p-5 flex flex-col gap-4 shadow-md border border-[var(--border)] rounded-2xl bg-white"', 'className="surface explainer-query-form p-4 sm:p-5 flex flex-col gap-4 shadow-md border border-[var(--border)] rounded-2xl bg-white"'),
 ('className="surface flex justify-between items-center border border-[var(--border)] p-4 px-6 rounded-2xl bg-white shadow-sm"', 'className="surface explainer-session-bar flex justify-between items-center border border-[var(--border)] p-4 px-6 rounded-2xl bg-white shadow-sm"'),
 ('className="flex items-center justify-between w-full text-left font-bold text-sm text-[var(--text-primary)] py-2 hover:bg-[var(--bg-elevated)] px-2 rounded-lg transition cursor-pointer select-none"', 'className="explainer-section-toggle flex items-center justify-between w-full text-left font-bold text-sm text-[var(--text-primary)] py-2 hover:bg-[var(--bg-elevated)] px-2 rounded-lg transition cursor-pointer select-none"'),
 ('className="focus-ring rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] transition cursor-pointer"', 'className="explainer-followup focus-ring rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] transition cursor-pointer"'),
]
for old, new in replacements:
    if old in text: text = text.replace(old, new, 1)

explainer.write_text(text, encoding="utf-8")

renderer = Path("frontend/components/AiMarkdown.tsx")
text = renderer.read_text(encoding="utf-8-sig")
for old, new in [
 ('className="my-6 flex flex-col gap-5"', 'className="explainer-quiz my-6 flex flex-col gap-5"'),
 ('className="h-32 [perspective:1000px] cursor-pointer"', 'className="explainer-flashcard h-32 [perspective:1000px] cursor-pointer"'),
 ('className="my-5 flex flex-col gap-3"', 'className="explainer-interview-cards my-5 flex flex-col gap-3"'),
 ('className="my-4 py-3 px-4 border-l-2 border-[var(--accent)] bg-[var(--bg-elevated)]/40 rounded-r-xl flex flex-col md:flex-row md:items-center justify-between gap-4"', 'className="explainer-formula-block my-4 py-3 px-4 border-l-2 border-[var(--accent)] bg-[var(--bg-elevated)]/40 rounded-r-xl flex flex-col md:flex-row md:items-center justify-between gap-4"'),
 ('className="my-6 rounded-xl border border-[var(--border)]/60 bg-white p-4 flex flex-col items-center justify-center relative min-h-[140px] shadow-sm"', 'className="explainer-diagram my-6 rounded-xl border border-[var(--border)]/60 bg-white p-4 flex flex-col items-center justify-center relative min-h-[140px] shadow-sm"'),
]:
    if old in text: text = text.replace(old, new, 1)
renderer.write_text(text, encoding="utf-8")

css = Path("frontend/app/globals.css")
text = css.read_text(encoding="utf-8-sig")
css_add = r'''

/* Explainer-only output rhythm and micro-interactions. Base tokens stay unchanged. */
.explainer-query-form { transition: border-color 160ms var(--ease-standard), transform 180ms var(--ease-out); }
.explainer-query-form:focus-within { border-color: var(--accent); }
.explainer-session-bar { transition: transform 160ms var(--ease-out), border-color 160ms var(--ease-standard); }
.explainer-session-bar:hover { transform: translateY(-1px); border-color: var(--border-strong); }
.explainer-section-toggle { transition: background-color 120ms var(--ease-standard), color 120ms var(--ease-standard), transform 120ms var(--ease-out); }
.explainer-section-toggle:hover { background: var(--bg-elevated); color: var(--accent); }
.explainer-section-toggle:active { transform: scale(.99); }
.explainer-section-toggle svg, .explainer-section-toggle span:first-child { transition: transform 180ms var(--ease-out); }
.explainer-followup { transition: transform 150ms var(--ease-out), background-color 150ms var(--ease-standard), color 150ms var(--ease-standard); }
.explainer-followup:hover { transform: translateX(3px); }
.explainer-followup:active { transform: translateX(1px) scale(.98); }
.explainer-formula-block { transition: transform 150ms var(--ease-out), background-color 150ms var(--ease-standard); }
.explainer-formula-block:hover { transform: translateY(-2px); background-color: var(--bg-elevated); }
.explainer-formula-block:active { transform: translateY(0) scale(.995); }
.explainer-quiz button { transition: transform 120ms var(--ease-out), background-color 120ms var(--ease-standard), border-color 120ms var(--ease-standard); }
.explainer-quiz button:hover { transform: translateX(2px); }
.explainer-quiz button:active { transform: translateX(1px) scale(.985); }
.explainer-flashcard { transition: transform 180ms var(--ease-out); }
.explainer-flashcard:hover { transform: translateY(-3px); }
.explainer-flashcard:active { transform: translateY(0) scale(.985); }
.explainer-interview-cards button { transition: padding 160ms var(--ease-out), background-color 160ms var(--ease-standard); }
.explainer-interview-cards button:hover { padding-left: 1.1rem; }
.explainer-diagram img { transition: opacity 180ms var(--ease-out), transform 180ms var(--ease-out); }
.explainer-diagram img:hover { transform: scale(1.01); }
@media (max-width: 900px) {
  .explainer-formula-block { overflow-x: auto; }
}
@media (prefers-reduced-motion: reduce) {
  .explainer-query-form, .explainer-session-bar, .explainer-section-toggle, .explainer-followup, .explainer-formula-block, .explainer-quiz button, .explainer-flashcard, .explainer-interview-cards button, .explainer-diagram img { animation: none; transition: none; }
}
'''
if '.explainer-query-form' not in text: text += css_add
css.write_text(text, encoding="utf-8")
