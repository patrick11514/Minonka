import template from '$/lib/langs/_template';
import { env } from '$/types/env';
import fetch from 'node-fetch';
import { z } from 'zod';
import { replacePlaceholders } from '../langs';
import Logger from '../logger';

type StatusCode = 400 | 401 | 403 | 404 | 405 | 415 | 429 | 500 | 502 | 503 | 504;

type RiotErrorResponse = {
    status: false;
    code: StatusCode;
    message: string;
};

export type Response<$Data> =
    | {
          status: true;
          data: $Data;
      }
    | RiotErrorResponse;

export type toValidResponse<$Type> = $Type extends { status: true; data: infer $Inner }
    ? {
          status: true;
          data: $Inner;
      }
    : never;

const l = new Logger('RiotAPI', 'magenta');

export const baseRequest = async <$ResponseData>(
    url: string,
    schema: z.ZodType<$ResponseData>
): Promise<Response<$ResponseData>> => {
    try {
        const response = await fetch(url, {
            headers: {
                'X-Riot-Token': env.RIOT_API_KEY
            }
        });

        if (!response.ok || response.status !== 200) {
            l.error(`Request to ${url} failed with status ${response.status}`);
            return {
                status: false,
                code: response.status as StatusCode,
                message: response.statusText
            };
        }

        const data = await response.json();
        const fs = await import('fs');
        fs.promises.writeFile(`./riot_${Date.now()}.json`, JSON.stringify(data, null, 4));

        const parse = schema.safeParse(data);

        if (!parse.success) {
            l.error(`Failed to parse response from ${url}`);
            l.error(parse.error);
            return {
                status: false,
                code: 500,
                message: 'Failed to parse response'
            };
        }

        return {
            status: true,
            data: parse.data
        };
    } catch (e) {
        if (!(e instanceof Error)) {
            throw e;
        }

        l.error(e.message);
        return {
            status: false,
            code: 500,
            message: e.message
        };
    }
};

export const formatErrorResponse = (
    lang: z.infer<typeof template>,
    response: RiotErrorResponse
) => {
    return replacePlaceholders(
        lang.riotApi.error,
        response.code.toString(),
        response.message
    );
};
