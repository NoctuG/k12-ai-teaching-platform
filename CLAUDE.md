# CLAUDE.md

This file provides guidance for AI assistants working in this codebase.

## Project Overview

**K12 AI Teaching Platform** — A full-stack web application that helps K12 teachers generate educational resources using AI. Teachers can produce coursework (课件), exams (试卷), lesson plans (教学设计), transcripts (逐字稿), and more from a simple prompt, optionally grounded by their own uploaded knowledge base.

**Target users:** Chinese K12 teachers
**Primary language of UI content and comments:** Chinese (zh-CN)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 7, Tailwind CSS 4, shadcn/ui, Radix UI |
| State / data fetching | TanStack Query 5, tRPC 11 |
| Routing | Wouter 3 |
| Backend | Node.js, Express 4, tRPC 11 |
| Database | MySQL via Drizzle ORM 0.44 |
| File storage | AWS S3 |
| Validation | Zod 4 |
| Auth | JWT (jose 6), OAuth (external provider) |
| Testing | Vitest 2 |
| Package manager | pnpm 10 |

---

## Repository Structure

```
/
├── client/              # React frontend (Vite root)
│   └── src/
│       ├── pages/       # Route-level page components
│       ├── components/  # Shared UI components
│       ├── _core/       # Client-side hooks and utilities
│       ├── contexts/    # React contexts (ThemeContext)
│       ├── hooks/       # Custom React hooks
│       └── lib/         # Helper utilities (tRPC client config)
├── server/              # Express + tRPC backend
│   ├── _core/           # Server infrastructure
│   │   ├── index.ts     # Express app entry point
│   │   ├── trpc.ts      # tRPC init, procedure types
│   │   ├── context.ts   # Request context (auth injection)
│   │   ├── sdk.ts       # Session/JWT management
│   │   ├── oauth.ts     # OAuth routes
│   │   ├── llm.ts       # LLM integration (content generation)
│   │   ├── env.ts       # Environment variable access
│   │   └── ...          # Other services (storage, voice, etc.)
│   ├── routers.ts       # All tRPC routers (auth, user, knowledge, generation, templates, comments)
│   ├── db.ts            # Drizzle ORM database operations
│   └── storage.ts       # S3 upload/download helpers
├── shared/              # Shared code between client and server
│   └── _core/
│       ├── const.ts     # Shared constants (COOKIE_NAME, timeouts, error messages)
│       └── errors.ts    # Shared error types
├── drizzle/             # Database schema and migrations
│   ├── schema.ts        # Drizzle table definitions (source of truth)
│   └── migrations/      # Auto-generated SQL migrations
├── vitest.config.ts     # Test configuration
├── vite.config.ts       # Frontend build configuration
├── drizzle.config.ts    # Database migration configuration
└── tsconfig.json        # TypeScript configuration (strict mode)
```

---

## Development Commands

```bash
# Start dev server (frontend + backend with hot reload)
pnpm dev

# Type checking (no emit)
pnpm check

# Run tests
pnpm test

# Format all files
pnpm format

# Build for production
pnpm build

# Start production server
pnpm start

# Generate and run database migrations
pnpm db:push
```

The dev server runs at `http://localhost:3000`. Vite serves the client at the same port via the Express middleware.

---

## Environment Variables

Set in a `.env` file (not committed). See `server/_core/env.ts` for the full list.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | MySQL connection string |
| `JWT_SECRET` | Cookie signing secret |
| `OAUTH_SERVER_URL` | External OAuth provider URL |
| `OWNER_OPEN_ID` | OpenID of the admin user |
| `BUILT_IN_FORGE_API_URL` | LLM API base URL |
| `BUILT_IN_FORGE_API_KEY` | LLM API key |
| `VITE_APP_ID` | Application identifier |
| `PORT` | HTTP port (default 3000) |

---

## Database

Drizzle ORM with MySQL. Schema is defined in `drizzle/schema.ts` — this is the single source of truth. Never edit migration files by hand; always modify the schema and re-run `pnpm db:push`.

### Tables

| Table | Purpose |
|---|---|
| `users` | Accounts + teacher profile (school, subject, grade, bio) |
| `knowledge_files` | Teacher-uploaded reference documents stored in S3 |
| `generation_history` | Each AI content generation request and its result |
| `resource_templates` | Public and user-uploaded content templates |
| `student_comments` | Batch student comment generation jobs |

### Resource Types (enum)

```
courseware        课件 (PPT/slides)
exam              试卷
lesson_plan       教学设计
lesson_plan_unit  大单元教学设计
transcript        逐字稿
lecture_script    说课稿
homework          作业设计
question_design   试题设计
```

---

## API Layer (tRPC)

All API endpoints are defined in `server/routers.ts`. There are three procedure types:

- `publicProcedure` — no auth required
- `protectedProcedure` — requires authenticated session (throws if not logged in)
- `adminProcedure` — requires `role === "admin"`

### Router structure

```
appRouter
├── system.*           # System/health procedures
├── auth.me            # Get current user
├── auth.logout        # Clear session cookie
├── user.updateProfile # Update teacher profile fields
├── knowledge.list     # List user's knowledge files
├── knowledge.upload   # Upload file (base64) → S3
├── knowledge.delete   # Delete knowledge file
├── generation.generate    # Generate a new resource via LLM
├── generation.list        # List generation history
├── generation.getById     # Get single generation
├── generation.update      # Update title/content
├── generation.delete      # Delete record
├── generation.export      # Export to Word/PPT (calls Python script)
├── comments.generate  # Batch generate student comments
├── templates.list     # List public templates
├── templates.getById  # Get template detail
├── templates.create   # Create user template
└── templates.delete   # Delete user template
```

On the client, call procedures via the tRPC React Query hooks, e.g.:

```typescript
const { data } = trpc.generation.list.useQuery();
const mutation = trpc.generation.generate.useMutation();
```

The tRPC client is configured in `client/src/lib/trpc.ts`.

---

## Authentication

- Login is handled by an external OAuth provider (`OAUTH_SERVER_URL`).
- After OAuth, the server issues a signed JWT stored as an HTTP-only cookie named `app_session_id` (see `shared/_core/const.ts`).
- `server/_core/context.ts` parses the cookie on every request and populates `ctx.user`.
- The value `OWNER_OPEN_ID` controls which user gets the `admin` role on first login.

---

## Frontend Conventions

### Routing

Wouter is used for client-side routing. Routes are declared in `client/src/App.tsx` (or equivalent entry). Pages live in `client/src/pages/`.

### Component library

shadcn/ui components (in `client/src/components/ui/`) are used for all base UI elements. These are copied source files — edit them directly if needed. Do not add shadcn components via the CLI without checking the existing set.

### Styling

- Tailwind CSS 4 utility classes only — no custom CSS files.
- Design language: Scandinavian aesthetic — light cold-gray backgrounds, bold headings, thin body text, pink/blush accent color.
- Dark mode support via `next-themes`.

### State management

- Server state: TanStack Query via tRPC hooks.
- Local UI state: `useState` / `useReducer` directly in components. No global client state library.
- Theme state: `ThemeContext` in `client/src/contexts/`.

### Import aliases

```
@/*         → client/src/*
@shared/*   → shared/*
@assets/*   → attached_assets/*
```

---

## Testing

Tests live alongside server code under `server/`. File naming: `*.test.ts` or `*.spec.ts`.

```bash
pnpm test        # Run all tests once
```

Vitest runs in `node` environment. Use `createAuthContext()` (defined in test helper files) to mock authenticated tRPC contexts.

Current test files:
- `server/generation.test.ts`
- `server/auth.logout.test.ts`
- `server/user.profile.test.ts`
- `server/template.upload.test.ts`

Always run `pnpm check` (TypeScript) and `pnpm test` after making changes.

---

## Code Conventions

- **TypeScript strict mode** is enabled. All new code must be fully typed — avoid `any`.
- **ESM modules** throughout (`"type": "module"` in package.json).
- **Zod** for all input validation in tRPC procedures (`.input(z.object({...}))`).
- **Prettier** enforces formatting: 2-space indent, double quotes, semicolons, 80-char width, trailing commas (ES5). Run `pnpm format` before committing.
- **Drizzle** is the only database access layer — do not use raw SQL strings outside of migration files.
- **No direct `fetch` calls on the client** — all API calls go through tRPC hooks.
- Chinese UI strings are normal and expected — do not translate them.

---

## Export Feature

Generated content can be exported to Word (.docx) or PowerPoint (.pptx) via the `generation.export` procedure. This calls a Python script (`export.py`) that uses `python-docx`/`python-pptx`. Ensure Python and the required packages are available in the production environment if this feature is needed.

---

## Key Files Quick Reference

| File | What it does |
|---|---|
| `server/routers.ts` | All tRPC endpoint definitions |
| `server/db.ts` | All database queries (Drizzle) |
| `server/_core/llm.ts` | LLM call logic for content generation |
| `server/_core/env.ts` | Typed environment variable access |
| `server/_core/trpc.ts` | tRPC init and procedure factories |
| `server/_core/context.ts` | Auth context injected into every request |
| `drizzle/schema.ts` | Database table definitions (source of truth) |
| `shared/_core/const.ts` | Constants shared by client and server |
| `client/src/lib/trpc.ts` | tRPC client setup |
| `vite.config.ts` | Frontend build and dev server config |
