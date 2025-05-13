import { readLocalStorageValue } from "@mantine/hooks";
import { HubConnection, HubConnectionBuilder } from "@microsoft/signalr";
import { MessagePackHubProtocol } from "@microsoft/signalr-protocol-msgpack";
import isEqual from "lodash/isEqual";
import omit from "lodash/omit";
import { LRUCache } from "lru-cache";
import { BehaviorSubject, debounceTime, distinctUntilChanged, map, Observable, withLatestFrom } from "rxjs";

import UnplayableStations from "../assets/unplayable-stations.json";
import {
  PartialStation,
  PartialTrainData,
  ServerStatus,
  SignalStatus,
  SignalStatusData,
  SimplifiedTimtableEntry,
  Station,
  TimeData,
  Timetable,
  Train,
} from "../utils/types";
import { IDataProvider } from "./data-provider.interface";

export class SignalRDataProvider implements IDataProvider {
  private readonly serverApiUrl: string;
  private readonly connection: HubConnection;

  private onConnected() {
    this.isConnected$.next(true);
    console.log("Connected to server as", this.connection.connectionId);
    const selectedServer = readLocalStorageValue({ key: "selectedServer" }) || this.defaultServer;
    this.connection.send("SwitchServer", selectedServer);
  }

  private connectToSignalR() {
    this.connection
      .start()
      .then(this.onConnected.bind(this))
      .catch((e) => {
        console.error("Failed to connect to server", e);
        setTimeout(this.connectToSignalR.bind(this), 5000);
      });
  }

  constructor(
    serverUrl: string,
    private readonly defaultServer: string = "int1",
  ) {
    const _serverUrl = new URL(serverUrl);

    const signalRServerUrl = new URL(serverUrl);
    signalRServerUrl.pathname = "/signalr";

    this.serverApiUrl = _serverUrl.protocol + "//" + _serverUrl.host;
    console.debug("Server API URL", this.serverApiUrl);

    this.connection = new HubConnectionBuilder()
      .withUrl(signalRServerUrl.toString())
      .withHubProtocol(new MessagePackHubProtocol())
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds(retryContext) {
          return Math.min(1000, retryContext.previousRetryCount * 2000);
        },
      })
      .build();

    this.connection.onreconnected(this.onConnected.bind(this));

    this.connection.onreconnecting((e) => {
      this.isConnected$.next(false);
      console.warn("Reconnecting to server...", e);
    });

    this.connection.onclose((e) => {
      this.isConnected$.next(false);
      console.warn("Disconnected from server!", e);
    });

    this.connection.on("ServerSwitched", (serverCode: string) => {
      console.log("Switched to server", serverCode);
    });

    this.connection.on("ServersReceived", (servers: ServerStatus[]) => this.serverData$.next(servers));

    this.unplayableStations$
      .pipe(debounceTime(5000), withLatestFrom(this.stationsData$))
      .subscribe(([unplayableStations, stations]) => {
        const allStations = [...unplayableStations, ...stations].toSorted((a, b) => a.Name.localeCompare(b.Name));

        console.log(
          "Stations: %c" + allStations.map((s) => s.Name.trim()).join("%c, %c") + "%c",
          ...allStations.flatMap((s) => [
            "color:" + (unplayableStations.some((x) => x.Name === s.Name) ? "#F00" : "#0F0"),
            "color:inherit",
          ]),
        );
      });

    this.stationsData$
      .pipe(
        distinctUntilChanged((prev, curr) =>
          isEqual(
            prev.map((s) => s.Name),
            curr.map((s) => s.Name),
          ),
        ),
      )
      .subscribe((stations) => {
        this.unplayableStations$.next(
          UnplayableStations.filter((station) => !stations.some((s) => s.Name === station.Name)),
        );
      });

    this.connection.on("StationsReceived", (stations: Station[]) => this.stationsData$.next(stations));

    this.connection.on("PartialStationsReceived", (partialStations: PartialStation[]) => {
      const currentStations = this.stationsData$.value;

      if (!currentStations.length) {
        console.warn("No stations received yet, requesting full list");
        this.connection.send("GetStations");
        return;
      }

      for (const partialStation of partialStations) {
        const station = currentStations.find((s) => s.Id === partialStation.Id);
        if (station) {
          Object.assign(station, omit(partialStation, "Id"));
        } else {
          this.connection.send("GetStations");
          return;
        }
      }

      this.stationsData$.next(currentStations);
    });

    this.connection.on("TrainsReceived", (trains: Train[]) => this.trainsData$.next(trains));
    this.connection.on("PartialTrainsReceived", (partialTrains: PartialTrainData[]) => {
      const currentTrains = this.trainsData$.value;

      if (!currentTrains.length) {
        console.warn("No trains received yet, requesting full list");
        this.connection.send("GetTrains");
        return;
      }

      const updatedTrains = currentTrains.map((train) => {
        const partialTrain = partialTrains.find((t) => t.Id === train.Id);
        if (partialTrain) {
          train = {
            ...train,
            Type: partialTrain.Type,
            TrainData: {
              ...train.TrainData,
              ...omit(partialTrain, "Id", "Type"),
            },
          };
        }
        return train;
      });

      this.trainsData$.next(updatedTrains);
    });
    this.connection.on(
      "TrainPositionsReceived",
      (trainPositions: { Id: string; Latitude: number; Longitude: number; Velocity: number }[]) => {
        const currentTrains = this.trainsData$.value;

        if (!currentTrains.length) {
          return;
        }

        const updatedTrains = currentTrains.map((train) => {
          const trainPosition = trainPositions.find((t) => t.Id === train.Id);
          if (trainPosition) {
            train.TrainData.Latitude = trainPosition.Latitude;
            train.TrainData.Longitude = trainPosition.Longitude;
            train.TrainData.Velocity = trainPosition.Velocity;
          }
          return train;
        });

        this.trainsData$.next(updatedTrains);
      },
    );

    this.connection.on("SignalsReceived", (signals: SignalStatus[]) => this.signalsData$.next(signals));
    this.connection.on("PartialSignalsReceived", (partialSignals: SignalStatusData[]) => {
      const currentSignals = this.signalsData$.value;

      if (!currentSignals.length) {
        console.warn("No signals received yet, requesting full list");
        this.connection.send("GetSignals");
        return;
      }

      const updatedSignals = currentSignals.map((signal) => {
        const partialSignal = partialSignals.find((s) => s.Name === signal.Name);
        if (partialSignal) {
          return { ...signal, ...partialSignal };
        }
        return signal;
      });

      this.signalsData$.next(updatedSignals);
    });

    this.connection.on("DelaysReceived", (data: Record<string, Record<number, number>>) => {
      const trainDelays = new Map<string, Record<number, number>>(Object.entries(data));

      this.trainDelays$.next(trainDelays);
    });

    this.connection.on("TimeReceived", (timeData: TimeData) => this.timeData$.next(timeData));

    this.connectToSignalR();
  }

  isConnected$ = new BehaviorSubject(false);

  selectServer(serverCode: string): void {
    this.stationsData$.next([]);
    this.unplayableStations$.next([]);
    this.trainsData$.next([]);
    this.signalsData$.next([]);
    this.trainDelays$.next(new Map());
    this.timeData$.next(null);
    this.connection.send("SwitchServer", serverCode);
  }

  serverData$ = new BehaviorSubject<ServerStatus[]>([]);

  stationsData$ = new BehaviorSubject<Station[]>([]);
  unplayableStations$ = new BehaviorSubject<Station[]>([]);

  trainsData$ = new BehaviorSubject<Train[]>([]);
  signalsData$ = new BehaviorSubject<SignalStatus[]>([]);
  trainDelays$ = new BehaviorSubject<Map<string, Record<number, number>>>(new Map());

  getDelaysForTrainId$(trainId: string): Observable<Record<number, number>> {
    return this.trainDelays$.pipe(map((delays) => delays.get(trainId) || {}));
  }

  getDelaysForTrainSync(trainId: string): Record<number, number> | null {
    return this.trainDelays$.value.get(trainId) || null;
  }

  timeData$ = new BehaviorSubject<TimeData | null>(null);

  private readonly timetableCache = new LRUCache<string, Timetable>({ max: 10, ttl: 1000 * 60 * 60 }); // 1 hour
  private readonly timetablePromiseCache = new LRUCache<string, Promise<Timetable | null>>({
    max: 10,
    ttl: 1000 * 60 * 60, // 1 hour
  });

  async fetchTimetable(trainNoLocal: string): Promise<Timetable | null> {
    const cached = this.timetableCache.get(trainNoLocal);

    if (cached) {
      console.log("Got cached timetable for train", trainNoLocal);
      return cached;
    }

    const cachedPromise = this.timetablePromiseCache.get(trainNoLocal);

    if (cachedPromise) {
      console.log("Got cached timetable promise for train", trainNoLocal);
      return cachedPromise;
    }

    const promise = new Promise<Timetable | null>((resolve) => {
      this.connection.invoke("GetTimetable", trainNoLocal).then((timetable) => {
        if (timetable) {
          console.log("Got timetable for train", trainNoLocal);
          this.timetableCache.set(trainNoLocal, timetable);
          resolve(timetable);
        } else {
          console.warn("Failed to fetch timetable for train", trainNoLocal);
          resolve(null);
        }
      });

      setTimeout(() => {
        console.warn("Timetable fetch timed out for train", trainNoLocal);
        resolve(null);
      }, 30000); // 30 seconds timeout
    });

    promise.finally(() => {
      this.timetablePromiseCache.delete(trainNoLocal);
    });

    this.timetablePromiseCache.set(trainNoLocal, promise);

    return promise;
  }

  async fetchRoutePoints(trainNoLocal: string): Promise<string[] | null> {
    return new Promise<string[] | null>((resolve) => {
      this.connection.invoke("GetTrainRoutePoints", trainNoLocal).then((route: string[]) => {
        console.log("Got route lines", trainNoLocal, route.length);
        resolve(route);
      });
    });
  }

  deletePrevSignal(signal: string, prevSignal: string): void {
    fetch(`${this.serverApiUrl}/signals/${encodeURIComponent(signal)}/prev/${prevSignal}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: localStorage.getItem("adminPassword") }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          console.log(`Deleted signal connection ${prevSignal}->${signal}`);
          this.signalsData$.next(
            this.signalsData$.value.map((s) => {
              if (s.Name === signal) {
                return {
                  ...s,
                  PrevSignals: s.PrevSignals.filter((s) => s.Name !== prevSignal),
                };
              } else if (s.Name === prevSignal) {
                return {
                  ...s,
                  NextSignals: s.NextSignals.filter((s) => s.Name !== signal),
                };
              }
              return s;
            }),
          );
        } else {
          console.error(`Failed to delete signal connection ${prevSignal}->${signal}`, data.error);
        }
      })
      .catch((e) => {
        console.error(`Failed to delete signal connection ${prevSignal}->${signal}`, e);
      });
  }

  deleteNextSignal(signal: string, nextSignal: string): void {
    fetch(`${this.serverApiUrl}/signals/${encodeURIComponent(signal)}/next/${nextSignal}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: localStorage.getItem("adminPassword") }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          console.log(`Deleted signal connection ${signal}->${nextSignal}`);
          this.signalsData$.next(
            this.signalsData$.value.map((s) => {
              if (s.Name === signal) {
                return {
                  ...s,
                  NextSignals: s.NextSignals.filter((s) => s.Name !== nextSignal),
                };
              } else if (s.Name === nextSignal) {
                return {
                  ...s,
                  PrevSignals: s.PrevSignals.filter((s) => s.Name !== signal),
                };
              }
              return s;
            }),
          );
        } else {
          console.error(`Failed to delete signal connection ${signal}->${nextSignal}`, data.error);
        }
      })
      .catch((e) => {
        console.error(`Failed to delete signal connection ${signal}->${nextSignal}`, e);
      });
  }

  markSignalNextFinalized(signal: string, finalized: boolean): void {
    fetch(`${this.serverApiUrl}/signals/${encodeURIComponent(signal)}/next/${finalized ? "finalize" : "reset"}`, {
      method: "Post",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: localStorage.getItem("adminPassword") }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          console.log(`Marked signal ${signal} next finalized`);
        } else {
          console.error(`Failed to mark signal ${signal} next finalized`, data.error);
        }
      })
      .catch((e) => {
        console.error(`Failed to mark signal ${signal} next finalized`, e);
      });
  }

  markSignalPrevFinalized(signal: string, finalized: boolean): void {
    fetch(`${this.serverApiUrl}/signals/${encodeURIComponent(signal)}/prev/${finalized ? "finalize" : "reset"}`, {
      method: "Post",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: localStorage.getItem("adminPassword") }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          console.log(`Marked signal ${signal} prev finalized`);
        } else {
          console.error(`Failed to mark signal ${signal} prev finalized`, data.error);
        }
      })
      .catch((e) => {
        console.error(`Failed to mark signal ${signal} prev finalized`, e);
      });
  }

  deleteSignal(signal: string): void {
    fetch(`${this.serverApiUrl}/signals/${encodeURIComponent(signal)}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: localStorage.getItem("adminPassword") }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          console.log(`Deleted signal ${signal}`);
          this.signalsData$.next(this.signalsData$.value.filter((s) => s.Name !== signal));
        } else {
          console.error(`Failed to delete signal ${signal}`, data.error);
        }
      })
      .catch((e) => {
        console.error(`Failed to delete signal ${signal}`, e);
      });
  }

  async getStationTimetable(stationName: string): Promise<SimplifiedTimtableEntry[] | null> {
    const selectedServer = readLocalStorageValue<string>({ key: "selectedServer" }) || this.defaultServer;

    try {
      const res = await fetch(
        `${this.serverApiUrl}/status/${encodeURIComponent(selectedServer)}/stations/${encodeURIComponent(stationName)}/timetable`,
      );

      if (res.status === 404) {
        console.warn(`Station ${stationName} not found on server ${selectedServer}`);
        return null;
      }

      if (!res.ok) {
        console.error(`Failed to fetch timetable for station ${stationName}`, res.statusText);
        return null;
      }

      return res.json() as Promise<SimplifiedTimtableEntry[] | null>;
    } catch (e) {
      console.error(`Failed to get timetable for station ${stationName}`, e);
      return null;
    }
  }
}
