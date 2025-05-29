import debounce from "lodash/debounce";

export function getDebouncedFetcher<T, K = string>(
  fetchFunction: (keys: K[]) => Promise<Map<K, T>>,
  debounceDuration: number,
) {
  const queue: Map<
    K,
    { resolve: (value: T | null) => void; reject: (reason?: unknown) => void; promise: Promise<T | null> }
  > = new Map();

  const debouncedFetch = debounce(async () => {
    const keys = Array.from(queue.keys());
    if (keys.length === 0) return;

    const currentQueue = new Map(queue);
    queue.clear(); // Clear the queue

    try {
      const results = await fetchFunction(keys);

      keys.forEach((key) => {
        const itemData = currentQueue.get(key);
        if (itemData) {
          itemData.resolve(results.get(key) || null);
        }
      });
    } catch (error) {
      console.error("Error fetching data:", error);
      keys.forEach((key) => {
        const itemData = currentQueue.get(key);
        if (itemData) {
          itemData.reject(error);
        }
      });
    }
  }, debounceDuration);

  return (key: K) => {
    if (queue.has(key)) {
      // If the key is already in the queue, return its promise
      return queue.get(key)!.promise;
    }

    const { resolve, reject, promise } = Promise.withResolvers<T | null>();
    queue.set(key, { resolve, reject, promise });

    debouncedFetch();
  };
}
