# Cloudflare Deployment Plan

## Recommendation

Use Cloudflare as the primary public delivery layer for DREEM's online surface and public school-facing experience.

## Proposed Split

### Frontend Hosting

- Cloudflare Pages

Why:

- strong free tier
- global CDN
- easy static deployment for Vite builds
- custom domains and SSL

### Backend Platform

- Supabase

Why:

- Postgres
- auth
- storage
- realtime
- edge functions

### Optional Edge Logic Later

- Cloudflare Workers

Use cases:

- request routing
- custom API gateway behavior
- lightweight middleware
- analytics or edge transformations

### Optional Worker Layer

- Render

Use cases:

- long-running background jobs
- OneDrive sync and document jobs
- heavier report generation
- orchestration that does not belong in the browser or a lightweight edge function

## Recommended Online Architecture

1. `Cloudflare Pages` serves the DREEM web app.
2. The web app connects to `Supabase` for auth, database, storage, and realtime.
3. Later, schools that need resilience also use a `local school node`.
4. That local node syncs selected data with the cloud platform.
5. If DREEM later needs heavy asynchronous processing, `Render` can host worker services without replacing the Cloudflare frontend.

## Why This Is A Good Start

This gives DREEM:

- fast public availability
- low starting cost
- strong scalability
- a simple pilot path
- room to evolve into hybrid local-plus-cloud operation
