import { Command } from '$/lib/Command';

export default class Ping extends Command {
    constructor() {
        super('ping', 'Ping command');
    }
}
