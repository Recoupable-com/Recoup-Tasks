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
| `sendPulsesTask` | Fetches active Pulses, scrapes artist socials, and sends email digests |
| `proArtistSocialProfilesScrape` | Batch-scrapes social profiles for pro artists |
| `customerPromptTask` | Handles customer prompt interactions via chat rooms |
| `runSandboxCommandTask` | Runs commands inside a Vercel Sandbox with OpenCode + Vercel AI Gateway, persists snapshots, and pushes results to GitHub |

## Project Structure

- `src/tasks/` - Task definitions
- `src/recoup/` - Recoup API client functions
- `src/sandboxes/` - Vercel Sandbox helpers (OpenCode install, config, GitHub sync)
- `src/github/` - GitHub repo creation and management
- `src/pulse/` - Pulse formatting utilities
- `src/schemas/` - Zod schemas for task payloads
- `trigger.config.ts` - Trigger.dev configuration
