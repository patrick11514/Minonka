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

    async render() {
        const base = sharp({
            create: {
                width: this.size.width,
                height: this.size.height,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            }
        });

        const children = await Promise.all(this.children.map((e) => e.render()));

        return base
            .composite(
                this.children.map((element, index) => ({
                    input: children[index],
                    top: element.position.y,
                    left: element.position.x
                }))
            )
            .toBuffer();
    }
}
