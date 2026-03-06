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
|------|-------------|
| `customerPromptTask` | Scheduled task that runs custom prompts for customers via dynamic Trigger.dev schedules. |
| `sendPulsesTask` | Daily Pulse email digests — surfaces priority artists, recent conversations, and connected data sources (Google Drive/Docs/Sheets via Composio). |
| `proArtistSocialProfilesScrape` | Nightly scrape of social profiles for all pro artists (runs daily at midnight ET). |
| `runSandboxCommandTask` | Executes commands in a Vercel Sandbox with OpenCode + Vercel AI Gateway, snapshots the result, and pushes to GitHub. |

## Project Structure

- `src/tasks/` - Task definitions (see table above)
- `src/recoup/` - Recoup API client functions
- `src/schemas/` - Zod schemas and shared types
- `src/sandboxes/` - Vercel Sandbox helpers (OpenCode install, config, GitHub push)
- `src/pulse/` - Pulse email formatting utilities
- `src/artists/` - Artist data fetching and batching
- `src/socials/` - Social profile scraping and filtering
- `src/chats/` - Chat room helpers
- `src/github/` - GitHub repo utilities
- `trigger.config.ts` - Trigger.dev configuration
