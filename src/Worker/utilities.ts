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

export const persistantExists = (name: string) => {
    return fs.existsSync(`${env.PERSISTANT_CACHE_PATH}/${name}`);
};

export const getPersistant = (name: string) => {
    return `${env.PERSISTANT_CACHE_PATH}/${name}`;
};

export const savePersistant = async (image: Background, name: string) => {
    if (!fs.existsSync(env.PERSISTANT_CACHE_PATH)) {
        fs.mkdirSync(env.PERSISTANT_CACHE_PATH);
    }

    fs.writeFileSync(`${env.PERSISTANT_CACHE_PATH}/${name}`, await image.render());
    return `${env.PERSISTANT_CACHE_PATH}/${name}`;
};

export const toMMSS = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
        .toString()
        .padStart(2, '0');
    const remainingSeconds = (seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${remainingSeconds}`;
};
