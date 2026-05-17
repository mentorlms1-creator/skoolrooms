# syntax=docker/dockerfile:1.4

# ----- Builder stage -----
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .

# Build-time env vars. Railway with Dockerfile builds requires explicit
# ARG declarations — service variables are injected as build args, but
# only consumed when the Dockerfile names them. Next.js 16 evaluates
# Server Components during `next build` (page-data collection), so any
# variable read at module import or during render must be present here.
# NEXT_PUBLIC_* vars are also inlined into the client bundle at build,
# so they MUST be set in the builder stage.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_PLATFORM_DOMAIN
ARG SUPABASE_SERVICE_ROLE_KEY
ARG SETTINGS_ENCRYPTION_KEY
ARG AI_BASE_URL
ARG AI_API_KEY
ARG AI_MODEL
ARG BREVO_API_KEY
ARG BREVO_FROM_EMAIL
ARG CLOUDFLARE_API_TOKEN
ARG CLOUDFLARE_ZONE_ID
ARG CLOUDFLARE_ACCOUNT_ID
ARG CLOUDFLARE_R2_ACCESS_KEY
ARG CLOUDFLARE_R2_SECRET_KEY
ARG CLOUDFLARE_R2_BUCKET
ARG CLOUDFLARE_R2_ENDPOINT
ARG CLOUDFLARE_R2_PUBLIC_URL
ARG ADMIN_EMAIL
ARG CRON_SECRET
ARG PAYMENT_GATEWAY

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_PLATFORM_DOMAIN=$NEXT_PUBLIC_PLATFORM_DOMAIN \
    SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY \
    SETTINGS_ENCRYPTION_KEY=$SETTINGS_ENCRYPTION_KEY \
    AI_BASE_URL=$AI_BASE_URL \
    AI_API_KEY=$AI_API_KEY \
    AI_MODEL=$AI_MODEL \
    BREVO_API_KEY=$BREVO_API_KEY \
    BREVO_FROM_EMAIL=$BREVO_FROM_EMAIL \
    CLOUDFLARE_API_TOKEN=$CLOUDFLARE_API_TOKEN \
    CLOUDFLARE_ZONE_ID=$CLOUDFLARE_ZONE_ID \
    CLOUDFLARE_ACCOUNT_ID=$CLOUDFLARE_ACCOUNT_ID \
    CLOUDFLARE_R2_ACCESS_KEY=$CLOUDFLARE_R2_ACCESS_KEY \
    CLOUDFLARE_R2_SECRET_KEY=$CLOUDFLARE_R2_SECRET_KEY \
    CLOUDFLARE_R2_BUCKET=$CLOUDFLARE_R2_BUCKET \
    CLOUDFLARE_R2_ENDPOINT=$CLOUDFLARE_R2_ENDPOINT \
    CLOUDFLARE_R2_PUBLIC_URL=$CLOUDFLARE_R2_PUBLIC_URL \
    ADMIN_EMAIL=$ADMIN_EMAIL \
    CRON_SECRET=$CRON_SECRET \
    PAYMENT_GATEWAY=$PAYMENT_GATEWAY \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

RUN npm run build

# ----- Runner stage -----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Next.js standalone server.js defaults to binding localhost only, which
# makes the container unreachable from outside (including Railway's
# healthchecker). HOSTNAME=0.0.0.0 makes it listen on all interfaces.
ENV HOSTNAME=0.0.0.0
# PORT default — Railway overrides at runtime via its injected PORT var,
# and server.js honors process.env.PORT.
ENV PORT=3000

# Chromium + fonts for puppeteer-core (system browser, not bundled).
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
