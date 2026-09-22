import assert from 'node:assert';
import test from 'node:test';
import {
    ApplicationIntegrationType,
    InteractionContextType,
    PermissionFlagsBits
} from 'discord.js';
import { Command } from './Command';
import { canSendToChannel } from './utilities';

class TestCommand extends Command {
    constructor() {
        super('test', 'Test command description');
    }

    async handler() {}
}

test('Command defaults to GuildInstall and UserInstall integration types', () => {
    const cmd = new TestCommand();
    const json = cmd.slashCommand.toJSON();
    assert.deepStrictEqual(json.integration_types, [
        ApplicationIntegrationType.GuildInstall,
        ApplicationIntegrationType.UserInstall
    ]);
});

test('Command defaults to Guild, BotDM, and PrivateChannel contexts', () => {
    const cmd = new TestCommand();
    const json = cmd.slashCommand.toJSON();
    assert.deepStrictEqual(json.contexts, [
        InteractionContextType.Guild,
        InteractionContextType.BotDM,
        InteractionContextType.PrivateChannel
    ]);
});

test('Command allows customizing integration types and contexts', () => {
    const cmd = new TestCommand();
    cmd.setIntegrationTypes(ApplicationIntegrationType.UserInstall);
    cmd.setContexts(InteractionContextType.BotDM);
    const json = cmd.slashCommand.toJSON();
    assert.deepStrictEqual(json.integration_types, [
        ApplicationIntegrationType.UserInstall
    ]);
    assert.deepStrictEqual(json.contexts, [InteractionContextType.BotDM]);
});

test('canSendToChannel returns false when channel is missing or not sendable', () => {
    assert.strictEqual(
        canSendToChannel({
            channel: null,
            inGuild: () => false
        } as never),
        false
    );

    assert.strictEqual(
        canSendToChannel({
            channel: { isTextBased: () => false, isSendable: () => false },
            inGuild: () => false
        } as never),
        false
    );
});

test('canSendToChannel in guild returns false if bot is not in the guild (User App context)', () => {
    assert.strictEqual(
        canSendToChannel({
            channel: { isTextBased: () => true, isSendable: () => true },
            inGuild: () => true,
            guild: null
        } as never),
        false
    );
});

test('canSendToChannel in guild checks SendMessages and ViewChannel permissions', () => {
    const channelMock = {
        isTextBased: () => true,
        isSendable: () => true,
        permissionsFor: () => ({
            has: (perm: bigint) => perm === PermissionFlagsBits.ViewChannel
        })
    };

    assert.strictEqual(
        canSendToChannel({
            channel: channelMock,
            inGuild: () => true,
            guild: { members: { me: {} } }
        } as never),
        false
    );

    const permittedMock = {
        isTextBased: () => true,
        isSendable: () => true,
        permissionsFor: () => ({
            has: () => true
        })
    };

    assert.strictEqual(
        canSendToChannel({
            channel: permittedMock,
            inGuild: () => true,
            guild: { members: { me: {} } }
        } as never),
        true
    );
});

test('canSendToChannel returns false in Group DMs and true in standard DMs', () => {
    const groupDMMock = {
        isTextBased: () => true,
        isSendable: () => true,
        isDMBased: () => true,
        isGroupDM: () => true
    };

    assert.strictEqual(
        canSendToChannel({
            channel: groupDMMock,
            inGuild: () => false
        } as never),
        false
    );

    const standardDMMock = {
        isTextBased: () => true,
        isSendable: () => true,
        isDMBased: () => true,
        isGroupDM: () => false
    };

    assert.strictEqual(
        canSendToChannel({
            channel: standardDMMock,
            inGuild: () => false
        } as never),
        true
    );
});
