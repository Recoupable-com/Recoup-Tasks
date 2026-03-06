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
| `send-pulses-task` | Daily 9 AM ET | Sends personalized Pulse emails to accounts with active subscriptions (powered by Gemini) |
| `pro-artist-social-profiles-scrape` | Daily midnight ET | Scrapes social profiles for all pro artists in batches |
| `customer-prompt-task` | Dynamic | Runs scheduled prompts configured per-customer via the Recoup Tasks API |
| `run-sandbox-command` | On-demand | Executes commands in a Vercel Sandbox with OpenCode + AI Gateway, snapshots results, and pushes to GitHub |

## Project Structure

- `src/tasks/` - Trigger.dev task definitions
- `src/recoup/` - Recoup API client functions
- `src/sandboxes/` - Vercel Sandbox helpers (OpenCode install, GitHub sync, snapshots)
- `src/github/` - GitHub repo creation and management
- `src/artists/` - Artist social data fetching
- `src/socials/` - Social profile scraping and polling
- `src/chats/` - Chat room utilities
- `src/pulse/` - Pulse email formatting
- `src/schemas/` - Zod validation schemas
- `trigger.config.ts` - Trigger.dev configuration
