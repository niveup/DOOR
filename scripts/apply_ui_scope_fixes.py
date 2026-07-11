from pathlib import Path
import re

explainer=Path('frontend/app/explainer/page.tsx')
text=explainer.read_text(encoding='utf-8-sig')
start=text.find('const suggestedPrompts = [')
end=text.find('];',start)
if start<0 or end<0: raise SystemExit('suggestedPrompts not found')
replacement='''const suggestedPrompts = [
 "Explain entropy and irreversibility",
 "Mohr’s circle for plane stress",
 "Boundary layer separation",
 "Vapour compression refrigeration cycle",
 "Casting defects and remedies",
];'''
text=text[:start]+replacement+text[end+2:]
explainer.write_text(text,encoding='utf-8')

dashboard=Path('frontend/app/dashboard/page.tsx')
d=dashboard.read_text(encoding='utf-8-sig')
d=d.replace('const visibleTasks = plan?.tasks?.length ? plan.tasks : sampleTasks;', 'const visibleTasks = plan?.tasks || [];')
dashboard.write_text(d,encoding='utf-8')

css=Path('frontend/app/globals.css')
c=css.read_text(encoding='utf-8-sig')
mobile='''

.mobile-tab-bar { display: none; }
@media (max-width: 900px) {
 .workspace-canvas { padding-bottom: calc(96px + env(safe-area-inset-bottom)); }
 .mobile-tab-bar { position: fixed; z-index: 60; left: 0; right: 0; bottom: 0; display: grid; grid-template-columns: repeat(5,minmax(0,1fr)); min-height: 68px; padding: 6px 4px calc(6px + env(safe-area-inset-bottom)); border-top: 1px solid var(--border); background: var(--bg-card); box-shadow: 0 -8px 24px rgba(32,33,36,.08); }
 .mobile-tab { display: flex; min-width: 0; min-height: 56px; flex-direction: column; align-items: center; justify-content: center; gap: 3px; border-radius: 8px; color: var(--text-secondary); text-decoration: none; font-size: 10px; font-weight: 650; transition: color 160ms var(--ease-standard), background-color 160ms var(--ease-standard); }
 .mobile-tab svg { flex: 0 0 auto; }
 .mobile-tab span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
 .mobile-tab.is-active { background: var(--accent-soft); color: var(--accent); }
 .page-section { margin-top: 28px; }
 .surface, .surface-flat, .premium-card { max-width: 100%; }
 table { max-width: 100%; }
}
@media (prefers-reduced-motion: reduce) { .mobile-tab { transition: none; } }
'''
if '.mobile-tab-bar {' not in c: c+=mobile
css.write_text(c,encoding='utf-8')
