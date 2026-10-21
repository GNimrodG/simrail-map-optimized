import { SignalStatus, Train } from "./types";

/**
 * Signals that show what the main signal ahead of them shows, they're never reported by trains (they come from the
 * game files), so their aspect comes from their main signal:
 * - "repeater" (sygnalizator powtarzający, "DS_ISpW", "DS_IISpW") repeats "DS_W"
 * - "distant" (tarcza ostrzegawcza, "W1_ToA") warns about "W1_A", about a kilometre ahead
 */
export type DependentSignalType = "repeater" | "distant";

// The same rules as the backend's Signal.REPEATER_SIGNAL_REGEX and DISTANT_SIGNAL_REGEX, groups 1 + 2 are the main
// signal's name.
const MAIN_SIGNAL_NAME: Record<DependentSignalType, RegExp> = {
  repeater: /^(.+_)(?:I{1,3}|Y)?Sp([A-Z][A-Za-z0-9]*)$/,
  distant: /^(.+_)To([A-Z][A-Za-z0-9]*)$/,
};

/** The main signal a dependent signal belongs to, null when the name isn't that type's. */
export function getMainSignalName(name: string, type: DependentSignalType): string | null {
  const match = MAIN_SIGNAL_NAME[type].exec(name);
  return match ? match[1] + match[2] : null;
}

// Naming slips in the game files: dependent signals whose main signal is named differently (checked on the map: each
// main signal is ahead of its dependent signal, at the usual distance). Slips in the letter case ("Ga_ToC" for "GA_C")
// are handled by findMainSignal. Left without a main signal: "Ssc_ISpA" (on an abandoned track) and the signals of the
// unreleased Dęblin - Chełm line.
const MAIN_SIGNAL_ALIASES: Record<string, string> = {
  "1998_K0_ISpF": "1998_Ko_F", // a zero for the letter O
  "2020_KPm_ISpR11": "1952_KG_R11",
  "2020_KPm_ISpR12": "1952_KG_R12",
  "2432_LW_ToE32": "2432_LK_E32",
  "2432_LW_ToJ32": "2432_LK_J32",
  "Mk_ToW": "2628_Mi_W",
  // Kraków Bieżanów: the main signals' numbers are missing
  "1937_BT_SpN": "1937_BT_N2",
  "1937_BT_SpP": "1937_BT_P2",
  "1937_BT_SpR": "1937_BT_R1",
  "1937_BT_ToA": "1937_BT_A2",
};

export interface SignalLookup {
  byName: Map<string, SignalStatus>;
  byLowerCaseName: Map<string, SignalStatus>;
}

export function createSignalLookup(signals: SignalStatus[]): SignalLookup {
  return {
    byName: new Map(signals.map((signal) => [signal.Name, signal])),
    byLowerCaseName: new Map(signals.map((signal) => [signal.Name.toLowerCase(), signal])),
  };
}

/** The main signal of a dependent signal, undefined when it isn't known. */
export function findMainSignal(
  name: string,
  type: DependentSignalType,
  lookup: SignalLookup,
): SignalStatus | undefined {
  const mainName = MAIN_SIGNAL_ALIASES[name] ?? getMainSignalName(name, type);
  if (!mainName) {
    return undefined;
  }
  return lookup.byName.get(mainName) ?? lookup.byLowerCaseName.get(mainName.toLowerCase());
}

/**
 * Which repeater it is counted from the main signal: 1 the last one ("DS_ISpW"), 2 the second last ("DS_IISpW"), 3 the
 * third last; its plate has as many bars. Null without a numeral.
 */
export function getRepeaterPosition(name: string): 1 | 2 | 3 | null {
  const numeral = /_(I{1,3})Sp[A-Z]/.exec(name)?.[1];
  return numeral ? (numeral.length as 1 | 2 | 3) : null;
}

/**
 * The aspect of a dependent signal (https://wiki.simrail.eu/en/Tips_and_Tricks/Signal_Systems/Poland), from the speed
 * at its main signal: 1 stop, 2 Vmax, 3 100 km/h, 4 40 or 60 km/h (Sp1-Sp4 for repeaters, Os1-Os4 for distant
 * signals); 0 when the main signal's aspect isn't known (no train is approaching it or has passed it).
 */
export type MainSignalAspect = 0 | 1 | 2 | 3 | 4;

export function getMainSignalAspect(
  mainSignal: SignalStatus | undefined,
  trains: Map<string, Train>,
): MainSignalAspect {
  if (!mainSignal) {
    return 0;
  }

  const approaching = mainSignal.Trains?.map((trainNo) => trains.get(trainNo)).find((train) => !!train);
  if (approaching) {
    const speed = approaching.TrainData.SignalInFrontSpeed;
    if (speed === 0) return 1;
    if (speed > 200) return 2; // Vmax
    return speed >= 100 ? 3 : 4;
  }

  // a train past the main signal: it shows stop behind it, like SignalMarker shows it
  if (mainSignal.TrainsAhead?.length) {
    return 1;
  }

  return 0;
}
