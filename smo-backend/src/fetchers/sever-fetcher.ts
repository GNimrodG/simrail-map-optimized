import { ServerStatus } from "../api-helper";
import { Fetcher } from "./fetcher";

class ServerFetcher extends Fetcher<ServerStatus[]> {
  constructor() {
    super("SERVER", 30000);
  }
}

export const serverFetcher = new ServerFetcher();
