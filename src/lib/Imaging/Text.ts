import { Composite } from './Composite';
import { Position, Size } from './types';

export class Text extends Composite {
    constructor(
        private text: string,
        position: Position,
        private size: Size,
        private fontSize: number,
        private color: string,
        private alignment: 'left' | 'middle' | 'right' = 'left',
        private weight: 'bold' | 'normal' = 'bold'
    ) {
        super(position);
    }

    async getSize(): Promise<Size> {
        return this.size;
    }

    async render() {
        let xPosition;
        if (this.alignment === 'middle') {
            xPosition = this.size.width / 2;
        } else if (this.alignment === 'right') {
            xPosition = this.size.width - 10;
        } else {
            xPosition = 10;
        }

        return Buffer.from(`<svg width="${this.size.width}" height="${this.size.height}">
                    <text x="${xPosition}" y="${this.size.height / 2 + this.fontSize / 3}" font-size="${this.fontSize}" fill="${this.color}"
                        font-family="Beaufort for LOL Ja" dominant-baseline="${this.alignment}" text-anchor="${this.alignment}" font-weight="${this.weight}">
                        ${this.text}
                    </text>
                </svg>`);
    }
}
