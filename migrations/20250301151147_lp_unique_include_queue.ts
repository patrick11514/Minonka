/*eslint-disable @typescript-eslint/no-explicit-any*/

import { Kysely, sql } from 'kysely';

export const up = async (conn: Kysely<any>) => {
    await sql`ALTER TABLE lp DROP FOREIGN KEY lp_ibfk_1`.execute(conn);
    await conn.schema.alterTable('lp').dropIndex('unique_record').execute();
    await conn.schema
        .alterTable('lp')
        .addIndex('unique_record')
        .columns(['account_id', 'queue', 'time'])
        .unique()
        .execute();
    await sql`ALTER TABLE lp ADD CONSTRAINT lp_ibfk_1 FOREIGN KEY (account_id) REFERENCES account(id)`.execute(
        conn
    );
};

export const down = async (conn: Kysely<any>) => {
    await sql`ALTER TABLE lp DROP FOREIGN KEY lp_ibfk_1`.execute(conn);
    await conn.schema.alterTable('lp').dropIndex('unique_record').execute();
    await conn.schema
        .alterTable('lp')
        .addIndex('unique_record')
        .columns(['account_id', 'queue'])
        .unique()
        .execute();
    await conn.schema
        .alterTable('lp')
        .modifyColumn('account_id', 'integer', (col) =>
            col.references('account.id').notNull()
        )
        .execute();
    await sql`ALTER TABLE lp ADD CONSTRAINT lp_ibfk_1 FOREIGN KEY (account_id) REFERENCES account(id)`.execute(
        conn
    );
};
