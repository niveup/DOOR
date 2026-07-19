from pathlib import Path

page = Path("frontend/app/explainer/page.tsx")
text = page.read_text(encoding="utf-8-sig")

replacements = [
    (
        'className="surface p-4 sm:p-5 flex flex-col gap-4 shadow-md border border-[var(--border)] rounded-2xl bg-white"',
        'className="surface explainer-query-panel p-4 sm:p-5 flex flex-col gap-4 shadow-md border border-[var(--border)] rounded-2xl bg-white"',
        "query panel",
    ),
    (
        'className="surface flex justify-between items-center border border-[var(--border)] p-4 px-6 rounded-2xl bg-white shadow-sm"',
        'className="surface explainer-session-bar flex justify-between items-center border border-[var(--border)] p-4 px-6 rounded-2xl bg-white shadow-sm"',
        "session bar",
    ),
    (
        'className="flex items-center justify-between w-full text-left font-bold text-sm text-[var(--text-primary)] py-2 hover:bg-[var(--bg-elevated)] px-2 rounded-lg transition cursor-pointer select-none"',
        'className="explainer-section-toggle flex items-center justify-between w-full text-left font-bold text-sm text-[var(--text-primary)] py-2 hover:bg-[var(--bg-elevated)] px-2 rounded-lg transition cursor-pointer select-none"',
        "section toggle",
    ),
    (
        'className="overflow-hidden mt-3 px-2"',
        'className="explainer-section-body overflow-hidden mt-3 px-2"',
        "section body",
    ),
    (
        'className="focus-ring rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] transition cursor-pointer"',
        'className="explainer-followup focus-ring rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] transition cursor-pointer"',
        "follow-up chip",
    ),
]

for old, new, label in replacements:
    count = text.count(old)
    if count < 1:
        raise SystemExit(f"{label}: expected at least one match, found {count}")
    text = text.replace(old, new)

page.write_text(text, encoding="utf-8")

css = Path("frontend/app/globals.css")
styles = css.read_text(encoding="utf-8-sig")
marker = "\n/* Explainer-only output polish */\n"
if marker not in styles:
    styles += marker + r'''
.explainer-query-panel {
  transition: border-color 160ms var(--ease-standard), box-shadow 180ms var(--ease-out), transform 180ms var(--ease-out);
}
.explainer-query-panel:focus-within {
  border-color: color-mix(in srgb, var(--accent) 42%, var(--border));
  box-shadow: 0 10px 28px rgba(32, 33, 36, 0.07);
}
.explainer-session-bar {
  gap: 20px;
}
.explainer-section-toggle {
  position: relative;
  min-height: 44px;
  transition: color 140ms var(--ease-standard), background-color 140ms var(--ease-standard), transform 140ms var(--ease-out);
}
.explainer-section-toggle:hover {
  transform: translateX(3px);
}
.explainer-section-toggle:active {
  transform: translateX(1px) scale(0.99);
}
.explainer-section-body {
  max-width: 74ch;
  line-height: 1.78;
  text-wrap: pretty;
}
.explainer-followup {
  transition: color 140ms var(--ease-standard), background-color 140ms var(--ease-standard), border-color 140ms var(--ease-standard), transform 180ms var(--ease-out);
}
.explainer-followup:hover {
  transform: translateX(4px);
}
.explainer-followup:active {
  transform: translateX(1px) scale(0.98);
}
@media (max-width: 900px) {
  .explainer-session-bar { align-items: flex-start; flex-direction: column; gap: 12px; }
  .explainer-section-body { max-width: none; }
}
@media (prefers-reduced-motion: reduce) {
  .explainer-query-panel,
  .explainer-section-toggle,
  .explainer-followup { transition: none; }
  .explainer-section-toggle:hover,
  .explainer-followup:hover { transform: none; }
}
'''
css.write_text(styles, encoding="utf-8")
'''}]}}.functions.call_tool(...) 大发快三和值?, invalid? Need correct tool name call_tool args object, prior tool call likely malformed? It shows no output. Let's retry properly. қари.