import { ZodSchema } from 'zod';

export type RouteConfig = {
    type: 'regional' | 'routing' | 'account';
    endOfUrl: string;
    schema: ZodSchema<unknown>;
};

export class ApiSet<
    $Inner extends Record<
        string,
        //eslint-disable-next-line @typescript-eslint/no-explicit-any
        (...params: any[]) => RouteConfig
    >
> {
    constructor(
        public subBaseUrl: string,
        public inner: $Inner
    ) {}
}
