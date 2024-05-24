import { Train } from "../api-helper";
import { PerServerFetcher } from "./fetcher";
import { serverFetcher } from "./sever-fetcher";

const REFRESH_INTERVAL =
  (process.env.TRAIN_REFRESH_INTERVAL && parseInt(process.env.TRAIN_REFRESH_INTERVAL) * 1000) ||
  1000; // default 1 second

class TrainFetcher extends PerServerFetcher<Train[]> {
  constructor() {
    super("TRAIN", REFRESH_INTERVAL, serverFetcher);
  }
}

export const trainFetcher = new TrainFetcher();
