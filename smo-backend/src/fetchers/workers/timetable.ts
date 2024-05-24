import { fetchTimetable } from "../../api-helper";
import { registerPerServerWorkerFunction } from "./utils";

registerPerServerWorkerFunction(__filename, fetchTimetable);
