import { ZodSchema } from 'zod';
import { ApiSet } from './apiSet';
import { baseRequest } from './baseRequest';

type DataObject = {
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: DataObject | ApiSet<any>;
};

type ReturnObject<$Data extends DataObject> = {
    [$DataKey in keyof $Data]: $Data[$DataKey] extends ApiSet<infer $Inner>
        ? {
              [$InnerKey in keyof $Inner]: (...params: Parameters<$Inner[$InnerKey]>) => ReturnType<typeof baseRequest<ReturnType<$Inner[$InnerKey]>['schema']>>;
          }
        : $Data[$DataKey] extends DataObject
          ? ReturnObject<$Data[$DataKey]>
          : never;
};

const transform = <$Data extends DataObject>(data: $Data, regionRoot: string, routingRoot: string): ReturnObject<$Data> => {
    type UnknownHell = {
        [key: string]: UnknownHell | unknown;
    };

    const resultObject = {} as UnknownHell;

    for (const [key, value] of Object.entries(data)) {
        if (!(value instanceof ApiSet)) {
            resultObject[key] = transform(value as DataObject, `${regionRoot}/${key}`, `${routingRoot}/${key}`);

            continue;
        }

        resultObject[key] = {} as UnknownHell;

        for (const [innerKey, data] of Object.entries(value.inner)) {
            (resultObject[key] as UnknownHell)[innerKey] = async (...args: unknown[]) => {
                const { endOfUrl, schema, regional } = (
                    data as (...params: unknown[]) => {
                        regional: boolean;
                        endOfUrl: string;
                        schema: ZodSchema<unknown>;
                    }
                )(...args);
                return await baseRequest(`${regional ? regionRoot : routingRoot}${value.subBaseUrl}${endOfUrl}`, schema);
            };
        }
    }

    return resultObject as ReturnObject<$Data>;
};

export default transform;
