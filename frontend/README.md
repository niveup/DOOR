# Jujum AI - Frontend

Next.js 15 (App Router) UI for Jujum AI, a personal GATE Mechanical + PSU
prep mentor. The frontend is hosted on Vercel; all AI, database, and cron
work happens in the separate Express backend (`../backend`).

## Stack

- Next.js + React 19
- Tailwind CSS v4 (design tokens in `app/globals.css`)
- Poppins via `next/font`
- `iron-session` passcode gate (see `middleware.ts` + `lib/session.ts`)
- `motion` for animations, `sonner` for toasts
- `react-markdown` + `katex` for AI-rendered explanations

## Getting started

```bash
cp .env.example .env.local   # then fill in the values
npm install
npm run dev
```

Open http://localhost:3000. You will be redirected to `/passcode` until you
authenticate with `APP_PASSCODE`.

## Required environment

See `.env.example`. The app intentionally throws on boot if `SESSION_SECRET`
(32+ chars) is missing, and login fails if `APP_PASSCODE` is unset. Point
`NEXT_PUBLIC_API_URL` at the backend.

## Pages

- `/dashboard` - today's plan, score, weak-subject focus
- `/journal` - evening accountability entry + AI feedback
- `/explainer` - concept explainer with rich rendering
- `/tracker` - 14-subject weekly readiness grid
- `/interview` - PSU mock interview practice
- `/settings/ai` - AI provider / model configuration
