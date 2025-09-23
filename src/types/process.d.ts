import { DiscordBot } from '$/lib/DiscordBot';
import { EmojiManager } from '$/lib/EmojiManager';
import { InMemory } from '$/lib/InMemory';
import { WorkerServer } from '$/lib/WorkerServer';
import { Client } from 'discord.js';

export {};

declare global {
    namespace NodeJS {
        interface Process {
            workerServer: WorkerServer;
            client: Client;
            discordBot: DiscordBot;
            lolPatch: string;
            inMemory: InMemory;
            emoji: EmojiManager;
            patching: boolean;
            isUpdating: boolean;
        }
    }
    interface ObjectConstructor {
        entries<$Object extends object>(
            o: $Object
        ): { [$Key in keyof $Object]: [$Key, $Object[$Key]] }[keyof $Object][];
        fromEntries<$Array extends readonly (readonly [PropertyKey, unknown])[]>(
            entries: $Array
        ): {
            [$Key in $Array[number] as $Key[0]]: $Key[1];
        };
    }

    interface Array<T> {
        asyncFind(
            predicate: (value: T, index: number, array: T[]) => Promise<boolean>
        ): Promise<T | undefined>;
        asyncFindIndex(
            predicate: (value: T, index: number, array: T[]) => Promise<boolean>
        ): Promise<number>;
        asyncMap<U>(
            callback: (value: T, index: number, array: T[]) => Promise<U>
        ): Promise<U[]>;
    }
}
