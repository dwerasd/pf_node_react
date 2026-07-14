import type { IndicatorInput, IndicatorSeriesData } from "../types";

export interface IndicatorDefinition {
  key: string;
  name: string;
  category: string;
  panel: string;
  description: string;
  isDefault: boolean;
  compute(input: IndicatorInput): IndicatorSeriesData[];
}

export type IndicatorCompute = (input: IndicatorInput) => IndicatorSeriesData[];
