# Recoup Tasks

Trigger.dev tasks for Recoup API integrations.

## Getting Started

### Prerequisites

- Node.js 20.x or later
- pnpm 9.x

### Installation

Install dependencies:

```bash
pnpm i
```

### Development

Start the Trigger.dev development server:

```bash
pnpm dev
```

This will start the Trigger.dev CLI in development mode, allowing you to:

- Run tasks locally
- Test task executions
- View task logs and debugging information

### Deployment

Deploy to production:

```bash
pnpm run deploy:trigger-prod
```

## Tasks

- **`sendPulsesTask`** — Daily personalized pulse emails for active accounts (9 AM ET)
- **`proArtistSocialProfilesScrape`** — Nightly social profile scraping for pro artists
- **`customerPromptTask`** — Scheduled customer prompt generation via dynamic schedules
- **`runSandboxCommandTask`** — Run commands in Vercel Sandboxes with OpenCode + AI Gateway, snapshot results, and push to GitHub

## Project Structure

- `src/tasks/` — Task definitions (Trigger.dev scheduled & schema tasks)
- `src/recoup/` — Recoup API client functions
- `src/sandboxes/` — Vercel Sandbox helpers (OpenCode install, GitHub sync, snapshots)
- `src/github/` — GitHub repo creation and naming utilities
- `src/pulse/` — Pulse email formatting
- `src/socials/` — Social profile filtering and scrape orchestration
- `src/artists/` — Artist social data fetching
- `src/chats/` — Chat room ID resolution
- `src/polling/` — Scraper result polling
- `src/schemas/` — Zod schemas for task payloads
- `trigger.config.ts` — Trigger.dev configuration
