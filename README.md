# Yes Chief

`Yes Chief` is a real-time voice cooking tutor web application built on `LiveKit` and `LiveKit Agents`.

Its core is not a "recipe management system," but a "voice coach that stays online during cooking, can be interrupted, and continues to guide you."

## Core Concept

After entering a cooking session, users interact with the agent primarily through voice:

- The agent proactively explains the current step
- Users can interrupt with questions at any time
- Users and the agent can advance steps, create timers, pause, or end sessions via voice
- The page only displays the current step, timers, and summary—no button-driven workflow

The first MVP only supports `preset recipes only`:

- No account system
- No recipe upload
- No automatic recipe parsing
- No complex backend

This keeps the implementation focused on the "real-time voice tutoring experience" rather than the content production pipeline.

## Architecture Principles

The project adopts a three-app architecture:

```text
apps/
  webui/
  api/
  agent/
packages/
  shared/
```

Responsibilities are clearly separated:

- `webui`: Voice entry point and auxiliary display layer
- `api`: Source of business truth
- `agent`: Real-time voice execution layer

Core data flow:

```text
User mic -> WebUI -> LiveKit Room -> Agent
Agent speech -> LiveKit Room -> WebUI speaker

WebUI -> API -> SQLite
Agent -> API -> SQLite
```

The purpose of this separation:

- Avoid coupling real-time voice, business state, and persistence together
- Ensure authoritative state for sessions, steps, and timers resides in `api`
- Let `agent` focus on "what to say to the user now"

## MVP Interaction Model

The ideal session experience:

1. User opens the web page and authorizes the microphone.
2. `webui` creates a session and joins the corresponding `LiveKit room`.
3. `agent` enters the room, reads the current `SessionSnapshot`, and begins voice guidance.
4. User cooks while asking questions, reporting progress, or controlling timers via voice.
5. `agent` only calls `api` when state changes are needed; regular Q&A is based on the snapshot.
6. After the session ends, `api` generates and persists a summary for the page to display.

Two key constraints:

- Business state changes can only be made through `api` commands
- Natural conversation itself should not cause session state drift

## Why This Design

The focus of this project is not to implement all capabilities, but to prove the following with a minimal yet complete system:

- Voice-first human-machine collaboration workflows are viable
- `LiveKit + LiveKit Agents` is suitable for real-time cooking tutor scenarios
- `snapshot + event log` is sufficient for MVP without heavier event sourcing
- `polling` is stable and simple enough for first-version UI state sync

In other words, the core value of `Yes Chief` is:

`A cooking guidance system centered on real-time voice, with API as the source of business truth and web pages as auxiliary views.`

## Current Design Scope

Tech stack is set:

- Monorepo: `bun workspaces`
- WebUI: `React + Vite + Tailwind CSS + ShadcnUI`
- API: `Elysia`
- Database: `SQLite + Drizzle`
- Agent: `TypeScript + @livekit/agents`
- Shared contracts: `packages/shared`
- Tooling: `oxlint + oxfmt`

Additional constraints:

- Frontend does not use `React Router`
- `zod` is only used for agent tool parameter schemas
- All environment variables are in the root `.env`
- Local development entry point is `bun run dev` in the root directory
- Before first agent run, execute `bun run agent:download-files` in the root directory
- Final deployment target is `docker compose`

## Docker Compose Quick Start

For interview submission and evaluation, the project can now be started with Docker Compose.

Run from the repository root:

```bash
cp ".env.example" ".env"
```

Then edit `.env` and fill in:

- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

Start the project with:

```bash
docker compose up --build
```

If you want to start it in detached mode:

```bash
docker compose up --build -d
```

Then open `http://localhost:8080`.

Useful endpoints:

- `http://localhost:8080` for the web UI
- `http://localhost:3000/health` for the API health check

Notes:

- The repository does not bundle a self-hosted `LiveKit` stack. Use your own LiveKit Cloud or existing LiveKit deployment credentials.
- The default compose setup persists SQLite data in a Docker volume.
- The first `agent` image build downloads voice runtime files, so the initial build takes longer than subsequent runs.
