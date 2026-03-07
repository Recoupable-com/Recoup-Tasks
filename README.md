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

| Task | Description |
| --- | --- |
| `customerPromptTask` | Scheduled task that runs customer-configured prompts on a dynamic cron via `schedules.task`. |
| `proArtistSocialProfilesScrape` | Daily scrape of social profiles for all pro-tier artists (midnight ET). |
| `sendPulsesTask` | Generates and sends daily Pulse email digests with artist insights and metrics. |
| `runSandboxCommandTask` | Runs a command inside a Vercel Sandbox with OpenCode + Vercel AI Gateway, snapshots the result, and pushes to GitHub. |

## Project Structure

- `src/tasks/` - Task definitions
- `src/recoup/` - Recoup API client functions
- `trigger.config.ts` - Trigger.dev configuration
