export type Awaitable<T> = Promise<T> | T;
export type DePromise<T> = T extends Promise<infer U> ? U : T;
export type Mutable<T> = {
    -readonly [P in keyof T]: T[P];
};

export type OmitUnion<$Union, $Omit> = $Union extends $Omit ? never : $Union;
