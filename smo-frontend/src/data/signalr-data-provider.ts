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
  UserProfileResponse,
  SteamProfileStats,
  TimeData,
  Timetable,
  Train,
} from "../utils/types";
import { IDataProvider } from "./data-provider.interface";

export class SignalRDataProvider implements IDataProvider {
  private readonly serverApiUrl: string;
  private readonly connection: HubConnection;

  getSelectedServer(): string {
    return readLocalStorageValue({ key: "selectedServer" }) || this.defaultServer;
  }

  private onConnected() {
    this.isConnected$.next(true);
    console.log("Connected to server as", this.connection.connectionId);
    this.connection.send("SwitchServer", this.getSelectedServer());
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

    this.serverData$.subscribe((servers) => {
      const selectedServerCode = this.getSelectedServer();
      this.selectedServerData$.next(servers.find((s) => s.ServerCode === selectedServerCode) || null);
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

    this.connection.on("StationsReceived", (stations: Station[]) =>
      this.stationsData$.next(
        stations.map((station) => {
          const unplayableStation = this.unplayableStations$.value.find((s) => s.Name === station.Name);
          if (unplayableStation) {
            return {
              ...station,
              ...unplayableStation,
              SubStations: unplayableStation.SubStations || [],
            };
          }
          return station;
        }),
      ),
    );

    this.connection.on("PartialStationsReceived", (partialStations: PartialStation[]) => {
      const currentStations = this.stationsData$.value;

      if (!currentStations.length) {
        console.warn("No stations received yet, requesting full list");
        this.connection.send("GetStations");
        return;
      }

      if (currentStations.length !== partialStations.length) {
        console.debug("Stations count mismatch", currentStations.length, partialStations.length);
        this.connection.send("GetStations");
        return;
      }

      const partialStationMap = new Map(partialStations.map((station) => [station.Id, station] as const));

      const updatedStations = [] as Station[];

      for (const station of currentStations) {
        const partialStation = partialStationMap.get(station.Id);

        if (!partialStation) {
          console.debug("Station not found in current stations", station.Id);
          this.connection.send("GetStations");
          return;
        }

        updatedStations.push({
          ...station,
          ...omit(partialStation, "Id"),
        });
      }

      this.stationsData$.next(updatedStations);
    });

    this.connection.on("TrainsReceived", (trains: Train[]) => this.trainsData$.next(trains));
    this.connection.on("PartialTrainsReceived", (partialTrains: PartialTrainData[]) => {
      const currentTrains = this.trainsData$.value;

      if (!currentTrains.length) {
        console.warn("No trains received yet, requesting full list");
        this.connection.send("GetTrains");
        return;
      }

      const partialTrainMap = new Map(partialTrains.map((train) => [train.Id, train] as const));

      const updatedTrains = currentTrains.map((train) => {
        const partialTrain = partialTrainMap.get(train.Id);
        if (!partialTrain) {
          return train;
        }

        return {
          ...train,
          Type: partialTrain.Type,
          TrainData: {
            ...train.TrainData,
            ...omit(partialTrain, "Id", "Type"),
          },
        };
      });

      this.trainsData$.next(updatedTrains);

      if (currentTrains.length !== partialTrains.length) {
        console.debug("Train positions count mismatch", currentTrains.length, partialTrains.length);
        this.connection.send("GetTrains");
      }
    });
    this.connection.on(
      "TrainPositionsReceived",
      (trainPositions: { Id: string; Latitude: number; Longitude: number; Velocity: number }[]) => {
        const currentTrains = this.trainsData$.value;

        if (!currentTrains.length) {
          return;
        }

        const positionMap = new Map(trainPositions.map((train) => [train.Id, train] as const));

        let updatedTrains = currentTrains.map((train) => {
          const trainPosition = positionMap.get(train.Id);
          if (!trainPosition) {
            return train;
          }

          return {
            ...train,
            TrainData: {
              ...train.TrainData,
              Latitude: trainPosition.Latitude,
              Longitude: trainPosition.Longitude,
              Velocity: trainPosition.Velocity,
            },
          };
        });

        if (currentTrains.length > trainPositions.length) {
          console.debug(`${currentTrains.length - trainPositions.length} train(s) have despawned`);
          // delete the extra trains that are not in the partialTrains list because they are not in the server anymore
          const activeTrainIds = new Set(positionMap.keys());
          updatedTrains = updatedTrains.filter((train) => activeTrainIds.has(train.Id));
        }

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

      if (currentSignals.length !== partialSignals.length) {
        console.debug("Signals count mismatch", currentSignals.length, partialSignals.length);
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

    this.connection.on("SteamProfileDataUnavailable", () => {
      if (this.steamDataUnavailable) return;
      console.warn("Steam profile data is unavailable");
      this.steamDataUnavailable = true;
    });

    this.connection.on("XboxProfileDataUnavailable", () => {
      if (this.xboxDataUnavailable) return;
      console.warn("Xbox profile data is unavailable");
      this.xboxDataUnavailable = true;
    });

    this.connection.on("SteamProfileDataError", ({ steamId, error }: { steamId: string; error: string }) => {
      console.error(`Failed to fetch steam profile data for ${steamId}:`, error);
      this.profileDataCache.delete(steamId);
    });

    this.connection.on("XboxProfileDataError", ({ xuid, error }: { xuid: string; error: string }) => {
      console.error(`Failed to fetch xbox profile data for ${xuid}:`, error);
      this.profileDataCache.delete(xuid);
    });

    this.connection.on("SteamStatsError", ({ steamId, error }: { steamId: string; error: string }) => {
      console.error(`Failed to fetch steam profile stats for ${steamId}:`, error);
      this.profileStatsCache.delete(steamId);
    });

    this.connectToSignalR();
  }

  private steamDataUnavailable = false;
  private xboxDataUnavailable = false;

  private readonly profileDataCache = new LRUCache<string, Promise<UserProfileResponse | null>>({
    max: 100,
    ttl: 1000 * 60 * 60 * 3, // 3 hours
  });

  getSteamProfileData(steamId: string): Promise<UserProfileResponse | null> {
    if (!steamId) {
      return Promise.resolve(null);
    }

    if (this.steamDataUnavailable) {
      return Promise.resolve({ PersonaName: steamId, Avatar: "" });
    }

    const cacheKey = "steam:" + steamId;

    const cached = this.profileDataCache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const promise = new Promise<UserProfileResponse | null>((resolve) => {
      const timeout = setTimeout(() => {
        console.warn("Steam profile data fetch timed out for", steamId);
        if (this.profileDataCache.has(cacheKey)) {
          resolve(null);
          this.profileDataCache.delete(cacheKey);
        }
      }, 30000); // 30 seconds timeout

      this.connection
        .invoke("GetSteamProfileData", steamId)
        .then((data: UserProfileResponse | null) => {
          clearTimeout(timeout);

          if (data) {
            this.profileDataCache.set(cacheKey, Promise.resolve(data));
            resolve(data);
          } else {
            console.warn("Failed to fetch steam profile data for", steamId);
            resolve(null);
            this.profileDataCache.delete(cacheKey);
          }
        })
        .catch((error) => {
          clearTimeout(timeout);

          console.error("Error fetching steam profile data for", steamId, error);
          resolve(null);
          this.profileDataCache.delete(cacheKey);
        });
    });

    this.profileDataCache.set(cacheKey, promise);

    return promise;
  }

  private readonly profileStatsCache = new LRUCache<string, Promise<SteamProfileStats | null>>({
    max: 100,
    ttl: 1000 * 60 * 10, // 10 minutes
  });

  getSteamProfileStats(steamId: string): Promise<SteamProfileStats | null> {
    if (!steamId || this.steamDataUnavailable) {
      return Promise.resolve(null);
    }

    const cached = this.profileStatsCache.get(steamId);

    if (cached) {
      console.log("Got cached steam profile stats for", steamId);
      return cached;
    }

    const promise = new Promise<SteamProfileStats | null>((resolve) => {
      this.connection
        .invoke("GetSteamProfileStats", steamId)
        .then((data: SteamProfileStats | null) => {
          if (data) {
            console.log("Got steam profile stats for", steamId);
            this.profileStatsCache.set(steamId, Promise.resolve(data));
            resolve(data);
          } else {
            console.warn("Failed to fetch steam profile stats for", steamId);
            resolve(null);
            this.profileStatsCache.delete(steamId);
          }
        })
        .catch((error) => {
          console.error("Error fetching steam profile stats for", steamId, error);
          resolve(null);
          this.profileStatsCache.delete(steamId);
        });

      setTimeout(() => {
        console.warn("Steam profile stats fetch timed out for", steamId);
        if (this.profileStatsCache.has(steamId)) {
          resolve(null);
          this.profileStatsCache.delete(steamId);
        }
      }, 30000); // 30 seconds timeout
    });

    this.profileStatsCache.set(steamId, promise);

    return promise;
  }

  getXboxProfileData(xboxId: string): Promise<UserProfileResponse | null> {
    if (!xboxId) {
      return Promise.resolve(null);
    }

    if (this.xboxDataUnavailable) {
      return Promise.resolve({ PersonaName: xboxId, Avatar: "" });
    }

    const cacheKey = "xbox:" + xboxId;

    const cached = this.profileDataCache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const promise = new Promise<UserProfileResponse | null>((resolve) => {
      const timeout = setTimeout(() => {
        console.warn("Xbox profile data fetch timed out for", xboxId);
        if (this.profileDataCache.has(cacheKey)) {
          resolve(null);
          this.profileDataCache.delete(cacheKey);
        }
      }, 30000); // 30 seconds timeout

      this.connection
        .invoke("GetXboxProfileData", xboxId)
        .then((data: UserProfileResponse | null) => {
          clearTimeout(timeout);

          if (data) {
            this.profileDataCache.set(cacheKey, Promise.resolve(data));
            resolve(data);
          } else {
            console.warn("Failed to fetch xbox profile data for", xboxId);
            resolve(null);
            this.profileDataCache.delete(cacheKey);
          }
        })
        .catch((error) => {
          clearTimeout(timeout);

          console.error("Error fetching xbox profile data for", xboxId, error);
          resolve(null);
          this.profileDataCache.delete(cacheKey);
        });
    });

    this.profileDataCache.set(cacheKey, promise);

    return promise;
  }

  isConnected$ = new BehaviorSubject(false);

  selectServer(serverCode: string): void {
    this.stationsData$.next([]);
    this.unplayableStations$.next([]);
    this.trainsData$.next([]);
    this.signalsData$.next([]);
    this.trainDelays$.next(new Map());
    this.timeData$.next(null);
    this.connection.send("SwitchServer", serverCode).catch((e) => {
      console.error("Failed to switch server", e);
      this.isConnected$.next(false);
      this.connectToSignalR();
    });
  }

  serverData$ = new BehaviorSubject<ServerStatus[]>([]);
  selectedServerData$ = new BehaviorSubject<ServerStatus | null>(null);

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
      return cached;
    }

    const cachedPromise = this.timetablePromiseCache.get(trainNoLocal);

    if (cachedPromise) {
      return cachedPromise;
    }

    const promise = new Promise<Timetable | null>((resolve) => {
      this.connection
        .invoke("GetTimetable", trainNoLocal)
        .then((timetable) => {
          if (timetable) {
            this.timetableCache.set(trainNoLocal, timetable);
            resolve(timetable);
          } else {
            console.warn("Failed to fetch timetable for train", trainNoLocal);
            resolve(null);
          }
        })
        .catch((e) => {
          console.error("Error fetching timetable for train", trainNoLocal, e);
          resolve(null);
        });

      setTimeout(() => {
        console.warn("Timetable fetch timed out for train", trainNoLocal);
        if (this.timetablePromiseCache.has(trainNoLocal)) {
          resolve(null);
        }
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
      this.connection
        .invoke<string[]>("GetTrainRoutePoints", trainNoLocal)
        .then((route) => {
          console.log("Got route lines", trainNoLocal, route.length);
          resolve(route);
        })
        .catch((e) => {
          console.error("Failed to fetch route points for train", trainNoLocal, e);
          resolve(null);
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
        if (data?.Name === signal) {
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

        this.connection.send("GetSignals");
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
        if (data?.Name === signal) {
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

        this.connection.send("GetSignals");
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
        if (data?.Name === signal) {
          console.log(`Marked signal ${signal} next finalized`);
          this.signalsData$.next(
            this.signalsData$.value.map((s) => {
              if (s.Name === signal) {
                return {
                  ...s,
                  NextFinalized: finalized,
                };
              }
              return s;
            }),
          );
        } else {
          console.error(`Failed to mark signal ${signal} next finalized`, data.error);
        }

        this.connection.send("GetSignals");
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
        if (data?.Name === signal) {
          console.log(`Marked signal ${signal} prev finalized`);
          this.signalsData$.next(
            this.signalsData$.value.map((s) => {
              if (s.Name === signal) {
                return {
                  ...s,
                  PrevFinalized: finalized,
                };
              }
              return s;
            }),
          );
        } else {
          console.error(`Failed to mark signal ${signal} prev finalized`, data.error);
        }

        this.connection.send("GetSignals");
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
        if (data?.Name === signal) {
          console.log(`Deleted signal ${signal}`);
          this.signalsData$.next(this.signalsData$.value.filter((s) => s.Name !== signal));
        } else {
          console.error(`Failed to delete signal ${signal}`, data.error);
        }

        this.connection.send("GetSignals");
      })
      .catch((e) => {
        console.error(`Failed to delete signal ${signal}`, e);
      });
  }

  async getLinesForSignal(signal: string): Promise<string[] | null> {
    // Fetch the lines with the GetLinesForSignal SignalR method
    try {
      const lines = await this.connection.invoke<string[] | null>("GetLinesForSignal", signal);
      if (lines) {
        return lines;
      } else {
        console.warn(`No lines found for signal ${signal}`);
        return null;
      }
    } catch (e) {
      console.error(`Failed to get lines for signal ${signal}`, e);
      return null;
    }
  }

  async getLinesForSignalConnection(prevSignal: string, nextSignal: string): Promise<string[] | null> {
    // Fetch the lines with the GetLinesForSignalConnection SignalR method
    try {
      const lines = await this.connection.invoke<string[] | null>(
        "GetLinesForSignalConnection",
        prevSignal,
        nextSignal,
      );
      if (lines) {
        return lines;
      } else {
        console.warn(`No lines found for connection ${prevSignal} -> ${nextSignal}`);
        return null;
      }
    } catch (e) {
      console.error(`Failed to get lines for connection ${prevSignal} -> ${nextSignal}`, e);
      return null;
    }
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
