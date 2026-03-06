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

- **`customer-prompt-task`** — Scheduled prompt execution for customer accounts. Fetches task config from the Recoup API, creates a chat room, and generates a response using a configurable model and prompt.
- **`pro-artist-social-profiles-scrape`** — Daily social profile scraping for pro artists. Runs at midnight ET, fetches all pro artists, collects their social profiles, and scrapes them in batches.
- **`run-sandbox-command`** — Runs commands inside Vercel Sandboxes with OpenCode and Vercel AI Gateway. Installs tooling, executes the command, pushes results to GitHub, and snapshots the sandbox.
- **`send-pulses-task`** — Daily personalized Pulse emails sent at 9 AM ET. Gathers artist data, conversations, and connected services to generate a prioritized email digest via Gemini.

## Project Structure

- `src/tasks/` - Task definitions
- `src/recoup/` - Recoup API client functions
- `trigger.config.ts` - Trigger.dev configuration
