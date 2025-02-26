/*eslint-disable @typescript-eslint/no-explicit-any*/

import { Kysely } from 'kysely';

export const up = async (conn: Kysely<any>) => {
    await conn.schema
        .alterTable('account')
        .modifyColumn('discord_id', 'varchar(18)')
        .execute();
};

export const down = async (conn: Kysely<any>) => {
    await conn.schema
        .alterTable('account')
        .modifyColumn('discord_id', 'varchar(18)', (col) => col.notNull())
        .execute();
};
