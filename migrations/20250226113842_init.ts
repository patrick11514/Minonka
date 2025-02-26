/*eslint-disable @typescript-eslint/no-explicit-any*/

import { Kysely, sql } from 'kysely';

export const up = async (conn: Kysely<any>) => {
    await conn.schema
        .createTable('account')
        .addColumn('id', 'integer', (col) => col.autoIncrement().primaryKey())
        .addColumn('discord_id', 'varchar(18)', (col) => col.notNull())
        .addColumn('gameName', 'varchar(50)', (col) => col.notNull())
        .addColumn('tagLine', 'varchar(50)', (col) => col.notNull())
        .addColumn('puuid', 'varchar(80)', (col) => col.notNull())
        .addColumn('account_id', 'varchar(80)', (col) => col.notNull())
        .addColumn('summoner_id', 'varchar(80)', (col) => col.notNull())
        .addColumn('region', 'varchar(4)', (col) => col.notNull())
        .execute();
    await conn.schema
        .createTable('lp')
        .addColumn('id', 'integer', (col) => col.autoIncrement().primaryKey())
        .addColumn('account_id', 'integer', (col) =>
            col.references('account.id').notNull()
        )
        .addColumn('queue', 'varchar(50)', (col) => col.notNull())
        .addColumn('tier', 'varchar(25)', (col) => col.notNull())
        .addColumn('rank', 'varchar(3)', (col) => col.notNull())
        .addColumn('LP', 'integer', (col) => col.notNull())
        .addColumn('time', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
        .addUniqueConstraint('unique_record', ['account_id', 'time'])
        .execute();

    await conn.schema
        .createTable('match_lp')
        .addColumn('id', 'integer', (col) => col.autoIncrement().primaryKey())
        .addColumn('accountId', 'integer', (col) =>
            col.references('account.id').notNull()
        )
        .addColumn('matchId', 'varchar(50)', (col) => col.notNull())
        .addColumn('lp', 'integer', (col) => col.references('lp.id').notNull())
        .addColumn('gain', 'integer')
        .execute();
};

export const down = async (conn: Kysely<any>) => {
    await conn.schema.dropTable('match_lp').execute();
    await conn.schema.dropTable('lp').execute();
    await conn.schema.dropTable('accounts').execute();
};
