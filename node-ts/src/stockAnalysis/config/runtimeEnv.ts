import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

type RuntimeEnvRecord = Record<string, string>;

const PROJECT_ROOT = join(__dirname, "..", "..", "..");
const CONFIG_DIR = join(PROJECT_ROOT, "config");
const DEFAULT_CONFIG_PATH = join(CONFIG_DIR, "runtime-env.json");
const LOCAL_CONFIG_PATH = join(CONFIG_DIR, "runtime-env.local.json");
const LEGACY_CONFIG_PATH = join(__dirname, "runtime-env.json");

type JsonLike = Record<string, unknown>;

function normalizeValue(value: unknown): string | undefined {
	if (value === undefined || value === null) {
		return undefined;
	}
	if (typeof value === "string") {
		return value;
	}
	if (typeof value === "number" || typeof value === "bigint") {
		return String(value);
	}
	if (typeof value === "boolean") {
		return value ? "1" : "0";
	}
	return JSON.stringify(value);
}

function loadConfig(path: string): RuntimeEnvRecord {
	if (!existsSync(path)) {
		return {};
	}

	try {
		const raw = readFileSync(path, "utf-8");
		if (!raw.trim()) {
			return {};
		}
		const parsed = JSON.parse(raw) as JsonLike;
		const entries: RuntimeEnvRecord = {};
		for (const [key, value] of Object.entries(parsed)) {
			const normalized = normalizeValue(value);
			if (normalized !== undefined) {
				entries[key] = normalized;
			}
		}
		return entries;
	} catch (error) {
		console.error(`[runtimeEnv] 설정 파일을 읽는 중 오류가 발생했습니다: ${path}`, error);
		return {};
	}
}

const defaultConfig = {
	...loadConfig(LEGACY_CONFIG_PATH),
	...loadConfig(DEFAULT_CONFIG_PATH)
};
const localConfig = loadConfig(LOCAL_CONFIG_PATH);

const runtimeEnv: RuntimeEnvRecord = {
	...defaultConfig,
	...localConfig
};

export function getRuntimeEnv(key: string): string | undefined;
export function getRuntimeEnv(key: string, fallback: string): string;
export function getRuntimeEnv(key: string, fallback?: string): string | undefined {
	const configValue = runtimeEnv[key];
	if (configValue !== undefined) {
		return configValue;
	}

	const envValue = process.env[key];
	if (envValue !== undefined) {
		return envValue;
	}

	return fallback;
}

export function getRuntimeEnvNumber(key: string, fallback: number): number {
	const raw = getRuntimeEnv(key);
	if (raw === undefined) {
		return fallback;
	}
	const parsed = Number(raw);
	return Number.isNaN(parsed) ? fallback : parsed;
}

export function getRuntimeEnvFlag(key: string, fallback = false): boolean {
	const raw = getRuntimeEnv(key);
	if (raw === undefined) {
		return fallback;
	}
	const normalized = raw.trim().toLowerCase();
	return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function runtimeEnvSnapshot(): RuntimeEnvRecord {
	return { ...runtimeEnv };
}
