# Private journal storage (Cloudflare D1)

This Worker is the journal's encrypted storage boundary. It only accepts signed requests from the Next.js server; browsers never receive its service secret and it never enables CORS.

## Provision and deploy

1. Install Wrangler and sign in: `npx wrangler login`.
2. Create the free D1 database: `npx wrangler d1 create door-journal`.
3. Put the returned `database_id` into `wrangler.toml`.
4. Apply the schema: `npx wrangler d1 migrations apply door-journal --remote`.
5. Set a 32+ character secret (use the same value in the frontend deployment): `npx wrangler secret put JOURNAL_SERVICE_SECRET`.
6. Deploy: `npx wrangler deploy`.
7. Set `CF_JOURNAL_STORE_URL` to the deployed HTTPS Worker URL and `CF_JOURNAL_STORE_SECRET` to the same service secret in **both Vercel and Render**. Set the same distinct 32+ character `JOURNAL_ENCRYPTION_KEY` in both deployments as well.

D1 stores only AES-256-GCM ciphertext. The Worker can authenticate requests but cannot decrypt a journal entry. Keep `JOURNAL_ENCRYPTION_KEY` only in the Vercel and Render server environments; rotating it requires a deliberate data migration.
