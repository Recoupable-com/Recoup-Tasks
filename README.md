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
| `send-pulses-task` | Daily at 9 AM ET | Sends personalized Pulse emails to accounts with active subscriptions. Uses Gemini to generate prioritized artist insights from conversations, social stats, and connected services. |
| `pro-artist-social-profiles-scrape` | Daily at midnight ET | Scrapes social profiles for all pro artists in batches, polling for results. |
| `customer-prompt-task` | Dynamic (per-account) | Runs a customer-configured prompt against a chat room on a custom schedule. |
| `run-sandbox-command` | On-demand | Connects to a Vercel Sandbox, installs OpenCode with Vercel AI Gateway, runs a command, pushes results to GitHub, and snapshots the sandbox. |

## Project Structure

- `src/tasks/` - Trigger.dev task definitions
- `src/recoup/` - Recoup API client functions
- `src/sandboxes/` - Vercel Sandbox helpers (OpenCode install, GitHub sync, snapshots)
- `src/artists/` - Artist social data fetching
- `src/socials/` - Social profile scraping and filtering
- `src/pulse/` - Pulse email formatting utilities
- `src/chats/` - Chat room ID resolution
- `src/schemas/` - Zod schemas for task payloads
- `src/github/` - GitHub repo creation utilities
- `trigger.config.ts` - Trigger.dev configuration
