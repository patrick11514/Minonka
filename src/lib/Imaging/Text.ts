import sharp from 'sharp';
import { Composite } from './Composite';
import { Position, Size } from './types';

export class Text extends Composite {
    constructor(
        private text: string,
        position: Position,
        private size: Size,
        private fontSize: number,
        private color: string,
        private alignment: 'left' | 'center' | 'right' = 'left'
    ) {
        super(position);
    }

    async getSize(): Promise<Size> {
        return this.size;
    }

    async render() {
        let xPosition;
        if (this.alignment === 'center') {
            xPosition = this.size.width / 2;
        } else if (this.alignment === 'right') {
            xPosition = this.size.width - 10;
        } else {
            xPosition = 10;
        }

        return sharp({
            create: {
                width: this.size.width,
                height: this.size.height,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            }
        })
            .composite([
                {
                    input: Buffer.from(`<svg width="${this.size.width}" height="${this.size}">
                    <text x="${xPosition}" y="${this.size.height / 2}" font-size="${this.fontSize}" fill="${this.color}"
                        font-family="Beaufort for LOL Ja" text-anchor="${this.alignment}">
                        ${this.text}
                    </text>
                </svg>`),
                    top: 0,
                    left: 0
                }
            ])
            .toBuffer();
    }
}
