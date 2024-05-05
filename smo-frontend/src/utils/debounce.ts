/* eslint-disable @typescript-eslint/no-explicit-any */
export function debounce<T extends (...args: any[]) => unknown>(fn: T, delay: number): T {
  let timeout: number;
  return function (this: any, ...args: Parameters<T>) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), delay);
  } as T;
}
