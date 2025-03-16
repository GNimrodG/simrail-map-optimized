import { Train } from "../api-helper";
import { prisma } from "../db";
import { ModuleLogger } from "../logger";

const logger = new ModuleLogger("SIGNALS-PROC-WORKER");

/**
 * Regular expression to match the block signal pattern.
 * The pattern is a word character followed by one or more digits, an underscore, one or more digits, and optionally one or more uppercase letters.
 * @example
 * "L1_1A" matches the pattern.
 * "L23_456B" matches the pattern.
 */
export const BLOCK_SIGNAL_REGEX = /^L\d+_\d+[A-Z]*$/;

/**
 * Regular expression to match the reverse block signal pattern.
 * The pattern is a word character followed by one or more digits, an underscore, one or more digits, and an uppercase letter.
 * @example
 * "L1_1A" matches the pattern.
 * "L23_456B" matches the pattern.
 */
export const BLOCK_SIGNAL_REVERSE_REGEX = /^L\d+_\d+[A-Z]$/;

/**
 * Regular expression to match the main signal pattern.
 * The pattern is one or more word characters followed by an underscore and one or more word characters or digits.
 * The first word character can be any uppercase or lowercase letter except "L" since it is reserved for block signals.
 * @example
 * "ZW_D" matches the pattern.
 * "ZW_1" matches the pattern.
 */
export const MAIN_SIGNAL_REGEX =
  /[A-KM-Za-zżźćńółęąśŻŹĆĄŚĘŁÓŃ][A-Za-zżźćńółęąśŻŹĆĄŚĘŁÓŃ]+\d*_[A-Za-zżźćńółęąśŻŹĆĄŚĘŁÓŃ0-9]+/;

/**
 * Function to determine the type of signal for a given train.
 *
 * @param {Train} train - The train object for which the signal type is to be determined.
 *
 * @returns - Returns "main" if the train's SignalInFrontSpeed is either 60 or 100.
 *          - Returns "block" if the train's SignalInFront matches the BLOCK_SIGNAL_REGEX pattern.
 *          - Returns null if neither of the above conditions are met.
 */
export function getSignalType(train: Train) {
  if (train.TrainData.SignalInFrontSpeed === 60 || train.TrainData.SignalInFrontSpeed === 100) {
    return "main";
  }

  if (MAIN_SIGNAL_REGEX.test(train.TrainData.SignalInFront.split("@")[0])) {
    return "main";
  }

  if (BLOCK_SIGNAL_REGEX.test(train.TrainData.SignalInFront.split("@")[0])) {
    return "block";
  }

  return null;
}

/**
 * Function to determine the role of a signal based on its connections.
 *
 * @param signal - The signal object which contains information about its connections.
 * @param signal.nextSignalConnections - An array of objects, each containing a 'prev' property that represents the previous signal connection.
 * @param signal.prevSignalConnections - An array of objects, each containing a 'next' property that represents the next signal connection.
 *
 * @returns The role of the signal based on its connections and/or name.
 */
export function getSignalRole(signal: {
  name: string;
  nextSignalConnections: { prev: string }[];
  prevSignalConnections: { next: string }[];
}) {
  if (BLOCK_SIGNAL_REGEX.test(signal.name)) {
    const isEntry =
      signal.nextSignalConnections.length > 1 ||
      (signal.nextSignalConnections.length === 1 &&
        !BLOCK_SIGNAL_REGEX.test(signal.nextSignalConnections[0].prev));

    const isExit =
      signal.prevSignalConnections.length > 1 ||
      (signal.prevSignalConnections.length === 1 &&
        !BLOCK_SIGNAL_REGEX.test(signal.prevSignalConnections[0].next));

    if (isEntry && isExit) {
      return "entry-exit";
    }

    if (isEntry) {
      return "entry";
    }

    if (isExit) {
      return "exit";
    }

    return null;
  }

  const everyPrevIsBlock = signal.nextSignalConnections.every((conn) =>
    BLOCK_SIGNAL_REGEX.test(conn.prev)
  );
  const everyNextIsBlock = signal.prevSignalConnections.every((conn) =>
    BLOCK_SIGNAL_REGEX.test(conn.next)
  );

  if (everyNextIsBlock && everyPrevIsBlock) {
    return "entry-exit";
  }

  if (everyNextIsBlock) {
    return "exit";
  }

  if (everyPrevIsBlock) {
    return "entry";
  }

  return null;
}

/**
 * Function to log errors related to signal connections.
 *
 * @param {string} prev - The previous signal in the connection.
 * @param {string} next - The next signal in the connection.
 * @param {string} error - The error message to be logged.
 * @param {string} trainId - The ID of the train that encountered the error.
 *
 * The function first checks if the error already exists in the database by searching for a unique entry with the same 'prev', 'next', and 'error'.
 * If the error does not exist, it logs a warning with the error message and creates a new entry in the 'signal_connection_errors' table with the 'prev', 'next', and 'error'.
 * If the length of the error message exceeds 500 characters, it is truncated to the first 500 characters.
 * If an error occurs during this process, it logs an error message.
 */
export function tryLogError(prev: string, next: string, error: string, trainId: string) {
  prisma.signalConnectionErrors
    .findUnique({
      where: { prev_next_error: { prev, next, error } },
    })
    .then((prevError) => {
      if (!prevError) {
        logger.warn(error);
        return prisma.signalConnectionErrors.create({
          data: {
            prev,
            next,
            error: error.length > 500 ? error.substring(0, 500) : error,
            creator: trainId,
          },
        });
      }
    })
    .catch((e) => {
      logger.error(`Failed to log error: ${e}`);
    });
}
