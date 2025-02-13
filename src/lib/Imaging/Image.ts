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
        let width: undefined | number;
        if (size.width) {
            const origSize = await this.getSize();
            if (!Number.isInteger(size.width)) {
                width = Math.ceil(origSize.width * size.width);
            } else {
                width = size.width;
            }
        }

        let height: undefined | number;
        if (size.height) {
            const origSize = await this.getSize();
            if (!Number.isInteger(origSize.height)) {
                height = Math.ceil(origSize.height * size.height);
            } else {
                height = size.height;
            }
        }

        this.image = this.image.resize(width, height);
        const { info } = await this.image.png().toBuffer({ resolveWithObject: true });
        this.size = {
            width: info.width ?? 0,
            height: info.height ?? 0
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
