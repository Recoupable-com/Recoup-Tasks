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

| Task | Schedule | Description |
|------|----------|-------------|
| `customer-prompt-task` | Dynamic (per-customer) | Runs a customer-configured prompt on a schedule |
| `pro-artist-social-profiles-scrape` | Daily at midnight ET | Scrapes social profiles for all pro artists |
| `run-sandbox-command` | On-demand | Runs a command in a Vercel Sandbox with OpenCode + AI Gateway |
| `send-pulses` | Daily at 9 AM ET | Generates and sends daily Pulse digest emails |

## Project Structure

- `src/tasks/` - Trigger.dev task definitions
- `src/recoup/` - Recoup API client functions
- `src/sandboxes/` - Vercel Sandbox helpers (OpenCode setup, GitHub sync, snapshots)
- `src/artists/` - Artist data utilities
- `src/chats/` - Chat/room helpers
- `src/github/` - GitHub repo creation and management
- `src/polling/` - Scraper result polling
- `src/pulse/` - Pulse email formatting
- `src/schemas/` - Zod schemas for task payloads
- `src/socials/` - Social profile scraping orchestration
- `types/` - Shared TypeScript types
- `trigger.config.ts` - Trigger.dev configuration
