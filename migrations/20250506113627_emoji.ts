/*eslint-disable @typescript-eslint/no-explicit-any*/

import { Kysely } from 'kysely';

export const up = async (conn: Kysely<any>) => {
    await conn.schema
        .createTable('emoji')
        .addColumn('id', 'integer', (col) => col.autoIncrement().primaryKey())
        .addColumn('name', 'varchar(255)', (col) => col.notNull())
        .addColumn('guild', 'varchar(255)', (col) => col.notNull())
        .addColumn('emoji_id', 'varchar(255)', (col) => col.notNull())
        .execute();
};

export const down = async (conn: Kysely<any>) => {
    await conn.schema.dropTable('emoji').execute();
};
