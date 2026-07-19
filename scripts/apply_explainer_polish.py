from pathlib import Path

page = Path("frontend/app/explainer/page.tsx")
text = page.read_text(encoding="utf-8-sig")
if "className=\"explainer-page\"" not in text:
    open_marker = "return (\n"
    app_marker = "<AppShell"
    start = text.find(open_marker, text.find("export default function ExplainerPage"))
    app = text.find(app_marker, start)
    if start < 0 or app < 0:
        raise SystemExit("Explainer return/AppShell anchor not found")
    text = text[:app] + '<div className="explainer-page">\n ' + text[app:]
    close = text.find("</AppShell>", app)
    if close < 0:
        raise SystemExit("Explainer AppShell close not found")
    close_end = close + len("</AppShell>")
    text = text[:close_end] + "\n </div>" + text[close_end:]
page.write_text(text, encoding="utf-8")

css = Path("frontend/app/globals.css")
styles = css.read_text(encoding="utf-8-sig")
marker = "\n/* Explainer-only output polish */\n"
if marker not in styles:
    styles += marker + r'''
.explainer-page .ai-markdown {
  max-width: 74ch;
  line-height: 1.78;
  text-wrap: pretty;
}
.explainer-page .ai-markdown > p:first-child {
  font-size: 1.04rem;
  line-height: 1.68;
}
.explainer-page .ai-markdown h2,
.explainer-page .ai-markdown h3 {
  margin-top: 1.8rem;
  margin-bottom: .65rem;
  letter-spacing: -.015em;
}
.explainer-page .ai-markdown blockquote {
  margin-block: 1.5rem;
  padding: .9rem 1rem;
  border-radius: 8px;
  background: var(--bg-elevated);
}
.explainer-page button {
  transition: color 140ms var(--ease-standard), background-color 140ms var(--ease-standard), border-color 140ms var(--ease-standard), transform 150ms var(--ease-out);
}
.explainer-page button:active {
  transform: scale(.985);
}
.explainer-page button[aria-expanded="true"] {
  color: var(--accent);
}
.explainer-page button[aria-expanded="true"] svg {
  transform: rotate(90deg);
}
.explainer-page button svg {
  transition: transform 160ms var(--ease-out);
}
.explainer-page button:hover {
  transform: translateY(-1px);
}
.explainer-page button:active {
  transform: translateY(0) scale(.985);
}
.explainer-page [class*="katex"] {
  max-width: 100%;
  overflow-x: auto;
}
@media (max-width: 900px) {
  .explainer-page .ai-markdown { max-width: none; }
  .explainer-page .ai-markdown table { display: block; max-width: 100%; overflow-x: auto; }
}
@media (prefers-reduced-motion: reduce) {
  .explainer-page button,
  .explainer-page button svg { transition: none; }
  .explainer-page button:hover,
  .explainer-page button:active { transform: none; }
}
'''
css.write_text(styles, encoding="utf-8")
