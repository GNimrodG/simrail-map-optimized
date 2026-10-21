import isEqual from "lodash/isEqual";
import { BehaviorSubject, distinctUntilChanged, map } from "rxjs";

import { dataProvider } from "./data-manager";
import { SignalStatus } from "./types";

/**
 * The boards on the last automatic block signals before a station
 * (https://wiki.simrail.eu/en/Tips_and_Tricks/Signal_Systems/Poland): the last one has a W18 board, the one before it a
 * W1 (it warns about the station's entry signal like a distant signal).
 */
export type BlockSignalBoard = "W1" | "W18";

/**
 * The boards of the block signals, from the connections learned from the trains: a block signal followed by a main
 * signal is the last one; known only where trains have driven past.
 */
export function getBlockSignalBoards(signals: SignalStatus[]): Map<string, BlockSignalBoard> {
  const types = new Map(signals.map((signal) => [signal.Name, signal.Type]));
  const blockSignals = signals.filter((signal) => signal.Type === "block");
  const boards = new Map<string, BlockSignalBoard>();

  for (const signal of blockSignals) {
    if (signal.NextSignals?.some((next) => types.get(next.Name) === "main")) {
      boards.set(signal.Name, "W18");
    }
  }

  for (const signal of blockSignals) {
    if (!boards.has(signal.Name) && signal.NextSignals?.some((next) => boards.get(next.Name) === "W18")) {
      boards.set(signal.Name, "W1");
    }
  }

  return boards;
}

export const blockSignalBoards$ = new BehaviorSubject<Map<string, BlockSignalBoard>>(new Map());

dataProvider.signalsData$
  .pipe(map(getBlockSignalBoards), distinctUntilChanged(isEqual))
  .subscribe((boards) => blockSignalBoards$.next(boards));
