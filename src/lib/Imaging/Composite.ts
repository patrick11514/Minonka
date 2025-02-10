import { Position } from './types';

export abstract class Composite {
    abstract render(): Promise<Buffer>;

    constructor(public position: Position) {}
}
