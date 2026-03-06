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
| `customer-prompt-task` | Dynamic (per-customer) | Runs a customer-configured prompt on a schedule |
| `pro-artist-social-profiles-scrape` | Daily at midnight ET | Scrapes social profiles for all pro artists |
| `run-sandbox-command` | On-demand | Runs a command in a Vercel Sandbox with OpenCode + AI Gateway |
| `send-pulses` | Daily at 9 AM ET | Generates and sends daily Pulse digest emails |

## Project Structure

- `src/tasks/` - Task definitions
- `src/recoup/` - Recoup API client functions
- `trigger.config.ts` - Trigger.dev configuration
