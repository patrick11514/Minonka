# CLAUDE.md - Minonka Discord Bot

## Project Overview

Minonka is a TypeScript Discord bot that provides League of Legends statistics and information. It integrates with Riot Games' official API and generates image-based responses for Discord users.

## Tech Stack

- **Runtime**: Node.js (v20+ for dev, v24 for deploy)
- **Language**: TypeScript 5.7 (ES2022 target, ESM modules)
- **Package Manager**: pnpm
- **Discord**: discord.js v14
- **Database**: MySQL with Kysely ORM
- **Image Processing**: sharp
- **Validation**: zod
- **Worker Communication**: WebSocket (ws)

## Essential Commands

```bash
# Development
pnpm run dev              # Run bot with hot reload
pnpm run dev:worker       # Run worker with hot reload

# Build & Production
pnpm run build            # Compile TypeScript
pnpm run start            # Run compiled bot
pnpm run start:register   # Register slash commands (run once after changes)
pnpm run start:worker     # Run worker process

# Code Quality
pnpm run lint             # Prettier + ESLint check
pnpm run format           # Auto-format code
pnpm run check            # TypeScript type check

# Database
pnpm run migrate          # Run migrations
pnpm run genDatabaseSchema # Generate database types
```

## Directory Structure

```
src/
├── index.ts              # Main entry point
├── commands/             # Discord slash commands
├── crons/                # Scheduled tasks (status, lp, version)
├── Worker/               # Image generation worker
│   ├── Worker.ts         # Worker entry point
│   └── tasks/            # Image generation tasks
├── lib/
│   ├── DiscordBot.ts     # Discord client & command loader
│   ├── WorkerServer.ts   # Worker process management
│   ├── Imaging/          # Image processing utilities
│   ├── Riot/             # Riot API integration
│   └── langs/            # Localization (en, cs)
└── types/                # TypeScript type definitions
```

## Architecture

### Worker Pattern

CPU-intensive image generation runs in separate worker processes communicating via WebSocket:

- Main bot (`src/index.ts`) → WorkerServer → Worker processes (`src/Worker/Worker.ts`)
- Workers handle: rank, match, summoner, team, spectator, cherryMatch image generation

### Command Structure

- `Command` - Base slash command class
- `AccountCommand` - Commands requiring linked Riot account
- Commands auto-loaded from `src/commands/` directory

### Global Process Extensions

```typescript
process.discordBot; // Main Discord bot instance
process.workerServer; // Worker communication server
process.inMemory; // In-memory cache
process.emoji; // Discord emoji manager
process.client; // Discord.js client
```

## Code Conventions

- **Path alias**: `$/*` maps to `./src/*`
- **No console.log**: Use `Logger` from `$/lib/logger.ts`
- **Formatting**: 4 spaces, single quotes, no trailing commas
- **Strict TypeScript**: All strict checks enabled

## Key Files

| File                      | Purpose                                   |
| ------------------------- | ----------------------------------------- |
| `src/index.ts`            | Bot entry point, initializes all services |
| `src/lib/DiscordBot.ts`   | Discord client, command registration      |
| `src/lib/WorkerServer.ts` | WebSocket server for worker communication |
| `src/lib/Riot/riotApi.ts` | Riot API wrapper                          |
| `src/types/env.ts`        | Environment variable schema (zod)         |
| `src/types/database.ts`   | Generated database types                  |

## Environment Variables

Key variables needed (see `.env.example`):

- `CLIENT_ID`, `CLIENT_TOKEN` - Discord bot credentials
- `RIOT_API_KEY` - Riot Games API key
- `DATABASE_*` - MySQL connection settings
- `WEBSOCKET_*` - Worker communication settings
- `CACHE_PATH`, `PERSISTANT_CACHE_PATH` - File storage paths

## Database

Tables: `account`, `lp`, `in_memory`, `emoji`

Migrations in `migrations/` - run with `pnpm run migrate`

## CI/CD

- Pre-commit: lint-staged via Husky
- GitHub Actions: build, lint, type check on PRs
- Deploy: rsync to server, systemd restart (main branch only)

## Common Workflows

### Adding a New Command

1. Create file in `src/commands/`
2. Export class extending `Command` or `AccountCommand`
3. Run `pnpm run start:register` to register with Discord

### Modifying Database Schema

1. `./script/createMigration.sh migration_name`
2. Edit migration file in `migrations/`
3. `pnpm run migrate`
4. `pnpm run genDatabaseSchema`

### Adding Localization

1. Edit `src/lib/langs/english.ts` and `src/lib/langs/czech.ts`
2. Follow existing patterns for type safety
