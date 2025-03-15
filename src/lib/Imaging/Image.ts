import { Composite } from './Composite';
import { Position, Size } from './types';
import sharp from 'sharp';

export class Image extends Composite {
    private image: sharp.Sharp;
    private size!: Size;

    constructor(path: string | Buffer, position: Position) {
        super(position);
        this.image = sharp(path);
    }

    async resize(size: Partial<Size>) {
        const origSize = await this.getSize();

        let width: number | undefined = size.width;
        let height: number | undefined = size.height;

        if (typeof size.width === 'number' && !Number.isInteger(size.width)) {
            width = Math.ceil(origSize.width * size.width);
        }

        if (typeof size.height === 'number' && !Number.isInteger(size.height)) {
            height = Math.ceil(origSize.height * size.height);
        }

        this.image = this.image.resize(width, height);
        this.size = {
            width: width ?? 0,
            height: height ?? 0
        };
    }

    async roundify() {
        const size = await this.getSize();
        const roundedCorners = Buffer.from(
            `<svg><rect x="0" y="0" width="${size.width}" height="${size.height}" rx="100" ry="100"/></svg>`
        );

        this.image = this.image
            .composite([
                {
                    input: roundedCorners,
                    blend: 'dest-in'
                }
            ])
            .png();
    }

    async render() {
        return this.image.toBuffer();
    }

    async getSize(): Promise<Size> {
        if (!this.size) {
            const metadata = await this.image.metadata();
            this.size = {
                width: metadata.width ?? 0,
                height: metadata.height ?? 0
            };
        }

        return this.size;
    }
}
