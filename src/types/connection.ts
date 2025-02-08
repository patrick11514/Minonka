import { Kysely, MysqlDialect } from 'kysely';
import { createPool } from 'mysql2';
import { DB } from './database';
import { env } from './env';

const dialect = new MysqlDialect({
    pool: createPool({
        host: env.DATABASE_IP,
        port: env.DATABASE_PORT,
        user: env.DATABASE_USER,
        password: env.DATABASE_PASSWORD,
        database: env.DATABASE_NAME
    })
});

export const conn = new Kysely<DB>({
    dialect
});
