import { Composite } from './Composite';
import sharp from 'sharp';
import { Size } from './types';

export class Background {
    private image: sharp.Sharp;
    private elements: Composite[] = [];
    private metadata!: sharp.Metadata;

    constructor(path: string | Buffer) {
        this.image = sharp(path);
    }

    addElement(element: Composite) {
        this.elements.push(element);
    }

    addElements(elements: Composite[]) {
        this.elements.push(...elements);
    }

    async getSize(): Promise<Size> {
        if (!this.metadata) {
            this.metadata = await this.image.metadata();
        }
        return {
            width: this.metadata.width ?? 0,
            height: this.metadata.height ?? 0
        };
    }

    async render() {
        const buffers = await Promise.all(this.elements.map((e) => e.render()));
        const mySize = await this.getSize();

        return this.image
            .composite(
                await Promise.all(
                    this.elements.map(async (element, index) => {
                        let top: number;
                        if (element.position.y === 'center') {
                            const size = await element.getSize();
                            top = Math.floor((mySize.height - size.height) / 2);
                        } else {
                            top = element.position.y;
                        }

                        let left: number;
                        if (element.position.x === 'center') {
                            const size = await element.getSize();
                            left = Math.floor((mySize.width - size.width) / 2);
                        } else {
                            left = element.position.x;
                        }

                        return {
                            input: buffers[index],
                            top,
                            left
                        };
                    })
                )
            )
            .toBuffer();
    }
}
