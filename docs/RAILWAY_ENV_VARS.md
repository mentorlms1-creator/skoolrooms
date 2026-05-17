# Railway env vars checklist

When creating the Railway project, paste these env vars from Vercel
(Project Settings → Environment Variables) into the Railway service's
**Variables** tab.

## Supabase
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## AI provider
- `AI_BASE_URL` (= `https://api.claudexia.tech/v1`)
- `AI_API_KEY`
- `AI_MODEL` (e.g. `claude-opus-4-7`)
- `SETTINGS_ENCRYPTION_KEY` — **CRITICAL.** Must match the value from
  Vercel exactly, otherwise existing encrypted `platform_settings` rows
  will fail to decrypt and admin settings will appear blank.

## Brevo
- `BREVO_API_KEY`
- `BREVO_FROM_EMAIL` (= `noreply@skoolrooms.com`)

## Cloudflare
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ZONE_ID`
- `CLOUDFLARE_ACCOUNT_ID`

## R2
- `CLOUDFLARE_R2_ACCESS_KEY`
- `CLOUDFLARE_R2_SECRET_KEY`
- `CLOUDFLARE_R2_BUCKET`
- `CLOUDFLARE_R2_ENDPOINT`
- `CLOUDFLARE_R2_PUBLIC_URL`

## Platform
- `NEXT_PUBLIC_PLATFORM_DOMAIN` (= `skoolrooms.com`)
- `ADMIN_EMAIL`
- `CRON_SECRET`
- `PAYMENT_GATEWAY` (= `mock` until Phase 2)

## Auto-set (do NOT add manually)
| Var | Source |
|---|---|
| `PORT` | Railway injects at runtime; `Dockerfile` honors it |
| `NODE_ENV=production` | Set in `Dockerfile` |
| `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true` | Set in `Dockerfile` |
| `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser` | Set in `Dockerfile` |

## Verification after first deploy
1. Visit the `*.up.railway.app` URL Railway issues.
2. Marketing home page should render.
3. Log in as a teacher → confirm dashboard loads (Supabase env vars OK).
4. Try generating a lesson plan → confirm AI env vars OK.
5. Download a themed PDF → confirms Chromium + standalone bundle OK.
6. Admin → Platform Settings → confirm decrypted values render
   (proves `SETTINGS_ENCRYPTION_KEY` matches).
