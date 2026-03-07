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
| `sendPulsesTask` | Generate and deliver recurring Pulse reports for artists |
| `customerPromptTask` | Run a customer-facing prompt through the AI pipeline |
| `proArtistSocialProfilesScrape` | Scrape and ingest social profiles for pro-tier artists |
| `runSandboxCommandTask` | Execute commands inside a Vercel Sandbox with OpenCode + Vercel AI Gateway, snapshot the result, and push to GitHub |

## Project Structure

- `src/tasks/` - Task definitions
- `src/recoup/` - Recoup API client functions
- `trigger.config.ts` - Trigger.dev configuration
