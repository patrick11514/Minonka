import { Selectable } from 'kysely';
import { conn } from '../types/connection';
import { UserSettings as DBUserSettings } from '../types/database';

export interface ParsedUserSettings
    extends Omit<Selectable<DBUserSettings>, 'command_presets'> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    command_presets: any;
}

export class UserSettings {
    private cache: Map<string, ParsedUserSettings | null> = new Map();

    async get(discordId: string): Promise<ParsedUserSettings | null> {
        if (this.cache.has(discordId)) {
            return this.cache.get(discordId)!;
        }

        const settings = await conn
            .selectFrom('user_settings')
            .selectAll()
            .where('discord_id', '=', discordId)
            .executeTakeFirst();

        let parsedSettings: ParsedUserSettings | null = null;

        if (settings) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            parsedSettings = { ...settings } as any;

            // Parse JSON if it comes back as string (depends on driver config)
            if (typeof parsedSettings!.command_presets === 'string') {
                try {
                    parsedSettings!.command_presets = JSON.parse(
                        parsedSettings!.command_presets
                    );
                } catch {
                    parsedSettings!.command_presets = {};
                }
            } else if (!parsedSettings!.command_presets) {
                parsedSettings!.command_presets = {};
            }
        }

        this.cache.set(discordId, parsedSettings);
        return parsedSettings;
    }

    async setLanguage(discordId: string, lang: string | null): Promise<void> {
        await conn
            .insertInto('user_settings')
            .values({
                discord_id: discordId,
                language: lang,
                command_presets: JSON.stringify({})
            })
            .onDuplicateKeyUpdate({
                language: lang
            })
            .execute();

        this.cache.delete(discordId);
    }

    /* eslint-disable @typescript-eslint/no-explicit-any */
    async setDefaults(
        discordId: string,
        command: string,
        data: Record<string, any>
    ): Promise<void> {
        const existing = await this.get(discordId);
        let presets = existing ? (existing.command_presets as Record<string, any>) : {};
        if (typeof presets !== 'object' || presets === null) presets = {};

        presets[command] = { ...(presets[command] || {}), ...data };

        // Remove keys with null values
        for (const k in presets[command]) {
            if (presets[command][k] === null) {
                delete presets[command][k];
            }
        }

        // Remove empty command entries
        if (Object.keys(presets[command]).length === 0) {
            delete presets[command];
        }

        const presetsString = JSON.stringify(presets);

        await conn
            .insertInto('user_settings')
            .values({
                discord_id: discordId,
                language: existing?.language || null,
                command_presets: presetsString
            })
            .onDuplicateKeyUpdate({
                command_presets: presetsString
            })
            .execute();

        this.cache.delete(discordId);
    }
}

export const userSettings = new UserSettings();
