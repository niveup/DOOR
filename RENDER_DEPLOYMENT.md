# Render Backend Deployment

The persistent Node/Express + Prisma backend worker runs on Render. This service handles database connections, database migrations, cron tasks, and long-running AI requests.

Render automates deployment using the Blueprint specification in the root `render.yaml` file.

---

## 1. Setup Instructions (Render Blueprint)

1. Sign in to your [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** in the top right corner and select **Blueprint**.
3. Connect your GitHub repository `niveup/DOOR` (Ensure the branch is set to **`deploy/vercel-production-ready`** as this is the active branch where Render blueprint changes and dependencies are configured).
4. Render will automatically parse the root `render.yaml` file and prepare the service named `door-backend`.
5. Enter the required **Environment Variables** (see below) prompted by Render.
6. Click **Apply** to start the deployment.

---

## 2. Environment Variables Configuration

During the Blueprint setup, Render will prompt you for the following environment variables (which are set to `sync: false` in `render.yaml` for security):

| Variable Key | Description / Required Value |
| :--- | :--- |
| `ALLOWED_ORIGINS` | Comma-separated list of exact browser origins permitted by CORS (e.g., `https://jujum.vercel.app`). Do not include trailing slashes. |
| `APP_PASSCODE` | Strong passcode of **at least 8 characters** (e.g., `my_secure_passcode_2026`). Must match the `APP_PASSCODE` set in Vercel. |
| `SESSION_SECRET` | Strong secret of **at least 32 characters** (e.g., a random hash string) used to sign/derive keys. |
| `DATABASE_URL` | Supabase connection string (transaction pooler, port 6543) with `?pgbouncer=true`. |
| `DIRECT_URL` | Supabase direct connection string (port 5432) for running migrations. |
| `AI_API_KEY` | API Key for the default active AI provider (e.g., OpenRouter). |
| `OPENROUTER_API_KEY` | (Optional) OpenRouter API key. |
| `NVIDIA_API_KEY` | (Optional) NVIDIA API key. |
| `CEREBRAS_API_KEY` | (Optional) Cerebras API key. |
| `AI_CREDENTIAL_ENCRYPTION_KEY` | (Optional) Key used to encrypt saved provider credentials. If omitted, falls back to `SESSION_SECRET`. |

*Note: `NODE_ENV` is pre-configured to `production`, `PORT` defaults to `4000`, and `INTERNAL_API_PORT` defaults to `4001` in the blueprint.*

---

## 3. Deployment Steps Executed on Render

When you apply the Blueprint, Render runs:
- **Build Command**: `npm install --include=dev && npm run prisma:generate && npm run build` (inside the `backend/` directory).
- **Start Command**: `npm run start` (running `node dist/gateway.js` on port `4000` internally, proxying to `server.ts` on port `4001`).

---

## 4. Verification & Smoke Test

Once the service is active on Render:
1. Copy the deployed backend URL (e.g., `https://door-backend.onrender.com`).
2. Open `<your-backend-url>/health` in your browser.
3. Confirm that it responds with **HTTP 200** and a JSON body:
   ```json
   {
     "status": "healthy",
     "timestamp": "2026-07-12T..."
   }
   ```
4. Configure your Vercel deployment's `BACKEND_API_URL` to match this backend URL (without a trailing slash), matching the Vercel deployment contract.
