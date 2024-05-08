import { ServerStatus, fetchServersOpen } from "../api-helper";
import { Fetcher } from "./fetcher";

class ServerFetcher extends Fetcher<ServerStatus[]> {
  constructor() {
    super("SERVER", 30000);
  }

  protected fetchData = fetchServersOpen;
}

export const serverFetcher = new ServerFetcher();
