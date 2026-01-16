import { Selectable } from 'kysely';
import { conn } from '../types/connection';
import { UserSettings as DBUserSettings } from '../types/database';
import Logger from './logger';

export interface ParsedUserSettings
    extends Omit<Selectable<DBUserSettings>, 'command_presets'> {
    command_presets: Record<string, Record<string, unknown>>;
}

export class UserSettings {
    private cache: Map<string, ParsedUserSettings | null> = new Map();
    private logger = new Logger('UserSettings');

    async get(discordId: string): Promise<ParsedUserSettings | null> {
        if (this.cache.has(discordId)) {
            return this.cache.get(discordId) ?? null;
        }

        const settings = await conn
            .selectFrom('user_settings')
            .selectAll()
            .where('discord_id', '=', discordId)
            .executeTakeFirst();

        let parsedSettings: ParsedUserSettings | null = null;

        if (settings) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mutableSettings = { ...settings } as any as ParsedUserSettings;

            // Parse JSON if it comes back as string (depends on driver config)
            if (typeof mutableSettings.command_presets === 'string') {
                try {
                    mutableSettings.command_presets = JSON.parse(
                        mutableSettings.command_presets
                    );
                } catch (error) {
                    this.logger.error(
                        `Failed to parse command_presets for user_settings ${discordId} ${mutableSettings.command_presets} ${error}`
                    );
                    mutableSettings.command_presets = {};
                }
            } else if (!mutableSettings.command_presets) {
                mutableSettings.command_presets = {};
            }

            parsedSettings = mutableSettings;
        }

        this.cache.set(discordId, parsedSettings);
        return parsedSettings;
    }

    async setLanguage(discordId: string, lang: string | null): Promise<void> {
        // We use empty object for presets because we don't want to overwrite existing presets
        // if the user already has them (this will happen on onDuplicateKeyUpdate)
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

    async setDefaults(
        discordId: string,
        command: string,
        data: Record<string, unknown>
    ): Promise<void> {
        const existing = await this.get(discordId);
        let presets = existing ? existing.command_presets : {};
        if (typeof presets !== 'object' || presets === null) presets = {};

        if (Object.keys(data).length === 0) {
            delete presets[command];
        } else {
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
