import { PerServerFetcher } from "./fetcher";
import { serverFetcher } from "./sever-fetcher";

export interface TimeData {
  time: number;
  timezone: number;
  lastUpdated: number;
}

// The TIME API is rate limited to 10 requests/second/IP address.
// Just to be safe, we'll limit it to ~4 requests/second.

class TimeFetcher extends PerServerFetcher<TimeData> {
  constructor() {
    super("TIME", 300000, serverFetcher, 250);
  }
}

export const timeFetcher = new TimeFetcher();
