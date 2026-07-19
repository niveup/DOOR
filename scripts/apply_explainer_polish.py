from pathlib import Path
import re

page = Path("frontend/app/explainer/page.tsx")
text = page.read_text(encoding="utf-8-sig")

def add_class(pattern: str, class_name: str, label: str, flags=0):
    global text
    matches = list(re.finditer(pattern, text, flags))
    if len(matches) != 1:
        raise SystemExit(f"{label}: expected one match, found {len(matches)}")
    start, end = matches[0].span()
    value = text[start:end]
    if class_name in value:
        return
    value = value.replace('className="', f'className="{class_name} ', 1)
    text = text[:start] + value + text[end:]

add_class(r'className="surface[^\"]*shadow-md[^\"]*rounded-2xl[^\"]*bg-white"', "explainer-query-panel", "query panel")
add_class(r'className="surface[^\"]*justify-between[^\"]*rounded-2xl[^\"]*bg-white[^\"]*shadow-sm"', "explainer-session-bar", "session bar")
add_class(r'className="flex items-center justify-between w-full text-left font-bold text-sm[^\"]*cursor-pointer select-none"', "explainer-section-toggle", "section toggle")
add_class(r'className="overflow-hidden mt-3 px-2"', "explainer-section-body", "section body")
add_class(r'className="focus-ring rounded-full border[^\"]*hover:bg-\[var\(--accent-soft\)\][^\"]*cursor-pointer"', "explainer-followup", "follow-up chip")

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
.explainer-section-toggle:hover { transform: translateX(3px); }
.explainer-section-toggle:active { transform: translateX(1px) scale(0.99); }
.explainer-section-body { max-width: 74ch; line-height: 1.78; text-wrap: pretty; }
.explainer-followup {
  transition: color 140ms var(--ease-standard), background-color 140ms var(--ease-standard), border-color 140ms var(--ease-standard), transform 180ms var(--ease-out);
}
.explainer-followup:hover { transform: translateX(4px); }
.explainer-followup:active { transform: translateX(1px) scale(0.98); }
@media (max-width: 900px) {
  .explainer-session-bar { align-items: flex-start; flex-direction: column; gap: 12px; }
  .explainer-section-body { max-width: none; }
}
@media (prefers-reduced-motion: reduce) {
  .explainer-query-panel, .explainer-section-toggle, .explainer-followup { transition: none; }
  .explainer-section-toggle:hover, .explainer-followup:hover { transform: none; }
}
'''
css.write_text(styles, encoding="utf-8")
