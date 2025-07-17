import sharp from 'sharp';
import { Composite } from './Composite';
import { Position, Size } from './types';

export class Text extends Composite {
    constructor(
        private text:
            | string
            | (
                  | string
                  | {
                        text: string;
                        color: string;
                    }
              )[],
        position: Position,
        private size: Size,
        private fontSize: number,
        private color: string,
        private alignment: 'start' | 'middle' | 'end' = 'start',
        private weight: 'bold' | 'normal' = 'bold',
        private outline: boolean | string = false,
        private padding: number = 10
    ) {
        super(position);
    }

    async getSize(): Promise<Size> {
        return this.size;
    }

    async getTextSize(): Promise<Size> {
        const svg = `<svg>
                    <style>
                        .outline {
                            paint-order: stroke;
                            stroke: ${this.outline === true ? 'black' : this.outline};
                            stroke-width: 6px;
                            stroke-linecap: butt;
                            stroke-linejoin: miter;
                        }
                    </style>
                    <text class="${this.outline ? 'outline' : ''}" font-size="${this.fontSize}" fill="${this.color}"
                        font-family="Beaufort for LOL Ja" dominant-baseline="${this.alignment}" text-anchor="${this.alignment}" font-weight="${this.weight}">
                        ${this.text}
                    </text>
                </svg>`;

        const size = await sharp(Buffer.from(svg)).metadata();

        return {
            width: size.width ?? 0,
            height: size.height ?? 0
        };
    }

    private renderText(): string {
        if (typeof this.text === 'string') {
            return this.text;
        }

        return this.text
            .map((t) => {
                if (typeof t === 'string') {
                    return t;
                } else {
                    return `<tspan fill="${t.color}">${t.text}</tspan>`;
                }
            })
            .join('');
    }

    async render() {
        let xPosition;
        if (this.alignment === 'middle') {
            xPosition = this.size.width / 2;
        } else if (this.alignment === 'end') {
            xPosition = this.size.width - this.padding;
        } else {
            xPosition = this.padding;
        }

        return Buffer.from(`<svg width="${this.size.width}" height="${this.size.height}">
                    <style>
                        .outline {
                            paint-order: stroke;
                            stroke: ${this.outline === true ? 'black' : this.outline};
                            stroke-width: 6px;
                            stroke-linecap: butt;
                            stroke-linejoin: miter;
                        }
                    </style>
                    <text class="${this.outline ? 'outline' : ''}" x="${xPosition}" y="${this.size.height / 2 + this.fontSize / 3}" font-size="${this.fontSize}" fill="${this.color}"
                        font-family="Beaufort for LOL Ja" dominant-baseline="${this.alignment}" text-anchor="${this.alignment}" font-weight="${this.weight}">
                        ${this.renderText()}
                    </text>
                </svg>`);
    }
}
