import { Composite } from './Composite';
import sharp from 'sharp';

export class Background {
    private image: sharp.Sharp;
    private elements: Composite[] = [];

    constructor(path: string) {
        this.image = sharp(path);
    }

    addElement(element: Composite) {
        this.elements.push(element);
    }

    async render() {
        const buffers = await Promise.all(this.elements.map((e) => e.render()));
        return this.image
            .composite(
                this.elements.map((element, index) => ({
                    input: buffers[index],
                    top: element.position.y,
                    left: element.position.x
                }))
            )
            .toBuffer();
    }
}
