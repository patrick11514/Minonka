import template from '$/lib/langs/_template';
import { env } from '$/types/env';
import fetch from 'node-fetch';
import { z } from 'zod';
import { replacePlaceholders } from '../langs';
import Logger from '../logger';

import { parseRetryAfter, requestPacer } from './rateLimiter';

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
    schema: z.ZodType<$ResponseData>,
    maxRetries = 5
): Promise<Response<$ResponseData>> => {
    let attempts = 0;

    while (attempts <= maxRetries) {
        try {
            await requestPacer.waitForSlot();

            const response = await fetch(url, {
                headers: {
                    'X-Riot-Token': env.RIOT_API_KEY
                }
            });

            if (response.status === 429) {
                attempts++;
                const retryAfter = parseRetryAfter(response.headers.get('retry-after'));
                const limitType = response.headers.get('x-rate-limit-type');
                l.log(
                    `Rate limit hit (429${limitType ? ` - ${limitType}` : ''}) for ${url}. Waiting ${retryAfter}s (attempt ${attempts}/${maxRetries})...`
                );
                requestPacer.setRateLimit(retryAfter);

                if (attempts > maxRetries) {
                    l.error(`Max retries exceeded for ${url} (429 Too Many Requests)`);
                    return {
                        status: false,
                        code: 429,
                        message: response.statusText || 'Rate limit exceeded'
                    };
                }
                continue;
            }

            if (response.status === 503 || response.status === 504) {
                if (attempts < 2) {
                    attempts++;
                    l.log(
                        `Transient server error (${response.status}) for ${url}. Retrying in 1s (attempt ${attempts}/${maxRetries})...`
                    );
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    continue;
                }
            }

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

            if (
                attempts < 2 &&
                (e.message.includes('ECONNRESET') ||
                    e.message.includes('ETIMEDOUT') ||
                    e.message.includes('socket hang up'))
            ) {
                attempts++;
                l.log(
                    `Transient network error (${e.message}) for ${url}. Retrying in 1s...`
                );
                await new Promise((resolve) => setTimeout(resolve, 1000));
                continue;
            }

            l.error(e.message);
            return {
                status: false,
                code: 500,
                message: e.message
            };
        }
    }

    return {
        status: false,
        code: 500,
        message: 'Unknown request error'
    };
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
