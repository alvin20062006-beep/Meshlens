# MeshLens

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)

> A verifiable agent marketplace for token projects.

**Repository:** [github.com/alvin20062006-beep/Meshlens](https://github.com/alvin20062006-beep/Meshlens)

![MeshLens home page](docs/screenshot-home.png)

## What is MeshLens?

Not a launchpad. Not a terminal. An execution layer.

Turns real on-chain project data into verifiable, replayable agent outputs.

## Current status

- **Runnable agents:** `holder_insight_v1` (holder distribution + analysis) and `growth_strategist_v1` (7-day growth plan) via `POST /api/run/[agentId]`.
- **Registry only:** other agents in the marketplace (e.g. preview/coming soon) are listed but do not start a run until marked `active`.
- **Import agent:** JSON import stores agents in the in-memory registry as “Coming Soon” (not a full custom execution pipeline).
- **Connect:** no demo-project shortcut in the UI; `POST /api/connect` requires a configured **Bags** API key to resolve a project (URL or mint). Legacy client state may still use placeholder slugs `demo` / `test` until a real project is stored.
- **Supabase:** jobs and projects are stored for history/replay; production should use RLS and stricter policies (see **Security** below).

## Key features

- **Project-bound:** connect flow resolves projects through the Bags API when configured.
- **Data-cited:** agents use on-chain sources (e.g. Helius, Solana RPC) with structured outputs and citation metadata where applicable.
- **Replayable:** job rows in Supabase support “same job / same snapshot” style auditing.
- **Extensible UI:** marketplace lists built-in and imported agent metadata.
- **LLM-agnostic:** any OpenAI-compatible provider via `LLM_PROVIDER` / `LLM_API_KEY` / `LLM_MODEL` (see `LLM.md`).

## Architecture

UI (Next.js) → Marketplace & pages → API routes → Helius / Solana / LLM  
→ Supabase (projects + jobs)

## Data sources

| Data | Source |
|------|--------|
| Project identity | Bags API (when `BAGS_API_KEY` is set) |
| Holder distribution | Helius DAS / RPC helpers in API routes |
| Token supply | Solana RPC (`getTokenSupply`) |
| Analysis text | Configurable OpenAI-compatible LLM |
| Job storage | Supabase |

## Setup

1. Clone the repo.
2. `cp .env.example .env.local`
3. Fill in variables (see below). **Never commit** `.env.local` or real keys.
4. Create Supabase tables (schema below).
5. `npm install`
6. `npm run dev` (default dev server port **3333**)

## API routes

- `POST /api/connect` — resolve a Bags project from slug URL or mint (requires `BAGS_API_KEY`).
- `POST /api/run/[agentId]` — run an agent (`holder_insight_v1`, `growth_strategist_v1`).

## Environment variables

**Public (embedded in the browser bundle)** — safe only for values meant to be public:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase **anon** key (designed for frontend use with RLS) |
| `NEXT_PUBLIC_DEMO_CONNECT` | Legacy flag; demo UI removed — leave empty or `false` |

**Server-only secrets** — used in API routes / server code only; must not be prefixed with `NEXT_PUBLIC_`:

| Variable | Purpose |
|----------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS). **Never expose to the client.** |
| `HELIUS_API_KEY` | Helius API (holder insight / DAS). |
| `LLM_API_KEY` | LLM provider API key. |
| `LLM_MODEL` | Model id for the chosen provider. |
| `LLM_PROVIDER` | Optional provider id (`moonshot`, `openai`, …) or base URL — see `LLM.md`. |
| `BAGS_API_KEY` | Bags public API key for `/api/connect`. |

Apply for provider keys yourself (Helius, Bags, LLM vendor, Supabase). This repo ships **no** third-party secrets.

## Scripts

| Command | Notes |
|---------|--------|
| `npm run dev` | Dev server on port 3333 |
| `npm run build` | Production build |
| `npm run start` | Start production server on 3333 |
| `npm run lint` | ESLint via Next.js |

There is **no** `npm test`, `npm run typecheck`, or `test:e2e` script in this package (not defined).

## Supabase schema

```sql
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  mint text not null,
  source_url text not null,
  verification text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id text primary key,
  agent_id text not null,
  project_id uuid references public.projects(id),
  status text not null,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  data_snapshot jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_jobs_created_at on public.jobs(created_at desc);
create index if not exists idx_jobs_project_id on public.jobs(project_id);
```

## Security / RLS

- The anon key is expected in the browser; protect tables with **RLS** appropriate for your threat model.
- The **service role** key must only run on the server (this codebase keeps it in API routes via `lib/supabase-server.ts`).
- Add stronger RLS and network controls for production.

## License

Proprietary — commercial use requires explicit permission from the author.

## GitHub repository settings (optional)

In **Settings → General → About**, you may set description, website URL, and topics (e.g. `nextjs`, `solana`, `supabase`, `meshlens`). For releases, tag (e.g. `v0.1.0`) and draft a release using `CHANGELOG.md` if desired.
