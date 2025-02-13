import { Background } from '$/lib/Imaging/Background';
import crypto from 'node:crypto';
import fs from 'node:fs';

const CACHE_PATH = '/dev/shm';

export const save = async (image: Background) => {
    if (!fs.existsSync(CACHE_PATH)) {
        fs.mkdirSync(CACHE_PATH);
    }

    const name = crypto.randomBytes(16).toString('hex');

    fs.writeFileSync(`${CACHE_PATH}/${name}.png`, await image.render());
    return `${CACHE_PATH}/${name}.png`;
};
