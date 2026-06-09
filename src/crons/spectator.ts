import {
    ButtonData,
    fetchSpectatorTaskInput,
    handleMatchFinished
} from '$/commands/spectator';
import { Cron } from '$/lib/cron';
import { getLocale } from '$/lib/langs';
import Logger from '$/lib/logger';
import { conn } from '$/types/connection';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import fs from 'node:fs/promises';

const l = new Logger('SpectatorCron', 'green');

export const autoRefreshSpectator = async () => {
    if (!process.client || !process.client.user) {
        return; // Client not ready yet
    }

    l.start('Running auto-refresh for spectator messages...');

    try {
        const rows = await conn
            .selectFrom('in_memory')
            .selectAll()
            .where('key', 'like', 'spectator:%')
            .execute();

        l.log(`Found ${rows.length} spectator messages to refresh.`);

        for (const row of rows) {
            const key = row.key.replace('spectator:', '');
            const data = JSON.parse(row.value) as ButtonData;

            try {
                // Fetch channel and message from Discord API
                const channel = await process.client.channels.fetch(data.channelId);
                if (!channel || !channel.isTextBased()) {
                    l.log(
                        `Channel ${data.channelId} not found or not text-based. Deleting spectator data.`
                    );
                    await process.inMemory.getInstance().delete(row.key);
                    continue;
                }

                const message = await channel.messages.fetch(data.messageId);
                if (!message) {
                    l.log(
                        `Message ${data.messageId} not found. Deleting spectator data.`
                    );
                    await process.inMemory.getInstance().delete(row.key);
                    continue;
                }

                // Check spectator status
                const spectatorResult = await fetchSpectatorTaskInput(
                    data.puuid,
                    data.region,
                    data.locale
                );

                if (!spectatorResult.status) {
                    if (spectatorResult.code === 404) {
                        l.log(
                            `Match for ${data.puuid} finished. Transitioning to match summary.`
                        );
                        await handleMatchFinished(
                            message,
                            data.puuid,
                            data.region,
                            data.locale,
                            data.discordId
                        );
                        await process.inMemory.getInstance().delete(row.key);
                    } else {
                        l.log(
                            `Riot API error for ${data.puuid}: (${spectatorResult.code}) ${spectatorResult.message}`
                        );
                    }
                    continue;
                }

                // Match still active, update image!
                l.log(`Match for ${data.puuid} still active. Re-generating image.`);
                const result = await process.workerServer.addJobWait(
                    'spectator',
                    spectatorResult.data
                );
                const lang = getLocale(data.locale);

                // Button reload row
                const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents([
                    new ButtonBuilder()
                        .setCustomId(`spectator;${key};reload`)
                        .setEmoji('🔄')
                        .setLabel(lang.spectator.reload)
                        .setStyle(ButtonStyle.Primary)
                ]);

                const header = `<@${data.discordId}> ${spectatorResult.gameName}#${spectatorResult.tagLine} (${lang.regions[data.region] ?? data.region}):\n`;

                await message.edit({
                    content: header,
                    files: [result],
                    components: [buttonRow]
                });

                // Update lastUpdate
                await process.inMemory.getInstance<ButtonData>().set(row.key, {
                    ...data,
                    lastUpdate: Date.now()
                });

                await fs.unlink(result);
            } catch (err) {
                // If message or channel is not found (DiscordAPIError [10008] or similar), clean up database entry
                if (
                    typeof err === 'object' &&
                    err &&
                    'code' in err &&
                    typeof err.code === 'number' &&
                    (err.code === 10008 || err.code === 10003 || err.code === 50001)
                ) {
                    l.log(
                        `Discord API error (${err.code}) for spectator message. Cleaning up DB entry.`
                    );
                    await process.inMemory.getInstance().delete(row.key);
                } else {
                    l.error(`Error processing spectator refresh for key ${row.key}:`);
                    l.error(err);
                }
            }
        }
    } catch (e) {
        l.error('Error querying spectator messages from database:');
        l.error(e);
    }

    l.stop('Spectator auto-refresh completed.');
};

export default ['0 */5 * * * *', autoRefreshSpectator] satisfies Cron;
