import { Station, fetchStations } from "../api-helper";
import { PerServerFetcher } from "./fetcher";
import { serverFetcher } from "./sever-fetcher";

class StationFetcher extends PerServerFetcher<Station[]> {
  constructor() {
    super("STATION", 5000, serverFetcher);
  }

  protected fetchDataForServer = fetchStations;
}

export const stationFetcher = new StationFetcher();
