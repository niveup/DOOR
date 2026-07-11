from pathlib import Path

app=Path('frontend/components/AppShell.tsx')
text=app.read_text(encoding='utf-8-sig')
anchor='''              {actions ? <div className="shrink-0">{actions}</div> : null}
            </div>
          </div>'''
replacement='''              {actions ? <div className="shrink-0">{actions}</div> : null}
            </div>
            <nav className="tablet-nav" aria-label="Tablet navigation">
              {navItems.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link key={item.href} href={item.href} className={`focus-ring rounded-lg border px-3 py-2 text-xs font-semibold ${active ? "border-[var(--accent)]/25 bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border)] bg-white text-[var(--text-secondary)]"}`}>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>'''
if text.count(anchor)!=1: raise SystemExit(f'AppShell anchor count: {text.count(anchor)}')
app.write_text(text.replace(anchor,replacement,1),encoding='utf-8')

css=Path('frontend/app/globals.css')
styles=css.read_text(encoding='utf-8-sig')
anchor='''.mobile-tab-bar { display: none; }

@media (max-width: 900px) {'''
replacement='''.mobile-tab-bar { display: none; }
.tablet-nav { display: none; }

@media (min-width: 901px) and (max-width: 1023px) {
  .tablet-nav { display: flex; gap: 0.5rem; overflow-x: auto; padding-bottom: 0.25rem; }
  .mobile-content-clearance { padding-bottom: 0; }
}

@media (max-width: 900px) {'''
if styles.count(anchor)!=1: raise SystemExit(f'CSS anchor count: {styles.count(anchor)}')
css.write_text(styles.replace(anchor,replacement,1),encoding='utf-8')
