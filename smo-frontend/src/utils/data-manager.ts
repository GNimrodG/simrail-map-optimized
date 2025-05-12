import { SignalRDataProvider } from "../data/signalr-data-provider";

const RAW_SERVER_URL =
  new URLSearchParams(location.search).get("server") ||
  (import.meta.env.PROD ? "https://api.smo.data-unknown.com" : "http://localhost:3000");

export const dataProvider = new SignalRDataProvider(RAW_SERVER_URL);
