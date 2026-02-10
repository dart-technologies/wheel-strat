export type EnvRecord = Record<string, string | undefined>;

export const readEnv = (env: EnvRecord, ...keys: string[]): string | undefined => {
    for (const key of keys) {
        const value = env[key];
        if (value !== undefined && value !== '') return value;
    }
    return undefined;
};

export const readBoolEnv = (env: EnvRecord, key: string): boolean => env[key] === 'true';
