/*eslint-disable @typescript-eslint/no-explicit-any*/

import { Kysely, sql } from 'kysely';

export const up = async (db: Kysely<any>): Promise<void> => {
    await db.schema
        .createTable('duo_match')
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        .addColumn('puuid1', 'varchar(100)', (col) => col.notNull())
        .addColumn('puuid2', 'varchar(100)', (col) => col.notNull())
        .addColumn('match_id', 'varchar(100)', (col) => col.notNull())
        .addColumn('created_at', 'timestamp', (col) =>
            col.defaultTo(sql`CURRENT_TIMESTAMP`)
        )
        .addUniqueConstraint('unique_duo_match', ['puuid1', 'puuid2', 'match_id'])
        .execute();

    await db.schema
        .createTable('match_participant_stat')
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        .addColumn('match_id', 'varchar(100)', (col) => col.notNull())
        .addColumn('puuid', 'varchar(100)', (col) => col.notNull())
        .addColumn('account_id', 'integer')
        .addColumn('queue_id', 'integer', (col) => col.notNull())
        .addColumn('win', 'boolean', (col) => col.notNull())
        .addColumn('kills', 'integer', (col) => col.notNull())
        .addColumn('deaths', 'integer', (col) => col.notNull())
        .addColumn('assists', 'integer', (col) => col.notNull())
        .addColumn('champion_id', 'integer', (col) => col.notNull())
        .addColumn('damage_dealt', 'integer', (col) => col.notNull())
        .addColumn('damage_taken', 'integer', (col) => col.notNull())
        .addColumn('vision_score', 'integer', (col) => col.notNull())
        .addColumn('wards_placed', 'integer', (col) => col.notNull())
        .addColumn('wards_killed', 'integer', (col) => col.notNull())
        .addColumn('gold_earned', 'integer', (col) => col.notNull())
        .addColumn('minions_killed', 'integer', (col) => col.notNull())
        .addColumn('created_at', 'timestamp', (col) =>
            col.defaultTo(sql`CURRENT_TIMESTAMP`)
        )
        .addUniqueConstraint('unique_match_participant_stat', ['match_id', 'puuid'])
        .execute();
};

export const down = async (db: Kysely<any>): Promise<void> => {
    await db.schema.dropTable('match_participant_stat').execute();
    await db.schema.dropTable('duo_match').execute();
};
