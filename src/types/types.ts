export type Awaitable<T> = Promise<T> | T;
export type DePromise<T> = T extends Promise<infer U> ? U : T;
