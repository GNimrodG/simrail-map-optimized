import { PerServerFetcher } from "./fetcher";
import { serverFetcher } from "./sever-fetcher";

export interface TimeData {
  time: number;
  timezone: number;
  lastUpdated: number;
}

class TimeFetcher extends PerServerFetcher<TimeData> {
  constructor() {
    super("TIME", 300000, serverFetcher);
  }
}

export const timeFetcher = new TimeFetcher();
