import { config } from 'dotenv';
import { z } from 'zod';
config();

const schema = z.object({
    DATABASE_IP: z.string(),
    DATABASE_PORT: z.coerce.number(),
    DATABASE_USER: z.string(),
    DATABASE_PASSWORD: z.string(),
    DATABASE_NAME: z.string(),
    RIOT_API_KEY: z.string(),
    CLIENT_ID: z.string(),
    CLIENT_TOKEN: z.string(),
    WEBSOCKET_PORT: z.coerce.number(),
    WEBSOCKET_HOST: z.string(),
    CACHE_PATH: z.string()
});

export const env = schema.parse(process.env);
