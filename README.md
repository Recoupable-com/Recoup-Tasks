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
| --- | --- | --- |
| `customerPromptTask` | Dynamic schedule | Runs a customer-configured prompt on a recurring basis |
| `sendPulsesTask` | Dynamic schedule | Generates and sends daily Pulse email digests for active users |
| `proArtistSocialProfilesScrape` | Daily at midnight ET | Scrapes social profiles for all pro artists |
| `runSandboxCommandTask` | On-demand | Runs commands in a Vercel Sandbox with OpenCode + Vercel AI Gateway, snapshots the result, and pushes to GitHub |

## Project Structure

- `src/tasks/` - Trigger.dev task definitions
- `src/recoup/` - Recoup API client functions
- `src/sandboxes/` - Vercel Sandbox helpers (OpenCode install, GitHub sync, snapshots)
- `src/chats/` - Chat room utilities
- `src/pulse/` - Pulse email formatting
- `src/artists/` - Artist data helpers
- `src/socials/` - Social profile scraping & filtering
- `src/schemas/` - Zod schemas for task payloads
- `src/github/` - GitHub integration helpers
- `src/polling/` - Polling utilities
- `trigger.config.ts` - Trigger.dev configuration
