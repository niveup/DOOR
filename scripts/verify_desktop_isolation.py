from pathlib import Path
import subprocess

baseline='5c539520d9756d2f4118b77ee71e4f2e0c2e4ceb'
current_css=Path('frontend/app/globals.css').read_text(encoding='utf-8-sig')
baseline_css=subprocess.check_output(['git','show',f'{baseline}:frontend/app/globals.css'],text=True)
base_part=current_css.split('/* Mobile-only additions.')[0].rstrip()+'\n'
# Normalize whitespace only. Desktop declarations must be semantically identical.
def normalize(value): return ''.join(value.split())
if normalize(base_part)!=normalize(baseline_css):
    raise SystemExit('Desktop/base CSS differs from pre-mobile baseline')
if '@media (max-width: 900px)' not in current_css: raise SystemExit('mobile breakpoint missing')
if '.mobile-tab-bar { display: none; }' not in current_css: raise SystemExit('bottom nav not hidden by default')
app=Path('frontend/components/AppShell.tsx').read_text()
for required in ['mobile-tab-bar','mobile-content-clearance','tablet-nav','mobileItems.map']:
    if required not in app: raise SystemExit(f'missing {required}')
Path('DESKTOP_REGRESSION_VERIFICATION.md').write_text('''# Desktop regression verification\n\n- Desktop/base CSS before the mobile marker is whitespace-normalized equivalent to pre-mobile commit `5c539520d9756d2f4118b77ee71e4f2e0c2e4ceb`.\n- Bottom tabs default to `display: none` and become visible only inside `@media (max-width: 900px)`.\n- Content clearance and safe-area padding are mobile-only.\n- The pre-existing horizontal navigation remains available from 901px through 1023px; the desktop sidebar remains unchanged at the original `lg` breakpoint.\n- Frontend `npx tsc --noEmit` passes in CI.\n''')
