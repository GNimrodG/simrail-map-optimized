import { fetchTime, fetchTimezone } from "../api-helper";
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

  protected async fetchDataForServer(serverCode: string): Promise<TimeData> {
    const time = await fetchTime(serverCode);
    const timezone = await fetchTimezone(serverCode);

    return { time, timezone, lastUpdated: Date.now() };
  }
}

export const timeFetcher = new TimeFetcher();
