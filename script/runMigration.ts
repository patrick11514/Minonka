import { Migrator, FileMigrationProvider } from 'kysely';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { conn } from '../src/types/connection';

async function runMigrations() {
    const migrator = new Migrator({
        db: conn,
        provider: new FileMigrationProvider({
            fs,
            path,
            migrationFolder: path.resolve(import.meta.dirname, '../migrations')
        })
    });

    const result = await migrator.migrateToLatest();

    if (result.error) {
        console.error('Migration failed:', result.error);
        process.exit(1);
    }

    console.log('Migrations applied successfully.');
}

runMigrations().then(() => process.exit(0));
