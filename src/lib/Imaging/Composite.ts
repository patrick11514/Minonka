import { Position, Size } from './types';

export abstract class Composite {
    abstract render(): Promise<Buffer>;

    constructor(public position: Position) {}

    abstract getSize(): Promise<Size>;
}
