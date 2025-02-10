import { Composite } from './Composite';
import { Position, Size } from './types';
import sharp from 'sharp';

export class Image extends Composite {
    private image: sharp.Sharp;

    constructor(path: string, position: Position, size?: Size) {
        super(position);
        this.image = sharp(path);
        if (size) {
            this.image.resize(size.width, size.height);
        }
    }

    async render() {
        return this.image.toBuffer();
    }
}
