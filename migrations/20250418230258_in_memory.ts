/*eslint-disable @typescript-eslint/no-explicit-any*/

import { Kysely } from 'kysely';

export const up = async (conn: Kysely<any>) => {
    await conn.schema
        .createTable('in_memory')
        .addColumn('key', 'varchar(100)', (col) => col.primaryKey())
        .addColumn('value', 'json', (col) => col.notNull())
        .execute();
};

export const down = async (conn: Kysely<any>) => {
    await conn.schema.dropTable('in_memory').execute();
};
