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
        let width: number | undefined;
        let height: number | undefined;

        if (typeof size.width === 'number') {
            width = Number.isInteger(size.width)
                ? size.width
                : Math.ceil(origSize.width * size.width);
        }

        if (typeof size.height === 'number') {
            height = Number.isInteger(size.height)
                ? size.height
                : Math.ceil(origSize.height * size.height);
        }

        // Maintain aspect ratio if only one dimension is provided
        if (width && !height) {
            height = Math.round((width / origSize.width) * origSize.height);
        } else if (height && !width) {
            width = Math.round((height / origSize.height) * origSize.width);
        }

        this.image = this.image.resize(width, height);

        this.size = {
            width: width ?? origSize.width,
            height: height ?? origSize.height
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
