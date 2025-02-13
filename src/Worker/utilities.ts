import { Background } from '$/lib/Imaging/Background';
import crypto from 'node:crypto';
import fs from 'node:fs';

export const save = async (image: Background) => {
    if (!fs.existsSync('cache')) {
        fs.mkdirSync('cache');
    }

    const name = crypto.randomBytes(16).toString('hex');

    fs.writeFileSync(`cache/${name}.png`, await image.render());
    return `cache/${name}.png`;
};
