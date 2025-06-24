/*eslint-disable @typescript-eslint/no-explicit-any*/

import { Kysely } from 'kysely';

export const up = async (conn: Kysely<any>) => {
    await conn.schema
        .alterTable('account')
        .dropColumn('summoner_id')
        .dropColumn('account_id')
        .execute();
};

export const down = async (conn: Kysely<any>) => {
    // Add rollback logic here
    await conn.schema
        .alterTable('account')
        .addColumn('summoner_id', 'varchar(80)')
        .addColumn('account_id', 'varchar(80)')
        .execute();
};
