import { env } from '$/types/env';
import { GuildEmoji, Locale } from 'discord.js';
import { AssetType, getAsset, getRiotLanguageFromDiscordLocale } from './Assets';
import { z } from 'zod';
import Logger from './logger';
import { conn } from '$/types/connection';
import fs from 'node:fs/promises';
import sharp from 'sharp';

type Storage = 'champion' | 'item' | 'misc';

const guilds: Record<Storage, string> = {
    champion: env.EMOJI_GUILD_CHAMPIONS,
    item: env.EMOJI_GUILD_ITEMS,
    misc: env.EMOJI_GUILD_MISC
};

type Emoji = {
    id: string;
    name: string;
};

const l = new Logger('EmojiManager', 'blue');

const GUILD_MAX_EMOJIS = 50;

export class EmojiManager {
    private servers: Record<Storage, string[]>;
    private cachedEmojis = {} as Record<Storage, Record<string, Emoji[]>>;

    constructor() {
        this.servers = {} as Record<Storage, string[]>;

        for (const [key, value] of Object.entries(guilds)) {
            this.servers[key as Storage] = value.split(',').map((v) => v.trim());
        }
    }

    private async getChampions() {
        const champions = await getAsset(
            AssetType.DDRAGON_DATA,
            'champion.json',
            getRiotLanguageFromDiscordLocale(Locale.EnglishUS)
        );
        if (!champions) return null;

        const championSchema = z.object({
            data: z.record(
                z.string(),
                z.object({
                    id: z.string(),
                    name: z.string(),
                    image: z.object({
                        full: z.string()
                    })
                })
            )
        });

        try {
            const champs = JSON.parse(champions.toString());
            const parsed = championSchema.parse(champs);

            return Object.values(parsed.data);
        } catch (error) {
            l.error('Failed to parse champions');
            l.error(error);
            return null;
        }
    }

    private async getMiscEmojis() {
        const emojis = [] as {
            name: string;
            image: Buffer;
        }[];
        //Masteries
        const masteryFiles = await fs.readdir('assets/mastery');
        const masteries = await masteryFiles.asyncMap(async (file) => {
            return {
                name: file.split('.')[0],
                image: await fs.readFile(`assets/mastery/${file}`)
            };
        });
        emojis.push(...masteries);

        return emojis;
    }

    private async checkStorage<$SingleItem>(
        storage: Storage,
        getFunction: () => Promise<$SingleItem[] | null>,
        itemName: (item: $SingleItem) => string,
        emojiPart: Record<string, Emoji[]>,
        getItemAsset: (item: $SingleItem) => ReturnType<typeof getAsset>
    ): Promise<
        undefined | number
    > /*undefined = no guilds available, number = number of emojis uploaded*/ {
        let addedEmojis = 0;

        const items = await getFunction();
        if (!items) {
            l.stopError('Failed to get champions');
            return;
        }

        const championEntries = Object.entries(emojiPart);
        const championEmojis = championEntries.flatMap(([server, emojis]) =>
            emojis.map((emoji) => [server, emoji] as const)
        );

        let guildIndex = null as null | number;

        const guilds = await Promise.all(
            this.servers[storage].map(async (guild) => ({
                guild: await process.client.guilds.fetch(guild),
                capacity: null as null | number
            }))
        );

        for (const item of Object.values(items)) {
            const server = championEmojis.find(
                ([, emoji]) => emoji.name === itemName(item)
            );

            let emoji: Emoji & {
                guild: string;
            };
            if (!server) {
                l.log(`Uploading emoji ${itemName(item)}`);
                //upload emoji
                const image = (await getItemAsset(item))!;

                if (guildIndex === null || guilds[guildIndex].capacity === 0) {
                    if (guildIndex != null) {
                        guildIndex++;
                    }

                    if (guildIndex === null) {
                        guildIndex = await guilds.asyncFindIndex(async (guild) => {
                            if (guild.capacity === null) {
                                const emojis = await guild.guild.emojis.fetch();
                                guild.capacity = GUILD_MAX_EMOJIS - emojis.size;
                            }

                            return guild.capacity > 0;
                        });

                        //if no guilds available, just set to length and return undefined on lines below
                        if (guildIndex === null) guildIndex = guilds.length;
                    }

                    if (guildIndex >= guilds.length) {
                        return undefined;
                    }
                }

                const guild = guilds[guildIndex].guild;
                const emojiName = itemName(item);
                const _emoji = await guild.emojis.create({
                    attachment: image,
                    name: emojiName
                });

                //decrement capacity
                guilds[guildIndex].capacity! -= 1;

                emoji = {
                    id: _emoji.id,
                    name: emojiName,
                    guild: guild.id
                };

                addedEmojis++;
            } else {
                //emoji already exists
                emoji = {
                    id: server[1].id,
                    name: server[1].name,
                    guild: server[0]
                };
            }

            //check if emoji is already in DB
            const emojiData = await conn
                .selectFrom('emoji')
                .select('id')
                .where('emoji_id', '=', emoji.id)
                .executeTakeFirst();
            if (!emojiData) {
                l.log(`Adding emoji ${emoji.name} to DB`);
                await conn
                    .insertInto('emoji')
                    .values({
                        emoji_id: emoji.id,
                        name: emoji.name,
                        guild: emoji.guild
                    })
                    .execute();
            }
        }

        return addedEmojis;
    }

    async sync() {
        l.start('Syncing emojis...');
        let syncCount = 0;

        //gather all emojis from servers
        const emojiLists = {} as Record<Storage, Record<string, Emoji[]>>;

        for (const [category, servers] of Object.entries(this.servers)) {
            emojiLists[category] = {};

            for (const serverId of servers) {
                const guild = await process.client.guilds.fetch(serverId);
                const emojis = await guild.emojis.fetch();

                emojiLists[category][serverId] = emojis.map((emoji) => ({
                    id: emoji.id,
                    name: emoji.name ?? ''
                }));
            }
        }
        this.cachedEmojis = emojiLists;

        //Champion emojis
        const championEmojis = await this.checkStorage(
            'champion',
            this.getChampions,
            (item) => item.id,
            this.cachedEmojis.champion,
            async (item) => getAsset(AssetType.DDRAGON_CHAMPION, item.image.full)
        );

        if (championEmojis === undefined) {
            l.stopError('Failed to upload champion emojis, because no guilds available');
            return;
        }

        syncCount += championEmojis;

        //Misc
        const miscEmojis = await this.checkStorage(
            'misc',
            this.getMiscEmojis,
            (item) => item.name,
            this.cachedEmojis.misc,
            async (item) => {
                //set quality to 75%
                const image = sharp(item.image);
                return image.png({ quality: 75 }).toBuffer();
            }
        );

        if (miscEmojis === undefined) {
            l.stopError('Failed to upload misc emojis, because no guilds available');
            return;
        }

        syncCount += miscEmojis;

        l.stop(`Emojis synced! ${syncCount} emojis uploaded`);
    }

    async getEmoji(storage: Storage, name: string): Promise<GuildEmoji | null> {
        const guildIds = this.servers[storage];

        //try to find in db
        const emoji = await conn
            .selectFrom('emoji')
            .selectAll()
            .where((eb) => eb.and([eb('name', '=', name), eb('guild', 'in', guildIds)]))
            .executeTakeFirst();
        if (!emoji) {
            return null;
        }

        //check if emoji is in cache
        let guild = process.client.guilds.cache.get(emoji.guild);
        if (!guild) {
            guild = await process.client.guilds.fetch(emoji.guild);
        }

        const emojis = await guild.emojis.fetch();
        const foundEmoji = emojis.get(emoji.emoji_id);
        if (!foundEmoji) {
            return null;
        }

        return foundEmoji;
    }
}
