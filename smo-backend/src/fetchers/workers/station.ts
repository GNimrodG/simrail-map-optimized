import { fetchStations } from "../../api-helper";
import { registerPerServerWorkerFunction } from "./utils";

registerPerServerWorkerFunction(__filename, fetchStations);
