# Minonka

Minonka is a Discord bot that provides comprehensive **League of Legends** statistics directly on Discord, primarily rendered as beautiful, rich images.

---

## Architecture

Minonka utilizes a hybrid **TypeScript + Rust** architecture:

- **Discord Bot (TypeScript)**: Handles user interaction, slash command routing, event listeners, cron jobs, and database interactions (via Kysely and MySQL).
- **Image Generation Worker (Rust)**: Offloads the heavy image rendering operations from the single-threaded Node.js environment to a high-performance Rust service.
- **Communication**: The bot and worker communicate over WebSockets (configured via `WEBSOCKET_HOST` and `WEBSOCKET_PORT`).

---

## Installation & Setup

### 1. Clone the repository

```bash
git clone https://github.com/patrick11514/Minonka.git
cd Minonka
```

### 2. Install Node.js dependencies

```bash
pnpm install
# or: npm install
```

### 3. Configure the environment

Copy the example environment file and fill in your details (API keys, database credentials, WebSocket configuration, etc.):

```bash
cp .env.example .env
```

### 4. Download Assets & Setup Fonts

Minonka requires League of Legends assets (Data Dragon, banners, rank emblems, lane icons, fonts) to render cards:

```bash
cd assets
./download.sh       # Downloads DDragon assets, banners, ranks, lanes, etc.
cd ../..
```

### 5. Build and Migrate

Build the TypeScript bot and migrate the database:

```bash
pnpm build
pnpm migrate
```

---

## Running the Services

### Start Bot

```bash
pnpm start
```

### Start Worker

The worker can be compiled and run via Cargo:

```bash
cd worker
cargo run --release --bin main
```

_Note: Ensure the bot is running or the WebSocket server port is open so the worker can connect._

---

## Testing & Development

### 1. Formatting & Linting

Format the TypeScript code:

```bash
pnpm format
```

Check TypeScript linting:

```bash
pnpm lint
```

### 2. Running Worker Tests

To run the Rust worker unit and integration tests:

```bash
pnpm worker:test
```

### 3. Visual Layout Regression Testing

The worker uses snapshot testing to ensure that changes to drawing logic do not break the visual layout.

- **Reference Baselines**: Pre-rendered images are stored under `snapshots/` directories in the test folders.
- **Capturing Deviations**: If a test fails due to visual mismatch, a `.actual.png` (what the code rendered) and a `.diff.png` (mismatched pixels highlighted in pink) are created.
- **Watch and Save Mode**: While developing or tweaking canvas positioning, you can watch specific tests and auto-save the generated image:

    ```bash
    # Inside the worker directory:
    cargo watch -w src -x "test test_match_draft --features save -- --no-capture"
    ```

    _(Tip: Use a fast image viewer like `sxiv` to watch the generated PNG update in real-time.)_

- **Interactive Snapshot Inspection**: To review and bless visual changes, run the inspection CLI tool:
    ```bash
    pnpm worker:inspect
    ```
    This will scan for visual differences and prompt you interactively:
    - `[a]ccept`: Overwrites the baseline reference image with the new actual output.
    - `[r]eject`: Deletes the temporary actual/diff images and rejects the change.
    - `[s]kip`: Skips the item to decide later.

### 4. Anonymizing Fixtures

When creating new test data fixtures from real Riot API matches, run the anonymizer to strip player-sensitive PUUIDs and replace them with generated signed PUUIDs:

```bash
node worker/test_files/anonymize.js [optional_directory_path]
```

_(By default, this walks the `worker/test_files/` directory and anonymizes all `.json` files in place)._

---

## Slash Commands

Minonka provides a set of user commands. Stats commands support three subcommands:

- `me`: Runs the command for your linked account.
- `other <riot-username> <riot-tag> <region>`: Runs for a specified Riot account.
- `mention <@discord-user>`: Runs for the account linked to the mentioned user.

### Account Linking

- `/link <riot-username> <riot-tag> <region>` - Link a Riot account to your Discord profile.
- `/links` - Show and manage your linked accounts.
  ![linking process](https://upload.patrick115.eu/raw/images/ad16ede8-f45f-4b26-bd70-ce15021f13af.png)

### Summoner Profile

- `/summoner [me/other/mention]` - Show summoner level, profile icon, and customized champion crest background.
  ![summoner profile](worker/test_files/summoner_rich.png)

### Rank Profile

- `/rank [me/other/mention]` - Shows ranked stats, tier, LP, and win/loss ratio for Solo/Duo and Flex queues.
  ![rank profile](worker/test_files/rank_multiple.png)

### LP History Graph

- `/graph [me/other/mention] <queue>` - Generates a visual line graph tracking the last 50 LP changes in either Solo/Duo or Flex queue.
  ![lp history graph](worker/src/tasks/snapshots/tasks__graph__test__test_graph.png)

### Match History

- `/history [me/other/mention] [count] [offset] [queue]` - Fetch and display game summaries (default shows last 6 matches). The response features navigation buttons to scroll through past matches or reload.
  ![history](worker/test_files/match_solo_gain.png)

### Live Game Spectator

- `/spectator [me/other/mention]` - Check details of a player's active live game, including participants, ranks, banned champions, queue type, and map.
  ![spectator](worker/test_files/spectator.png)

### Clash Teams & Schedules

- `/clash schedule <region>` - Displays upcoming Clash tournaments.
- `/clash team [me/other/mention/id]` - View team members, their tiers, and lanes.
  ![clash team](worker/test_files/team_rich.png)

### Mastery Stats

- `/mastery [me/other/mention]` - Shows top champion masteries and points.
  ![mastery command first](https://upload.patrick115.eu/raw/images/7337f4a0-9f42-4fd7-81ab-7566dcbba335.png)

### User Settings

- `/settings language set <language>` - Change bot display language (choices: English, Czech).
- `/settings language reset` - Revert language settings back to Discord client default.
- `/settings default history [queue]` - Configure default queue filters for your history commands.
- `/settings default reset <command>` - Reset presets for a command.

### Help Guide

- `/help` - Show help details, description, usage, and subcommands.

---

## Configuration (.env)

Below is an example of configurations in `.env` file:

```env
# Database Connection
DATABASE_IP=127.0.0.1
DATABASE_PORT=3306
DATABASE_USER=minonka
DATABASE_PASSWORD=your_secure_password
DATABASE_NAME=minonka_db
DATABASE_URL=mysql://minonka:your_secure_password@127.0.0.1:3306/minonka_db

# Riot API Key
RIOT_API_KEY=RGAPI-XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX

# Discord Credentials
CLIENT_ID=123456789012345678
CLIENT_TOKEN=your_discord_bot_token

# WebSocket Configuration
WEBSOCKET_PORT=8080
WEBSOCKET_HOST=ws://localhost

# Cache Directories
CACHE_PATH=/tmp
PERSISTANT_CACHE_PATH=cache

# Discord Emoji Guild IDs (for displaying ingame emojis)
EMOJI_GUILD_CHAMPIONS=955054979192881162,955053883103780894
EMOJI_GUILD_ITEMS=973334813467611146
EMOJI_GUILD_MISC=967816629557817354
```
