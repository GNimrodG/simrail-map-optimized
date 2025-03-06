import { mkdirSync } from "node:fs";
import { Timetable } from "../api-helper";
import { PerServerFetcher } from "./fetcher";
import { serverFetcher } from "./sever-fetcher";
import notepack from "notepack.io";
import { readFile, writeFile } from "node:fs/promises";

type TimetableData = Record<string, Timetable>;

const EMPTY_MAP = new Map<string, TimetableData>();

class TimetableFetcher extends PerServerFetcher<TimetableData> {
  private readonly dataDir = `${process.cwd()}/data/${this.module}`;

  constructor() {
    super("TIMETABLE", 1800000, serverFetcher);

    mkdirSync(this.dataDir, { recursive: true });
  }

  private writeData(server: string, data: TimetableData) {
    return Promise.all(
      Object.entries(data).map(([trainNoLocal, timetable]) => {
        const dataPath = `${this.dataDir}/${server}-${trainNoLocal}.bin`;
        const encoded = notepack.encode(timetable);

        return writeFile(dataPath, encoded, { flag: "w", encoding: null });
      })
    );
  }

  public async getTimeTableForTrain(server: string, trainNoLocal: string) {
    const dataPath = `${this.dataDir}/${server}-${trainNoLocal}.bin`;

    try {
      const data = await readFile(dataPath);
      return notepack.decode(data) as Timetable;
    } catch (e) {
      return null;
    }
  }

  protected async fetchData() {
    for (const server of serverFetcher.currentData || []) {
      const data = await this.fetchDataForServer(server.ServerCode);
      await this.writeData(server.ServerCode, data);
    }

    return EMPTY_MAP;
  }
}

export const timetableFetcher = new TimetableFetcher();
