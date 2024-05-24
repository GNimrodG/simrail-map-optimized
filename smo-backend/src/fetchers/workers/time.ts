import { fetchTime, fetchTimezone } from "../../api-helper";
import { registerPerServerWorkerFunction } from "./utils";

registerPerServerWorkerFunction(__filename, async (server) => {
  const time = await fetchTime(server);
  const timezone = await fetchTimezone(server);

  return { time, timezone, lastUpdated: Date.now() };
});
