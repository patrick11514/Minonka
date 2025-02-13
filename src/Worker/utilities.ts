import { Background } from '$/lib/Imaging/Background';
import { env } from '$/types/env';
import crypto from 'node:crypto';
import fs from 'node:fs';

export const save = async (image: Background) => {
    if (!fs.existsSync(env.CACHE_PATH)) {
        fs.mkdirSync(env.CACHE_PATH);
    }

    const name = crypto.randomBytes(16).toString('hex');

    fs.writeFileSync(`${env.CACHE_PATH}/${name}.png`, await image.render());
    return `${env.CACHE_PATH}/${name}.png`;
};
