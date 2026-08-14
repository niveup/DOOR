# DOOR Android

Native Expo Router client for the existing DOOR / Jujum AI Express + Prisma API. It does not create or use a mobile database.

## Configure

1. Copy `.env.example` to `.env`.
2. Set `EXPO_PUBLIC_API_URL` to the HTTPS URL of the existing Render backend, without a trailing slash.
3. Ensure the backend has its existing `APP_PASSCODE`, Supabase/Prisma, AI provider, and private-journal D1 environment variables configured.

The user enters the same `APP_PASSCODE` on the device. It is first verified at `GET /api/auth/verify`, then stored only through `expo-secure-store` (Android Keystore). Every API call sends it in `x-passcode`.

## Run

```powershell
cd D:\DOOR\mobile
npm run android
```

For a production Android binary, use EAS Build or prebuild the project after configuring the final Android package name in `app.json`.

## Architecture

- `app/` — Expo Router routes and tab screens.
- `src/services/` — secure storage, typed REST API client, React Query offline persistence.
- `src/providers/` — authentication session state.
- `src/components/` — shared native UI primitives.
- `src/types/` — API/domain contracts.
- `src/theme/` — cyber-academic design tokens.

Regular task, finance, and tracker responses are persisted for fast offline loading and optimistic updates. Journal entries are intentionally excluded from the regular cache and are encrypted server-side before reaching the private D1 store.
