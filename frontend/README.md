# Envoy — Local-First AI Sales Agent

A human-in-the-loop outbound email agent.  
Pipeline: **CSV → scrape → profile → draft → approve → send → store**

---

## Architecture

| Layer | Stack |
|---|---|
| Backend | Node.js · Express · Socket.io · SQLite (better-sqlite3) |
| Frontend | React · Vite · TypeScript · Framer Motion |
| AI | Anthropic Claude (profile + draft) |
| Email | Nodemailer / Gmail OAuth2 |
| Approvals | Google Chat webhook (optional) |

---

## Quick Start

### 1. Backend

```bash
cd envoy-agent
cp .env.example .env       # fill in your API keys
npm install
npm run server             # starts on :3001
```

### 2. Frontend

```bash
# from project root
npm install
npm run dev                # starts on :5173
```

Open http://localhost:5173

---

## First Run

1. Add leads to `envoy-agent/data/leads.csv`
2. Go to **Settings** → configure Sender Profile and ICP
3. Return to **Dashboard** → click **Start Run**
4. When a draft appears, review and **Approve** or **Rewrite** with instructions
5. Approved emails are sent immediately (unless Dry Run is ON)
6. View history in the **Past Runs** page

---

## Features

### Dashboard
- Realtime lead pipeline with status stages
- Fit score (1–10) with colour coding — green ≥ 8, amber ≥ 6, orange ≥ 4, red < 4
- Per-lead progress bar and step label
- Draft preview with approve / rewrite / skip actions
- **Rewrite with instructions** — type a note before requesting a rewrite
- Live log panel
- Dry run mode (no emails sent)

### Settings
- **Sender Profile** — name, company, role, value prop, tone, CTA
- **ICP Configuration** — titles, industries, company size, exclude domains
- **Run Configuration** — leads per run, fit score threshold, dry run default, model
- **AI Prompts** — edit profile and email prompts live (saved to `prompts/*.txt`)
- **SMTP / GChat** — connection test buttons
- All config changes are persisted to `config.yaml` immediately

### History
- Full run history fetched from SQLite database
- Expandable rows showing per-lead status (sent / skipped / failed)
- Pagination for large histories

---

## Socket Events

| Direction | Event | Payload |
|---|---|---|
| Server → Client | `run:started` | `{ runId, config }` |
| Server → Client | `run:stopped` | `{ runId }` |
| Server → Client | `run:complete` | summary |
| Server → Client | `lead:added` | lead object |
| Server → Client | `lead:updated` | `{ id, ...fields }` |
| Server → Client | `log:entry` | log entry |
| Server → Client | `stats:updated` | stats counts |
| Server → Client | `approval:required` | `{ leadId }` |
| Client → Server | `run:start` | `{ region, industry, leadsCount, dryRun }` |
| Client → Server | `run:stop` | — |
| Client → Server | `action:approve` | `{ leadId }` |
| Client → Server | `action:skip` | `{ leadId }` |
| Client → Server | `action:rewrite` | `{ leadId, note }` |

---

## REST API

| Method | Path | Description |
|---|---|---|
| POST | `/api/run/start` | Start a pipeline run |
| POST | `/api/run/stop` | Stop the active run |
| GET | `/api/run/current` | Get active run state |
| GET | `/api/runs` | All run history |
| GET | `/api/runs/:id/leads` | Leads for a run |
| GET | `/api/runs/:id/logs` | Logs for a run |
| GET | `/api/config` | Read config.yaml |
| POST | `/api/config` | Update config.yaml (deep merge) |
| GET | `/api/prompts/:name` | Read a prompt (`profile` or `email`) |
| POST | `/api/prompts/:name` | Write a prompt |
| POST | `/api/action/approve` | Approve a lead |
| POST | `/api/action/skip` | Skip a lead |
| POST | `/api/action/rewrite` | Request a rewrite with note |
| POST | `/api/test/smtp` | Test SMTP connection |
| POST | `/api/test/gchat` | Test GChat webhook |
| GET | `/api/health` | Server health check |

---

## Config

`envoy-agent/config.yaml` — editable via Settings UI or directly.

Key sections:
- `sender` — email persona
- `icp` — ideal customer profile
- `run` — pipeline behaviour
- `claude` — model selection
- `scraping` — timeouts
- `gchat` — approval polling

---

## Reconnect Behaviour

When the browser reconnects mid-run, the server re-hydrates the client:
1. Emits `run:started` with current run ID and config
2. Re-emits all `lead:added` events (deduplicated client-side)
3. Re-emits all `log:entry` events (deduplicated by ID)
4. Re-emits `stats:updated`
5. Re-emits `approval:required` for any pending leads

---

## File Structure

```
envoy-agent/
  config.yaml          ← agent config (editable via Settings UI)
  prompts/
    profile.txt        ← profiling prompt (editable via Settings UI)
    email.txt          ← email drafting prompt (editable via Settings UI)
  data/
    leads.csv          ← input leads
    db.sqlite          ← run history (auto-created)
  lib/
    runner.js          ← pipeline orchestrator
    scraper.js         ← Playwright scraper
    profiler.js        ← Claude profiler
    drafter.js         ← Claude email drafter
    sender.js          ← Nodemailer sender
    db.js              ← SQLite helpers
    emitter.js         ← Socket.io emitter + camelCase converter
  server.js            ← Express + Socket.io server

src/
  views/
    Dashboard.tsx      ← main pipeline UI
    History.tsx        ← run history (from DB)
    Settings.tsx       ← config + prompt editor
  components/
    leads/             ← LeadCard, ApprovalBanner, LeadsPanel
    layout/            ← Topbar, BottomBar, ControlsBar, StatsRow
    log/               ← LogPanel, LogEntry
    shared/            ← Badge, EmptyState, ProgressBar, Toast
  hooks/
    useRunState.ts     ← state reducer (reconnect-aware)
    useSocket.ts       ← socket event binding
    useToast.ts        ← toast notifications
  lib/
    api.ts             ← Axios client + typed API helpers
    socket.ts          ← Socket.io client singleton
    constants.ts       ← shared constants
```
