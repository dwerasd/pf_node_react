export interface TimeframeOption {
  label: string;
  value: string;
}

const BASE_TIMEFRAME_OPTIONS: TimeframeOption[] = [
  { label: "1분", value: "m1" },
  { label: "3분", value: "m3" },
  { label: "5분", value: "m5" },
  { label: "10분", value: "m10" },
  { label: "15분", value: "m15" },
  { label: "30분", value: "m30" },
  { label: "45분", value: "m45" },
  { label: "60분", value: "m60" },
  { label: "90분", value: "m90" },
  { label: "135분", value: "m135" },
  { label: "240분", value: "m240" },
  { label: "일봉", value: "day1" }
];

// Add temporary frames here when you want to expose them without touching the base list.
const EXTRA_TIMEFRAME_OPTIONS: TimeframeOption[] = [];

// Add frame values (e.g. "m45") here to hide them without touching component logic.
const DISABLED_TIMEFRAME_VALUES = new Set<string>(["m3", "m10", "m90", "m240"]);

function buildTimeframeOptions(): TimeframeOption[] {
  const merged = [...BASE_TIMEFRAME_OPTIONS, ...EXTRA_TIMEFRAME_OPTIONS];
  const uniqueByValue = new Map<string, TimeframeOption>();
  merged.forEach((option) => {
    if (!DISABLED_TIMEFRAME_VALUES.has(option.value)) {
      uniqueByValue.set(option.value, option);
    }
  });
  return Array.from(uniqueByValue.values());
}

export const TIMEFRAME_OPTIONS = buildTimeframeOptions();
export const TIMEFRAME_VALUE_SET = new Set<string>(TIMEFRAME_OPTIONS.map((option) => option.value));
