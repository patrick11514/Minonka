/*eslint-disable @typescript-eslint/no-explicit-any*/

import { Kysely, sql } from 'kysely';

export const up = async (db: Kysely<any>): Promise<void> => {
    await db.schema
        .createTable('user_settings')
        .addColumn('discord_id', 'varchar(20)', (col) => col.primaryKey())
        .addColumn('language', 'varchar(10)')
        .addColumn('command_presets', 'json', (col) => col.defaultTo(sql`'{}'`))
        .execute();
};

export const down = async (db: Kysely<any>): Promise<void> => {
    await db.schema.dropTable('user_settings').execute();
};
