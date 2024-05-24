import { fetchTrains } from "../../api-helper";
import { registerPerServerWorkerFunction } from "./utils";

registerPerServerWorkerFunction(__filename, fetchTrains);
