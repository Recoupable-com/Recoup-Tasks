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
| `customerPromptTask` | Dynamic (per-customer) | Runs a customer-configured prompt in a chat room on a custom schedule |
| `proArtistSocialProfilesScrape` | Daily @ midnight ET | Scrapes social profiles for all pro-tier artists |
| `sendPulsesTask` | Daily @ 9 AM ET | Generates and sends Pulse digest emails with prioritized artist insights |
| `runSandboxCommandTask` | On-demand | Runs a command inside a Vercel Sandbox with OpenCode + AI Gateway, snapshots the result, and pushes to GitHub |

## Project Structure

- `src/tasks/` - Task definitions
- `src/recoup/` - Recoup API client functions
- `src/sandboxes/` - Vercel Sandbox helpers (OpenCode install, GitHub sync, snapshots)
- `src/pulse/` - Pulse email formatting utilities
- `src/artists/` - Artist social profile helpers
- `src/schemas/` - Zod schemas for task payloads
- `trigger.config.ts` - Trigger.dev configuration
