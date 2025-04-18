import { conn } from '$/types/connection';

/**
 * This is in memory storage, which will be synced with db
 * so when bot restart, it will load data from db.
 * It is key-value storage, where key is some string and value is
 * anything which is JSON serializable.
 */
export class InMemory<$Value = unknown> {
    private memory: Map<string, $Value> = new Map();

    getInstance<$NewType>() {
        return this as unknown as InMemory<$NewType>;
    }

    private async write(key: string, value: $Value) {
        const result = await conn
            .selectFrom('in_memory')
            .where('key', '=', key)
            .selectAll()
            .executeTakeFirst();

        if (!result) {
            await conn
                .insertInto('in_memory')
                .values({ key, value: JSON.stringify(value) })
                .execute();
        } else {
            await conn
                .updateTable('in_memory')
                .set({ value: JSON.stringify(value) })
                .where('key', '=', key)
                .execute();
        }
    }

    set(key: string, value: $Value) {
        this.memory.set(key, value);

        //save to db
        this.write(key, value);
    }

    async get(key: string) {
        if (!this.memory.has(key)) {
            const result = await conn
                .selectFrom('in_memory')
                .where('key', '=', key)
                .selectAll()
                .executeTakeFirst();
            if (result) {
                this.memory.set(key, JSON.parse(result.value));
                return this.memory.get(key);
            }
            return undefined;
        }

        return this.memory.get(key);
    }
}
