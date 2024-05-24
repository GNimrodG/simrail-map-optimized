import { fetchServersOpen } from "../../api-helper";
import { registerWorkerFunction } from "./utils";

registerWorkerFunction(__filename, fetchServersOpen);
