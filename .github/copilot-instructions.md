# Minonka Discord Bot

Minonka is a TypeScript Discord bot for League of Legends that provides match history, champion mastery, clash teams, and rank information. The bot uses a worker architecture for heavy image generation tasks and integrates with the Riot Games API.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Initial Setup

Bootstrap the repository with these exact commands:

- `npm install -g pnpm` - install pnpm package manager
- `pnpm install --frozen-lockfile` - install dependencies (takes ~45 seconds, NEVER CANCEL)
- `cp .env.example .env` - create environment file (REQUIRED)
- `cd assets && ./download.sh` - download game assets (REQUIRES internet access to Riot APIs)
    - **NOTE**: May fail with network errors if external APIs are unreachable
    - This downloads ~50MB of champion images, ranks, and banners
    - Required tools: `curl`, `jq`, `wget`, `unzip`
- `cd assets/fonts && ./setupFonts.sh` - install fonts (takes <1 second)

### Build and Development

- `pnpm run build` - build TypeScript to JavaScript (takes ~6 seconds)
- `pnpm run check` - TypeScript type checking (takes ~5 seconds)
- `pnpm run lint` - run ESLint and Prettier checks (takes ~4 seconds)
- `pnpm run format` - auto-format code with Prettier (takes ~2 seconds)

### Database Operations

- `pnpm run migrate` - run database migrations (REQUIRES valid DATABASE_URL)
- `./script/createMigration.sh` - create new migration file

### Application Modes

**IMPORTANT**: All application modes require proper .env configuration with valid Discord tokens and database connection.

- `pnpm run dev` - development mode with hot reload
- `pnpm run dev:worker` - development worker process
- `pnpm run dev:worker:remote` - remote worker development mode
- `pnpm run start` - production main bot process
- `pnpm run start:worker` - production worker process
- `pnpm run start:worker:remote` - remote worker production mode
- `pnpm run start:register` - register Discord slash commands

### Worker Architecture

Workers handle image generation tasks. Multiple workers can run with:

- `INSTANCE_ID=1 pnpm start:worker` - worker instance 1
- `INSTANCE_ID=2 pnpm start:worker` - worker instance 2
- Workers communicate via WebSocket on WEBSOCKET_PORT (default 8080)

## Validation

### Build Validation

Always run these commands before committing changes:

- `pnpm run build` - NEVER CANCEL: Build takes ~6 seconds. Set timeout to 60+ seconds.
- `pnpm run check` - NEVER CANCEL: Type check takes ~5 seconds. Set timeout to 30+ seconds.
- `pnpm run lint` - NEVER CANCEL: Linting takes ~4 seconds. Set timeout to 30+ seconds.

### Manual Testing Scenarios

When making changes, always test these scenarios:

1. **Build Validation**:

    - `rm -rf build && pnpm run build` - clean build from scratch
    - Verify `build/` directory contains compiled JavaScript
    - Check for TypeScript compilation errors

2. **Code Quality Validation**:

    - `pnpm run check` - ensure no TypeScript errors
    - `pnpm run lint` - verify code style and ESLint rules
    - `pnpm run format` - auto-fix formatting issues

3. **Command System Testing**:

    - Test `pnpm run start:register` loads all Discord commands (requires valid tokens)
    - Verify no command registration errors in logs
    - Check that command count matches expected number

4. **Worker Architecture Testing** (if modifying Worker code):

    - Test websocket connection between main process and workers
    - Verify image generation tasks complete successfully
    - Check worker logs for connection/processing errors

5. **Asset Management Testing** (if modifying asset code):

    - `cd assets && ./download.sh` - verify asset downloading works
    - Check that fonts install correctly: `cd assets/fonts && ./setupFonts.sh`
    - Verify required tools available: `which curl jq wget unzip`

6. **Environment Configuration Testing**:
    - Verify `.env` file exists and contains required variables
    - Test with minimal configuration to ensure graceful error handling
    - Check database connection (if DATABASE_URL provided)

### CI Requirements

The GitHub Actions CI pipeline requires:

- All linting checks pass (`pnpm run lint`)
- TypeScript compilation succeeds (`pnpm run build`)
- Type checking passes (`pnpm run check`)

ALWAYS run `pnpm run lint` before committing or the CI will fail.

## Common Tasks

### Repo Structure

```
src/
├── index.ts              # Main bot entry point
├── commands/             # Discord slash commands (9 files)
│   ├── clash.ts         # Clash team information
│   ├── history.ts       # Match history with images
│   ├── mastery.ts       # Champion mastery
│   └── ...
├── crons/               # Scheduled tasks (3 files)
│   ├── lp.ts           # LP (League Points) updates
│   └── ...
├── lib/                 # Core libraries
│   ├── DiscordBot.ts   # Main Discord client
│   ├── WorkerServer.ts # Worker management
│   ├── Imaging/        # Image generation utilities
│   └── Riot/           # Riot API integration
├── Worker/              # Worker process code
│   ├── Worker.ts       # Worker entry point
│   ├── tasks/          # Image generation tasks (6 files)
│   └── utilities.ts
└── types/              # TypeScript definitions
```

### Key Dependencies

- `discord.js` - Discord bot framework
- `kysely` - Type-safe SQL query builder
- `mysql2` - MySQL database driver
- `sharp` - Image processing
- `express` - Web server for worker communication
- `node-cron` - Scheduled tasks
- `tsx` - TypeScript execution for development

### Environment Configuration

Required .env variables:

- `DATABASE_URL` - MySQL connection string
- `CLIENT_ID` / `CLIENT_TOKEN` - Discord bot credentials
- `RIOT_API_KEY` - Riot Games API key
- `WEBSOCKET_HOST` / `WEBSOCKET_PORT` - Worker communication
- `CACHE_PATH` / `PERSISTANT_CACHE_PATH` - File storage paths
- Emoji guild IDs for custom Discord emojis

### Asset Management

The bot requires external assets:

- **DDragon Data**: Champion images, items, runes from Riot's CDN
- **Rank Icons**: Ranked emblems from Riot static files
- **Banners**: Player banners from Community Dragon
- **Fonts**: Custom League fonts in `assets/fonts/`

Assets are downloaded via `assets/download.sh` which:

- Downloads latest DDragon version (~50MB)
- Downloads rank icons and position-specific icons
- Downloads all available player banners
- Requires `curl`, `jq`, `wget`, `unzip` tools

### Worker Tasks

Workers generate images for:

- `match.ts` - Match history images with detailed stats
- `summoner.ts` - Summoner profile images
- `rank.ts` - Rank status images
- `team.ts` - Clash team composition images
- `spectator.ts` - Live game spectator images
- `cherryMatch.ts` - Arena match images

### Command Development

Commands extend base classes:

- `Command` - Basic slash command
- `AccountCommand` - Commands requiring linked Riot accounts
- `AccountCommandGroup` - Grouped commands (me/name/mention patterns)

Always update command help text and localizations when modifying commands.

### Database Schema

Tables managed via migrations:

- `account` - Linked Discord/Riot accounts
- `lp` - Historical LP tracking for ranked players
- `in_memory` - Temporary data storage
- `emoji` - Custom emoji mappings

### Debugging

- Logs are written to console with color-coded levels
- Worker instances log to separate directories when INSTANCE_ID is set
- Use NODE_ENV=development for detailed logging
- Check WebSocket connectivity for worker communication issues

### Performance Notes

- Image generation is CPU intensive - workers distribute load
- Cache paths store generated images to avoid regeneration
- Font installation is required for text rendering in images
- Asset downloads are bandwidth intensive on first run
