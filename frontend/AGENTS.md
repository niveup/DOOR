<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Dark mode / brand-fixed elements
Elements with the `brand-fixed` class use intentionally fixed colors and must never reference theme tokens (--bg-page, --text-primary, etc.). Current registry: .btn-ai-custom (gold/black AI button), .brand-mark (door logo). When adding a new element that should be excluded from dark mode, add this class and add one line here.
