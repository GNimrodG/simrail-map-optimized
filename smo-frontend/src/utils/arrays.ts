/** Whether two arrays hold the same items (by reference) in the same order: a cheap change check for lists whose
 * unchanged items keep their objects (the data provider keeps the signals that a partial update doesn't change). */
export function isSameItems<T>(a: readonly T[], b: readonly T[]): boolean {
  return a === b || (a.length === b.length && a.every((item, i) => item === b[i]));
}
