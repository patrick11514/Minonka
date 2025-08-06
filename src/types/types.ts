export type Awaitable<T> = Promise<T> | T;
export type DePromise<T> = T extends Promise<infer U> ? U : T;
export type Mutable<T> = {
    -readonly [P in keyof T]: T[P];
};

export type OmitUnion<$Union, $Omit> = $Union extends $Omit ? never : $Union;

export type FileResult =
    | {
          type: 'temp';
          data: string;
      }
    | {
          type: 'persistent';
          name: string;
          data?: string;
      }
    | {
          type: 'local';
          path: string;
      };
