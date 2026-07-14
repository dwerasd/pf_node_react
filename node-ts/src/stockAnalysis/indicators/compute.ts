import { buildIndicatorInput } from "../types";
import type { ChartPayload, IndicatorSeriesData } from "../types";
import type { IndicatorRegistry } from "./registry";

interface ComputeParams {
  keys: string[];
  payload: ChartPayload;
  registry: IndicatorRegistry;
}

export function computeIndicatorSeries(params: ComputeParams): IndicatorSeriesData[] {
  const { keys, payload, registry } = params;
  const input = buildIndicatorInput(payload);
  const seen = new Set<string>();
  const results: IndicatorSeriesData[] = [];

  for (const key of keys) {
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const definition = registry.getDefinition(key);
    if (!definition) {
      continue;
    }
    const series = definition.compute(input);
    if (Array.isArray(series) && series.length > 0) {
      series.forEach((item) => {
        results.push({ ...item, sourceKey: key });
      });
    }
  }

  return results;
}
