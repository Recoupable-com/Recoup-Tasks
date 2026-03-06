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

## Project Structure

- `src/tasks/` - Trigger.dev task definitions
  - `customerPromptTask` - Scheduled prompt execution for customer accounts
  - `proArtistSocialProfilesScrape` - Daily social profile scraping for pro artists
  - `runSandboxCommandTask` - Run commands in Vercel Sandboxes with OpenCode + AI Gateway
  - `sendPulsesTask` - Daily personalized Pulse emails (9 AM ET via Gemini)
- `src/recoup/` - Recoup API client functions
- `src/sandboxes/` - Vercel Sandbox helpers (OpenCode install, GitHub sync, snapshots)
- `src/github/` - GitHub repo creation and management
- `src/artists/` - Artist social data fetching
- `src/socials/` - Social profile scraping and polling
- `src/chats/` - Chat room utilities
- `src/pulse/` - Pulse formatting helpers
- `src/schemas/` - Zod validation schemas
- `types/` - TypeScript type definitions
- `trigger.config.ts` - Trigger.dev configuration
