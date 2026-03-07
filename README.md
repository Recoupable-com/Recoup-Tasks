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

| Task | ID | Trigger | Description |
|------|----|---------|-------------|
| `customerPromptTask` | `customer-prompt-task` | Dynamic schedule | Runs a customer-configured prompt on a schedule, fetching task config and generating a chat response. |
| `proArtistSocialProfilesScrape` | `pro-artist-social-profiles-scrape` | Cron (daily midnight ET) | Scrapes and updates social profiles for all pro-tier artists. |
| `sendPulsesTask` | `send-pulses-task` | Schedule | Generates and sends daily Pulse email digests with artist insights, social stats, and connected-app context. |
| `runSandboxCommandTask` | `run-sandbox-command` | On-demand (schema) | Connects to a Vercel Sandbox, installs OpenCode with Vercel AI Gateway, runs a command, snapshots the result, and pushes to GitHub. |

## Project Structure

- `src/tasks/` - Task definitions
- `src/recoup/` - Recoup API client functions
- `trigger.config.ts` - Trigger.dev configuration
