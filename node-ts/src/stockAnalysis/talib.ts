// @ts-nocheck
import { createRequire } from "node:module";

import { getRuntimeEnv, getRuntimeEnvFlag } from "./config/runtimeEnv";

export interface TalibModuleLike {
	ATR(highs: number[], lows: number[], closes: number[], period: number): number[];
	MACD(
		values: number[],
		fastPeriod: number,
		slowPeriod: number,
		signalPeriod: number
	): ArrayLike<number>[];
	[key: string]: unknown;
}

export type TalibMode = "auto" | "force" | "off";

function readTalibMode(): TalibMode {
	const raw = getRuntimeEnv("TMENGINE_TALIB_MODE", "auto").trim().toLowerCase();
	if (raw === "force") {
		return "force";
	}
	if (raw === "off" || raw === "disable") {
		return "off";
	}
	return "auto";
}

export interface TalibContext {
	available: boolean;
	mode: TalibMode;
	module: TalibModuleLike | null;
	error?: unknown;
}

const talibMode = readTalibMode();
const moduleRequire = createRequire(__filename);

let loadedModule: TalibModuleLike | null = null;
let loadError: unknown;

const disableTalib = getRuntimeEnvFlag("TMENGINE_DISABLE_TALIB", false);

if (talibMode !== "off" && !disableTalib) {
	try {
	loadedModule = moduleRequire("talib-binding") as TalibModuleLike;
	} catch (error) {
		loadError = error;
		loadedModule = null;
	}
}

export const talibContext: TalibContext = {
	available: loadedModule !== null,
	mode: talibMode,
	module: loadedModule,
	error: loadError
};

export default talibContext;
