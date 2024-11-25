// deno-lint-ignore-file no-explicit-any

import "@std/dotenv/load";
const CONFIG = {
  CB_PORT: [Number, 4567],
  NODE_ENV: [String, "development"],
  CB_LOG_LEVEL: [String, "INFO"],
  CB_CHROMA_URL: [String, "http://localhost:8000"],
  CB_YT_API_KEY: [String, ""],
  CB_YT_WATCH_PLAYLIST: [String],
  CB_DATABASE_URL: [String],
  CB_DATA_DIR: [String],
  CB_RUN_JOBS: [Boolean, true],
  CB_OLLAMA_HOST: [String, "http://localhost:11434"],
} as const;

type Config = typeof CONFIG;

const typeConverters = {
  string: (v: string) => v,
  number: (v: string) => {
    const num = Number(v);
    if (isNaN(num)) throw new Error("Invalid number");
    return num;
  },
  boolean: (v: string) => {
    const normalized = v.toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
    throw new Error("Invalid boolean value");
  },
};

type UnwrapConfig<T> = T extends readonly [((...args: any[]) => infer R), any]
  ? R
  : T extends readonly [((...args: any[]) => infer R)] ? R
  : never;

const valueCache = new Map<keyof Config, unknown>();

export const config = new Proxy(
  {} as {
    [K in keyof Config]: () => UnwrapConfig<Config[K]>;
  },
  {
    get: (_, key: keyof Config) => () => {
      if (valueCache.has(key)) {
        return valueCache.get(key);
      }

      const envValue = Deno.env.get(String(key));
      const schemaValue = CONFIG[key];
      const defaultValue = schemaValue[1];

      let result;
      if (!envValue && defaultValue !== undefined) {
        result = defaultValue;
      } else if (!envValue) {
        throw new Error(
          `Missing required environment variable: ${String(key)}`,
        );
      } else {
        const type = typeof schemaValue[0]();
        result = typeConverters[type as keyof typeof typeConverters](envValue);
      }

      valueCache.set(key, result);
      return result;
    },
  },
);

export const isProduction = () =>
  config.NODE_ENV().toLowerCase() === "production";
