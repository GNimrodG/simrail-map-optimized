import { Timetable } from "../api-helper";
import { PerServerFetcher } from "./fetcher";
import { serverFetcher } from "./sever-fetcher";

class TimetableFetcher extends PerServerFetcher<Record<string, Timetable>> {
  constructor() {
    super("TIMETABLE", 1800000, serverFetcher);
  }

  public getTimeTableForTrain(server: string, trainNoLocal: string) {
    return this.data.value?.has(server) ? this.data.value.get(server)![trainNoLocal] : null;
  }
}

export const timetableFetcher = new TimetableFetcher();
