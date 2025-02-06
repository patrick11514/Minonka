import { ZodSchema } from 'zod';

export class ApiSet<
    $Inner extends Record<
        string,
        //eslint-disable-next-line @typescript-eslint/no-explicit-any
        (...params: any[]) => {
            regional: boolean;
            endOfUrl: string;
            schema: ZodSchema<unknown>;
        }
    >
> {
    constructor(
        public subBaseUrl: string,
        public inner: $Inner
    ) { }
}
