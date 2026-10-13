import {MapLineData} from "./map-lines-context";
import {SignalStatus} from "./types";
import {getCoordsFromLineString} from "./ui";

const SPEED_COLORS: Record<number, string> = {
  32767: "#00FF00",
  130: "#00FF00",
  100: "#FFFF00",
  60: "#FFA500",
  50: "#FFD700",
  40: "#FF5000",
  20: "#FFFFFF",
};

const NEXT_COLOR = "#0000FF";
const NEXT_FURTHER_COLOR = "#800080";
const PREV_COLOR = "#FF0000";
const PREV_FURTHER_COLOR = "#FFA500";

const DEFAULT_MAX_LAYER = 20;
const DEFAULT_MAX_STACK_SIZE = 10;

const SPEED_UNKNOWN_LABEL = "?";

type SignalLookup = (name: string) => SignalStatus | undefined;
/** Fetches the lines of many connections in one request, in the order of the given [from, to] pairs. */
export type GetLinesForConnections = (connections: [string, string][]) => Promise<(string[] | null)[]>;
/** Lines of an already fetched connection. */
type ConnectionLinesLookup = (from: string, to: string) => string[] | null;

type AppendResult = {
  lines: MapLineData["lines"];
  nextIndex: number;
};

type AppendContext = {
  signal: SignalStatus;
  lookupSignal: SignalLookup;
  startIndex: number;
};

const formatVmaxLabel = (vmax: number | null | undefined): string => {
  if (vmax == null) {
    return SPEED_UNKNOWN_LABEL;
  }

  return vmax === 32767 ? "VMAX" : `${vmax} km/h`;
};

const getSpeedColor = (vmax: number | null | undefined): string | undefined => {
  if (vmax == null) {
    return undefined;
  }

  return SPEED_COLORS[vmax];
};

const createLookup = (signals: SignalStatus[]): SignalLookup => {
  return (name) => signals.find((s) => s.Name === name);
};

const appendDirectLines = ({ signal, lookupSignal, startIndex }: AppendContext): AppendResult => {
  const lines: MapLineData["lines"] = [];
  let index = startIndex;

  for (const nextSignal of signal.NextSignals) {
    const nextSignalData = lookupSignal(nextSignal.Name);
    if (!nextSignalData) {
      continue;
    }

    lines.push({
      label: `${signal.Name} -> ${nextSignal.Name} (${formatVmaxLabel(nextSignal.Vmax)})`,
      color: NEXT_COLOR,
      color2: getSpeedColor(nextSignal.Vmax),
      coords: [
        [signal.Location.Y, signal.Location.X],
        [nextSignalData.Location.Y, nextSignalData.Location.X],
      ],
      index: index++,
    });
  }

  for (const prevSignal of signal.PrevSignals) {
    const prevSignalData = lookupSignal(prevSignal.Name);
    if (!prevSignalData) {
      continue;
    }

    lines.push({
      label: `${prevSignal.Name} -> ${signal.Name} (${formatVmaxLabel(prevSignal.Vmax)})`,
      color: PREV_COLOR,
      color2: getSpeedColor(prevSignal.Vmax),
      coords: [
        [signal.Location.Y, signal.Location.X],
        [prevSignalData.Location.Y, prevSignalData.Location.X],
      ],
      index: index++,
    });
  }

  return { lines, nextIndex: index };
};

const appendConnectionLines = (
  { signal, lookupSignal, startIndex }: AppendContext,
  getLines: ConnectionLinesLookup,
): AppendResult => {
  const lines: MapLineData["lines"] = [];
  let index = startIndex;

  for (const prevSignal of signal.PrevSignals) {
    const prevSignalData = lookupSignal(prevSignal.Name);
    if (!prevSignalData) {
      continue;
    }

    const signalLines = getLines(prevSignal.Name, signal.Name);
    if (!signalLines) {
      continue;
    }

    signalLines.forEach((line, lineIndex) => {
      const coords = [
        [prevSignalData.Location.Y, prevSignalData.Location.X] as [number, number],
        ...getCoordsFromLineString(line),
        [signal.Location.Y, signal.Location.X] as [number, number],
      ];

      lines.push({
        color: PREV_COLOR,
        color2: getSpeedColor(prevSignal.Vmax),
        coords,
        index: index++,
        width: 3,
        label:
          lineIndex === 0 ? `${prevSignal.Name} -> ${signal.Name} (${formatVmaxLabel(prevSignal.Vmax)})` : undefined,
      });
    });
  }

  for (const nextSignal of signal.NextSignals) {
    const nextSignalData = lookupSignal(nextSignal.Name);
    if (!nextSignalData) {
      continue;
    }

    const signalLines = getLines(signal.Name, nextSignal.Name);
    if (!signalLines) {
      continue;
    }

    signalLines.forEach((line, lineIndex) => {
      const coords = [
        [signal.Location.Y, signal.Location.X] as [number, number],
        ...getCoordsFromLineString(line),
        [nextSignalData.Location.Y, nextSignalData.Location.X] as [number, number],
      ];

      lines.push({
        color: NEXT_COLOR,
        color2: getSpeedColor(nextSignal.Vmax),
        coords,
        index: index++,
        width: 3,
        label:
          lineIndex === 0 ? `${signal.Name} -> ${nextSignal.Name} (${formatVmaxLabel(nextSignal.Vmax)})` : undefined,
      });
    });
  }

  return { lines, nextIndex: index };
};

/**
 * Runs `build` twice: first only to collect the connections it needs lines for, then, after fetching all of them
 * with a single request, to build the result. Building is cheap and deterministic, a request per connection is not.
 */
const withConnectionLines = async (
  build: (getLines: ConnectionLinesLookup) => AppendResult,
  getLinesForConnections: GetLinesForConnections,
): Promise<AppendResult> => {
  const key = (from: string, to: string) => `${from}\u0000${to}`;

  const wanted = new Map<string, [string, string]>();
  build((from, to) => {
    wanted.set(key(from, to), [from, to]);
    return null;
  });

  if (wanted.size === 0) {
    return build(() => null);
  }

  const connections = [...wanted.values()];
  let fetched: (string[] | null)[] = [];
  try {
    fetched = await getLinesForConnections(connections);
  } catch (error) {
    console.warn(`Failed to get lines for ${connections.length} signal connections`, error);
  }

  const linesByConnection = new Map(connections.map(([from, to], i) => [key(from, to), fetched[i] ?? null]));

  return build((from, to) => linesByConnection.get(key(from, to)) ?? null);
};

/** Darkens a hex color by the given percentage. */
const darkenColor = (color: string, percent: number): string => {
  const num = parseInt(color.replace("#", ""), 16);
  const amount = Math.round(2.55 * percent);
  const r = Math.max(0, Math.min(255, (num >> 16) - amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) - amount));
  const b = Math.max(0, Math.min(255, (num & 0x0000ff) - amount));

  return `#${(0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1)}`;
};

const appendNextSignalLayers = (
  { signal, lookupSignal, startIndex }: AppendContext,
  getLines: ConnectionLinesLookup,
  maxLayer: number,
  maxStackSize: number,
  skipDirect: boolean,
  skipConnections: boolean,
): AppendResult => {
  const lines: MapLineData["lines"] = [];
  let index = startIndex;

  let stack: SignalStatus[] = [signal];
  let newStack: SignalStatus[] = [];
  let layer = 0;

  while (stack.length > 0 && layer < maxLayer) {
    for (const currentSignal of stack) {
      for (const nextSignal of currentSignal.NextSignals) {
        const nextSignalData = lookupSignal(nextSignal.Name);
        if (!nextSignalData) {
          continue;
        }

        const color = darkenColor(layer % 2 === 0 ? NEXT_COLOR : NEXT_FURTHER_COLOR, (layer / maxLayer) * 100);
        const color2 = getSpeedColor(nextSignal.Vmax);

        if (!skipDirect) {
          lines.push({
            label: `${currentSignal.Name} -> ${nextSignal.Name} (${formatVmaxLabel(nextSignal.Vmax)})`,
            color,
            color2,
            coords: [
              [currentSignal.Location.Y, currentSignal.Location.X],
              [nextSignalData.Location.Y, nextSignalData.Location.X],
            ],
            index: index++,
          });
        }

        if (!skipConnections) {
          const signalLines = getLines(currentSignal.Name, nextSignal.Name);
          signalLines?.forEach((line) => {
            const coords = [
              [currentSignal.Location.Y, currentSignal.Location.X] as [number, number],
              ...getCoordsFromLineString(line),
              [nextSignalData.Location.Y, nextSignalData.Location.X] as [number, number],
            ];

            lines.push({
              color,
              color2,
              coords,
              index: index++,
              width: 1,
              label: undefined,
            });
          });
        }

        if (newStack.length < maxStackSize) {
          newStack.push(nextSignalData);
        }
      }
    }

    stack = newStack;
    newStack = [];
    layer++;
  }

  return { lines, nextIndex: index };
};

const appendPreviousSignalLayers = (
  { signal, lookupSignal, startIndex }: AppendContext,
  getLines: ConnectionLinesLookup,
  maxLayer: number,
  maxStackSize: number,
  skipDirect: boolean,
  skipConnections: boolean,
): AppendResult => {
  const lines: MapLineData["lines"] = [];
  let index = startIndex;

  let stack: SignalStatus[] = [signal];
  let newStack: SignalStatus[] = [];
  let layer = 0;

  while (stack.length > 0 && layer < maxLayer) {
    for (const currentSignal of stack) {
      for (const prevSignal of currentSignal.PrevSignals) {
        const prevSignalData = lookupSignal(prevSignal.Name);
        if (!prevSignalData) {
          continue;
        }

        const color = darkenColor(layer % 2 === 0 ? PREV_COLOR : PREV_FURTHER_COLOR, (layer / maxLayer) * 100);
        const color2 = getSpeedColor(prevSignal.Vmax);

        if (!skipDirect) {
          lines.push({
            label: `${prevSignal.Name} -> ${currentSignal.Name} (${formatVmaxLabel(prevSignal.Vmax)})`,
            color,
            color2,
            coords: [
              [currentSignal.Location.Y, currentSignal.Location.X],
              [prevSignalData.Location.Y, prevSignalData.Location.X],
            ],
            index: index++,
          });
        }

        if (!skipConnections) {
          const signalLines = getLines(prevSignalData.Name, currentSignal.Name);
          signalLines?.forEach((line) => {
            const coords = [
              [currentSignal.Location.Y, currentSignal.Location.X] as [number, number],
              ...getCoordsFromLineString(line),
              [prevSignalData.Location.Y, prevSignalData.Location.X] as [number, number],
            ];

            lines.push({
              color,
              color2,
              coords,
              index: index++,
              width: 1,
              label: undefined,
            });
          });
        }

        if (newStack.length < maxStackSize) {
          newStack.push(prevSignalData);
        }
      }
    }

    stack = newStack;
    newStack = [];
    layer++;
  }

  return { lines, nextIndex: index };
};

export interface CalculateSignalDirectLinesParams {
  signal: SignalStatus;
  signalsData: SignalStatus[];
  startIndex?: number;
}

export const calculateSignalDirectLines = ({
  signal,
  signalsData,
  startIndex = 0,
}: CalculateSignalDirectLinesParams): AppendResult => {
  const lookupSignal = createLookup(signalsData);
  return appendDirectLines({ signal, lookupSignal, startIndex });
};

export interface CalculateSignalConnectionLinesParams {
  signal: SignalStatus;
  signalsData: SignalStatus[];
  getLinesForConnections: GetLinesForConnections;
  startIndex?: number;
}

export const calculateSignalConnectionLines = async ({
  signal,
  signalsData,
  getLinesForConnections,
  startIndex = 0,
}: CalculateSignalConnectionLinesParams): Promise<AppendResult> => {
  const lookupSignal = createLookup(signalsData);
  return withConnectionLines(
    (getLines) => appendConnectionLines({ signal, lookupSignal, startIndex }, getLines),
    getLinesForConnections,
  );
};

export interface CalculateFurtherSignalLinesParams {
  signal: SignalStatus;
  signalsData: SignalStatus[];
  getLinesForConnections: GetLinesForConnections;
  skipDirect?: boolean;
  skipConnections?: boolean;
  maxLayer?: number;
  maxStackSize?: number;
  startIndex?: number;
}

export const calculateFurtherSignalLines = async ({
  signal,
  signalsData,
  getLinesForConnections,
  skipDirect = false,
  skipConnections = false,
  maxLayer = DEFAULT_MAX_LAYER,
  maxStackSize = DEFAULT_MAX_STACK_SIZE,
  startIndex = 0,
}: CalculateFurtherSignalLinesParams): Promise<AppendResult> => {
  const lookupSignal = createLookup(signalsData);

  // both directions in one build, so all their connections are fetched in a single request
  return withConnectionLines((getLines) => {
    const nextResult = appendNextSignalLayers(
      { signal, lookupSignal, startIndex },
      getLines,
      maxLayer,
      maxStackSize,
      skipDirect,
      skipConnections,
    );

    const prevResult = appendPreviousSignalLayers(
      { signal, lookupSignal, startIndex: nextResult.nextIndex },
      getLines,
      maxLayer,
      maxStackSize,
      skipDirect,
      skipConnections,
    );

    return { lines: [...nextResult.lines, ...prevResult.lines], nextIndex: prevResult.nextIndex };
  }, getLinesForConnections);
};
