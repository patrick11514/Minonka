import { EmojiManager } from '$/lib/EmojiManager';
import { InMemory } from '$/lib/InMemory';
import { WorkerServer } from '$/lib/WorkerServer';
import { Client } from 'discord.js';

export { };

declare global {
    namespace NodeJS {
        interface Process {
            workerServer: WorkerServer;
            client: Client;
            lolPatch: string;
            inMemory: InMemory;
            emoji: EmojiManager;
        }
    }
    interface ObjectConstructor {
        entries<$Object extends object>(
            o: $Object
        ): { [$Key in keyof $Object]: [$Key, $Object[$Key]] }[keyof $Object][];
        fromEntries<$Array extends readonly (readonly [PropertyKey, unknown])[]>(
            entries: $Array
        ): {
                [$Key in $Array[number]as $Key[0]]: $Key[1];
            };
    }
}
