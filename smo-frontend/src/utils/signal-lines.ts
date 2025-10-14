import { MapLineData } from "./map-lines-context";
import { SignalStatus } from "./types";
import { getCoordsFromLineString } from "./ui";

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
type GetLinesForConnection = (from: string, to: string) => Promise<string[] | null>;

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

const appendConnectionLines = async (
  { signal, lookupSignal, startIndex }: AppendContext,
  getLinesForConnection: GetLinesForConnection,
): Promise<AppendResult> => {
  const lines: MapLineData["lines"] = [];
  let index = startIndex;

  for (const prevSignal of signal.PrevSignals) {
    const prevSignalData = lookupSignal(prevSignal.Name);
    if (!prevSignalData) {
      continue;
    }

    try {
      const signalLines = await getLinesForConnection(prevSignal.Name, signal.Name);
      if (!signalLines) {
        continue;
      }

      signalLines.forEach((line) => {
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
          width: 1,
          label: undefined,
        });
      });
    } catch (error) {
      console.warn(`Failed to get lines for signal ${signal.Name}`, error);
    }
  }

  for (const nextSignal of signal.NextSignals) {
    const nextSignalData = lookupSignal(nextSignal.Name);
    if (!nextSignalData) {
      continue;
    }

    try {
      const signalLines = await getLinesForConnection(signal.Name, nextSignal.Name);
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
    } catch (error) {
      console.warn(`Failed to get lines for signal connections from ${signal.Name}`, error);
    }
  }

  return { lines, nextIndex: index };
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

const appendNextSignalLayers = async (
  { signal, lookupSignal, startIndex }: AppendContext,
  getLinesForConnection: GetLinesForConnection,
  maxLayer: number,
  maxStackSize: number,
  skipDirect: boolean,
  skipConnections: boolean,
): Promise<AppendResult> => {
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
          try {
            const signalLines = await getLinesForConnection(currentSignal.Name, nextSignal.Name);
            if (signalLines) {
              signalLines.forEach((line) => {
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
          } catch (error) {
            console.warn(`Failed to get lines for signal connections from ${currentSignal.Name}`, error);
          }
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

const appendPreviousSignalLayers = async (
  { signal, lookupSignal, startIndex }: AppendContext,
  getLinesForConnection: GetLinesForConnection,
  maxLayer: number,
  maxStackSize: number,
  skipDirect: boolean,
  skipConnections: boolean,
): Promise<AppendResult> => {
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
          try {
            const signalLines = await getLinesForConnection(prevSignalData.Name, currentSignal.Name);
            if (signalLines) {
              signalLines.forEach((line) => {
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
          } catch (error) {
            console.warn(`Failed to get lines for signal ${signal.Name}`, error);
          }
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
  getLinesForConnection: GetLinesForConnection;
  startIndex?: number;
}

export const calculateSignalConnectionLines = async ({
  signal,
  signalsData,
  getLinesForConnection,
  startIndex = 0,
}: CalculateSignalConnectionLinesParams): Promise<AppendResult> => {
  const lookupSignal = createLookup(signalsData);
  return appendConnectionLines({ signal, lookupSignal, startIndex }, getLinesForConnection);
};

export interface CalculateFurtherSignalLinesParams {
  signal: SignalStatus;
  signalsData: SignalStatus[];
  getLinesForConnection: GetLinesForConnection;
  skipDirect?: boolean;
  skipConnections?: boolean;
  maxLayer?: number;
  maxStackSize?: number;
  startIndex?: number;
}

export const calculateFurtherSignalLines = async ({
  signal,
  signalsData,
  getLinesForConnection,
  skipDirect = false,
  skipConnections = false,
  maxLayer = DEFAULT_MAX_LAYER,
  maxStackSize = DEFAULT_MAX_STACK_SIZE,
  startIndex = 0,
}: CalculateFurtherSignalLinesParams): Promise<AppendResult> => {
  const lookupSignal = createLookup(signalsData);
  let nextIndex = startIndex;
  const lines: MapLineData["lines"] = [];

  const nextResult = await appendNextSignalLayers(
    { signal, lookupSignal, startIndex: nextIndex },
    getLinesForConnection,
    maxLayer,
    maxStackSize,
    skipDirect,
    skipConnections,
  );
  lines.push(...nextResult.lines);
  nextIndex = nextResult.nextIndex;

  const prevResult = await appendPreviousSignalLayers(
    { signal, lookupSignal, startIndex: nextIndex },
    getLinesForConnection,
    maxLayer,
    maxStackSize,
    skipDirect,
    skipConnections,
  );
  lines.push(...prevResult.lines);
  nextIndex = prevResult.nextIndex;

  return { lines, nextIndex };
};
