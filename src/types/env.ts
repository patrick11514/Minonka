import { config } from 'dotenv';
import { z } from 'zod';
config();

const schema = z.object({
    MYSQL_HOST: z.string(),
    MYSQL_USERNAME: z.string(),
    MYSQL_PASSWORD: z.string(),
    MYSQL_DATABASE: z.string()
});

export const env = schema.parse(process.env);
