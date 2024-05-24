import { Station } from "../api-helper";
import { PerServerFetcher } from "./fetcher";
import { serverFetcher } from "./sever-fetcher";

class StationFetcher extends PerServerFetcher<Station[]> {
  constructor() {
    super("STATION", 5000, serverFetcher);
  }
}

export const stationFetcher = new StationFetcher();
