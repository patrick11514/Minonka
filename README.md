# Minonka

Minonka is discordbot, which provides some **League of Legends** stats on discord primarly via images.
It is written in discord.js and uses [Riot API](https://developer.riotgames.com/) to get the data _straight from source_.

## Content

- [Features](#features)
- [Installation](#installation)

## Features

Link the riot account with discord account.

- /link \<riot-username\> \<riot-tag\> \<region\> - Links riot account with discord account
- /links - Show your linked accounts, and by selecting one, you unlink it
  ![linking process](https://upload.patrick115.eu/screenshot/f3bd2968e9.png)

Command, which shows some stats have 3 sub-commands:

- me - if you have linked one account, it will immidietly show result. If you have more accounts, it will prompt you for selection.
- other - you will need to provide \<riot-username\> \<riot-tag\> and \<region\>
- mention - mention someone on discord and then it will fork same as **me**

Summoner command will show your summoner profile, similarly as you see it in your profile in League Client.
![summoner profile](https://upload.patrick115.eu/screenshot/c41d641e06.png)

- /summoner me - shows your summoner profile
- /summoner other \<riot-username\> \<riot-tag\> \<region\> - shows summoner profile of provided account
- /summoner mention \<mentoin\> - shows summoner profile of mentioned user

History command will show your game history. By default it show last 6 games, but you can specify game count 1-6, offset and queue type. Then the result message will have 3 buttons:

- previous - move offset by count towards present
- reload + info - shows currently showed matches range (eg. 0-6) and will reload result for current offset + count. Usefull, when you play game(s) and want to reload history.
- next - move offset by count towards past

![history](https://upload.patrick115.eu/screenshot/3836975a86.png)
![history moved](https://upload.patrick115.eu/screenshot/ef316dead1.png)

- /history me [\<count\>] [\<offset\>] [\<queue\>] - shows your game history
- /history other \<riot-username\> \<riot-tag\> \<region\> [\<count\>] [\<offset\>] [\<queue\>] - shows game history of provided account
- /history mention \<mention\> [\<count\>] [\<offset\>] [\<queue\>] - shows game history of mentioned user

## Installation

Clone repo:

```bash
git clone https://github.com/patrick11514/Minonka.git
```

Install node modules

```bash
npm i  # npm
pnpm i # pnpm
```

Create .env file

```bash
cp .env.example .env
```

and fill it with your data

Install assets

```bash
cd assets
./download.sh # download all assets (ddragon, banners...)
cd fonts
./setupFonts.sh # will put fonts into your lcocal fonts directory
```

Build bot

```bash
npm run build # npm
pnpm build    # pnpm
```

Migrate database

```bash
npm run migrate # npm
pnpm migrate    # pnpm
```

Run bot

```bash
npm start  # npm
pnpm start # pnpm
```
