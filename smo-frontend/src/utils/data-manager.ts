import { readLocalStorageValue } from "@mantine/hooks";
import { BehaviorSubject } from "rxjs";

import { SignalRDataProvider } from "../data/signalr-data-provider";

const RAW_SERVER_URL =
  new URLSearchParams(location.search).get("server") ||
  (import.meta.env.PROD ? "https://api.smo.data-unknown.com" : "http://localhost:3000");

const DEFAULT_SERVER = "int1";

export const dataProvider = new SignalRDataProvider(RAW_SERVER_URL, DEFAULT_SERVER);

dataProvider.serverData$.subscribe((servers) => {
  if (servers.length > 0) {
    const selectedServer = readLocalStorageValue<string>({ key: "selectedServer" }) || DEFAULT_SERVER;

    const server = servers.find((s) => s.ServerCode === selectedServer);
    if (!server) {
      if (selectedServer === DEFAULT_SERVER) {
        console.warn(`Default server "${DEFAULT_SERVER}" not found, using first available server.`);
        localStorage.setItem("selectedServer", servers[0].ServerCode);
        dataProvider.selectServer(servers[0].ServerCode);
      } else if (servers.some((s) => s.ServerCode === DEFAULT_SERVER)) {
        console.warn(`Selected server "${selectedServer}" not found, using default server "${DEFAULT_SERVER}".`);
        localStorage.setItem("selectedServer", DEFAULT_SERVER);
        dataProvider.selectServer(DEFAULT_SERVER);
      } else {
        console.warn(
          `Default server "${DEFAULT_SERVER}" not found, using first available server "${servers[0].ServerCode}".`,
        );
        localStorage.setItem("selectedServer", servers[0].ServerCode);
        dataProvider.selectServer(servers[0].ServerCode);
      }
    }
  }
});

export const isSentryLoaded$ = new BehaviorSubject<boolean>(false);
