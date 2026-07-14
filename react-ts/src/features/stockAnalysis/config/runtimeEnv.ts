import defaults from "./runtime-env.json";

export type RuntimeEnvMap = Record<string, string>;

const runtimeEnv: RuntimeEnvMap = {};

for (const [key, value] of Object.entries(defaults)) {
  if (value === undefined || value === null) {
    continue;
  }
  runtimeEnv[key] = typeof value === "string" ? value : String(value);
}

export function getRuntimeEnv(key: string): string | undefined;
export function getRuntimeEnv(key: string, fallback: string): string;
export function getRuntimeEnv(key: string, fallback?: string): string | undefined {
  const value = runtimeEnv[key];
  if (value !== undefined) {
    return value;
  }
  return fallback;
}

export const API_BASE_URL = getRuntimeEnv("API_BASE_URL", "/api");
