import { Kysely, MysqlDialect } from 'kysely';
import { createPool } from 'mysql2';
import { DB } from './database';
import { env } from './env';

const dialect = new MysqlDialect({
    pool: createPool({
        host: env.MYSQL_HOST,
        user: env.MYSQL_USERNAME,
        password: env.MYSQL_PASSWORD,
        database: env.MYSQL_DATABASE
    })
});

export const db = new Kysely<DB>({
    dialect
});
