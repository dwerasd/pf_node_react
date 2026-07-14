import { IndicatorDefinition } from "./base";
import { marketBiasDefinitions } from "./marketBias";
import { fvgDefinitions } from "./fvg";
import { superTrendDefinitions } from "./superTrend";
import { cciDefinitions } from "./cci";
import { bollingerDefinitions } from "./bollinger";
import { donchianDefinitions } from "./donchian";
import { movingAverageDefinitions } from "./movingAverage";
import { sellLineDefinitions } from "./sellLine";
import { highLowLineDefinitions } from "./highLowLines";
import { highLowLineLegacyDefinitions } from "./highLowLinesLegacy";
import { rsiDivergenceDefinitions } from "./rsiDivergence";
import { moleDefinitions } from "./mole";
import { macdDefinitions } from "./macd";

const MODULE_DEFINITIONS: IndicatorDefinition[] = [
  ...marketBiasDefinitions,
  ...fvgDefinitions,
  ...superTrendDefinitions,
  ...cciDefinitions,
  ...bollingerDefinitions,
  ...donchianDefinitions,
  ...movingAverageDefinitions,
  ...sellLineDefinitions,
  ...highLowLineDefinitions,
  ...highLowLineLegacyDefinitions,
  ...rsiDivergenceDefinitions,
  ...moleDefinitions,
  ...macdDefinitions
];

export class IndicatorRegistry {
  private definitions: Map<string, IndicatorDefinition> = new Map(
    MODULE_DEFINITIONS.map((definition) => [definition.key, definition])
  );

  listDefinitions(): IndicatorDefinition[] {
    return Array.from(this.definitions.values()).map((definition) => ({ ...definition }));
  }

  getDefinition(key: string): IndicatorDefinition | undefined {
    return this.definitions.get(key);
  }
}
