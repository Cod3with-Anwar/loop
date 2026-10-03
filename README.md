# LOOP

LOOP is a Next.js customer-feedback workspace. It provides credential sign-in, tenant-scoped feedback, CSV import, inbox search and status updates, dashboard summaries, theme views, evidence-linked Ask LOOP, and saved voice-of-customer reports.

## Stack

- Next.js 16 App Router and TypeScript
- PostgreSQL with Prisma
- NextAuth credentials sessions and bcrypt password hashing
- Anthropic Messages API for server-side classification, Q&A, and report narrative
- Tailwind CSS

## Requirements

- Node.js 20.9 or newer
- PostgreSQL 15 or newer
- Anthropic API key for AI classification and generated answers/reports

## Local setup

```bash
npm ci
Copy-Item .env.example .env
# Set DATABASE_URL, NEXTAUTH_URL, and NEXTAUTH_SECRET in .env
npx prisma migrate dev
npm run seed
npm run dev
```

Open http://localhost:3000. The seed creates a demo workspace with 120 feedback rows and three accounts:

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@loop.demo | Demo@123 |
| Analyst | analyst@loop.demo | Demo@123 |
| Viewer | viewer@loop.demo | Demo@123 |

These are development credentials only. Replace them before deploying a public demo. `npm run seed` refreshes only the `LOOP Demo Workspace`; it refuses to move a matching demo email from another workspace.

## Environment

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection URL |
| `NEXTAUTH_URL` | Yes | Base URL for this app (for local development, `http://localhost:3000`) |
| `NEXTAUTH_SECRET` | Yes | Long random secret for signed sessions |
| `ANTHROPIC_API_KEY` | For AI | Anthropic API key; never expose it to browser code |
| `OPENAI_API_KEY` | For semantic search | OpenAI key for `text-embedding-3-small` vectors; never expose it to browser code |
| `CLAUDE_MODEL` | No | Model override; defaults to `claude-sonnet-4-6` |

## Architecture and security

Pages call this app's API routes. Server routes resolve the NextAuth session and derive `workspaceId` from the signed session; clients cannot select a tenant. Feedback, themes, and reports queries are scoped to that workspace. The API checks `ADMIN`, `ANALYST`, and `VIEWER` permissions independently of UI visibility. Credentials are hashed with bcrypt. Provider calls happen only in server code.

The login email is globally unique so credentials identify one account unambiguously. The included migration replaces the former `(workspaceId, email)` constraint; if an existing database has the same email in multiple workspaces, resolve those duplicates before applying the migration.

## Implemented routes

- `/api/auth/signup` creates a workspace and its first admin.
- `/api/feedback` supports tenant-scoped search, filters, pagination, and manual entry/classification.
- `/api/feedback/import` imports CSV rows with `content`, `channel`, and optional `customer_label`, `created_at` columns.
- `/api/feedback/[id]` changes status or reclassifies within the caller's workspace.
- `/api/feedback/simulate` adds realistic sample items from simulated channels.
- `/api/members` lets workspace admins add users with a temporary password and assign roles.
- `/api/themes`, `/api/ask`, and `/api/reports` provide workspace-scoped reads and generation.

Ask LOOP stores OpenAI embeddings when `OPENAI_API_KEY` is configured and retrieves by cosine similarity, with keyword matching as a fallback, then provides excerpts to Claude as grounding context. Reports can be printed or saved as PDF from the browser. The current dashboard has live totals, a seven-day volume view, sentiment breakdown, and top themes; user-selectable dashboard date filters and email invitations are not implemented yet.

## Checks

```bash
npm run lint
npx tsc --noEmit
npm run build
```

The build does not verify a live database or Anthropic credentials. Configure those separately and smoke-test the deployed app with the three demo roles.
