# Agent Instructions

This file provides guidance to coding agents like Claude Code (claude.ai/code) when working with code in this repository.

## Git Workflow

**Always commit and push changes after completing a task.** Follow these rules:

1. After making code changes, always commit with a descriptive message
2. Push commits to the current feature branch
3. **NEVER push directly to `main`** - always use feature branches and PRs

### Starting a New Task

Branch from `main`:

```bash
git checkout main && git pull origin main && git checkout -b <branch-name>
```

### Completing a Task

After pushing changes, create a PR against `main`:

```bash
gh pr create --base main
```

## Build Commands

```bash
pnpm install                     # Install dependencies
pnpm dev                         # Start Trigger.dev dev mode
pnpm run deploy:trigger-prod     # Deploy to production
```

## Architecture

- **Trigger.dev v4** background task workers
- `src/tasks/` - Trigger.dev task definitions
- `src/recoup/` - Recoup API client functions
- `src/schemas/` - Zod schemas for validation
- `src/artists/` - Artist-related utilities
- `src/socials/` - Social media utilities
- `src/polling/` - Polling utilities for async operations

## Code Principles

- **SRP (Single Responsibility Principle)**: One exported function per file
- **DRY (Don't Repeat Yourself)**: Extract shared logic into reusable utilities
- Use Zod for schema validation
- Use `logger` from `@trigger.dev/sdk/v3` for logging

## Testing

- **TDD (Red-Green-Refactor)**: Follow test-driven development for all changes
  1. **Red**: Write a failing test first that reproduces the bug or describes the new behavior
  2. **Green**: Write the minimum code to make the test pass
  3. **Refactor**: Clean up while keeping tests green
- When fixing a bug from production logs, write the test case from the exact error message BEFORE writing the fix
- Run tests with `pnpm test` (vitest)

## Trigger.dev Patterns

- Use v4 SDK: `task()`, `schemaTask()`, `schedules.task()`
- Never use deprecated `client.defineJob`
- `triggerAndWait()` returns `Result` object - check `result.ok` before `result.output`
- Never wrap `triggerAndWait` or `wait` calls in `Promise.all`

## API Endpoints

- **Recoup Chat**: `https://chat.recoupable.com/api`
- **Recoup API**: `https://recoup-api.vercel.app/api`
