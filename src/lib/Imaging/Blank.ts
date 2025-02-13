import sharp from 'sharp';
import { Composite } from './Composite';
import { Position, Size } from './types';

export class Blank extends Composite {
    private children: Composite[] = [];
    constructor(
        position: Position,
        private size: Size
    ) {
        super(position);
    }

    addElement(element: Composite) {
        this.children.push(element);
    }

    async getSize(): Promise<Size> {
        return this.size;
    }

    async render() {
        const base = sharp({
            create: {
                width: this.size.width,
                height: this.size.height,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            }
        });

        const mySize = await this.getSize();

        return base

            .composite(
                await Promise.all(
                    this.children.map(async (element) => {
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
                            input: await element.render(),
                            top,
                            left
                        };
                    })
                )
            )
            .toBuffer();
    }
}
