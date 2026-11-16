// Small string helpers in place of regular expressions like /.+\/(.+)$/, whose overlapping quantifiers can backtrack.

/** The text after the last `separator`, when there is text on both sides of it; else the whole text (/.+X(.+)$/) */
export function afterLast(text: string, separator: string): string {
  const index = text.lastIndexOf(separator);
  return index > 0 && index < text.length - separator.length ? text.slice(index + separator.length) : text;
}

/** The text after the first `separator`, when there is any; else undefined (/X(.+)$/) */
export function afterFirst(text: string, separator: string): string | undefined {
  const index = text.indexOf(separator);
  return index >= 0 && index < text.length - separator.length ? text.slice(index + separator.length) : undefined;
}

/** The text before the first `separator` that has text on both sides; else the whole text (/(.+?)(X.+)?$/) */
export function beforeFirst(text: string, separator: string): string {
  const index = text.indexOf(separator, 1);
  return index > 0 && index < text.length - separator.length ? text.slice(0, index) : text;
}

/**
 * A name split into its text and its trailing number ("Kr_K12" → ["Kr_K", 12]), when it ends with digits after at
 * least two characters, the last of them not a digit; else null (/(.+?\D+)(\d+)$/).
 */
export function splitTrailingNumber(text: string): [string, number] | null {
  let start = text.length;
  while (start > 0 && text[start - 1] >= "0" && text[start - 1] <= "9") start--;
  if (start === text.length || start < 2) return null;
  return [text.slice(0, start), Number.parseInt(text.slice(start), 10)];
}
