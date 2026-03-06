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

- **`sendPulsesTask`** — Scheduled daily at 9 AM ET. Fetches all accounts with active pulse subscriptions and generates personalized email digests (artist stats, conversation follow-ups, connected-service insights) using Gemini 3 Pro.
- **`runSandboxCommandTask`** — Runs a command inside a Vercel Sandbox with OpenCode + Vercel AI Gateway pre-installed. Ensures a GitHub repo exists, executes the command, pushes results, snapshots the sandbox, and updates the account record.
- **`customerPromptTask`** — Dynamic-schedule task that fetches a prompt config from the Recoup Tasks API and generates a chat response for the given account/artist/room.
- **`proArtistSocialProfilesScrape`** — Runs nightly at midnight ET. Scrapes social profiles for all pro-tier artists in batches and reports success/failure counts.

## Project Structure

- `src/tasks/` - Task definitions
- `src/recoup/` - Recoup API client functions
- `src/sandboxes/` - Vercel Sandbox helpers (OpenCode install, GitHub sync, snapshots)
- `src/pulse/` - Pulse email formatting utilities
- `src/schemas/` - Zod schemas for task payloads
- `trigger.config.ts` - Trigger.dev configuration
