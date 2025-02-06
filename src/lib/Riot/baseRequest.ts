import { env } from '$/types/env';
import { z } from 'zod';
import Logger from '../logger';
import fetch from 'node-fetch';

type StatusCode = 400 | 401 | 403 | 404 | 405 | 415 | 429 | 500 | 502 | 503 | 504;

type Response<$Data> =
    | {
          status: true;
          data: $Data;
      }
    | {
          status: false;
          code: StatusCode;
          message: string;
      };

const l = new Logger('RiotAPI', 'magenta');

export const baseRequest = async <$ResponseData>(url: string, schema: z.ZodType<$ResponseData>): Promise<Response<$ResponseData>> => {
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
        const parse = schema.safeParse(data);

        if (!parse.success) {
            l.error(`Failed to parse response from ${url}`);
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
