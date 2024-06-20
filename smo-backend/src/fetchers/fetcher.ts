import { serverFetcher } from "./sever-fetcher";
import { BehaviorSubject, Subject } from "rxjs";
import { ModuleLogger } from "../logger";
import { ServerStatus } from "../api-helper";
import { PrismaClient } from "@prisma/client";
import { Worker } from "worker_threads";
import { extname } from "path";
import { statSync } from "fs";

const prisma = new PrismaClient();
const WORKER_TIMEOUT = 5 * 60 * 1000;

export class Fetcher<T> {
  protected logger: ModuleLogger;
  protected data: BehaviorSubject<T | null> = new BehaviorSubject<T | null>(null);
  public data$ = this.data.asObservable();
  private timeoutHandle: NodeJS.Timeout | null = null;
  private refreshInterval: number;
  protected worker: Worker;

  protected avgRefreshTime = 0;
  protected refreshCount = 0;

  constructor(protected module: string, defaultRefreshInterval: number) {
    this.logger = new ModuleLogger(module);
    this.refreshInterval =
      (process.env[`${module}_REFRESH_INTERVAL`] &&
        parseInt(process.env[`${module}_REFRESH_INTERVAL`]!) * 1000) ||
      defaultRefreshInterval;
    this.logger.info(`Refresh interval: ${this.refreshInterval}`);

    this.worker = this.getWorker();

    this.startWorker();
  }

  private getWorker() {
    // Worker setup
    const workerPath = `${__dirname}/workers/${this.module.toLocaleLowerCase()}${extname(
      __filename
    )}`; // Use the same extension as this file, in dev it's .ts, in prod it's .js

    if (!statSync(workerPath).isFile()) {
      throw new Error(`Worker file not found: ${workerPath}`);
    }

    return new Worker(workerPath);
  }

  protected startWorker(recreate = false) {
    if (recreate) {
      this.worker.terminate();
      this.worker = this.getWorker();
    }

    this.worker.on("error", (err) => {
      this.logger.error(`Worker error: ${err}`);
    });

    this.worker.on("exit", (code) => {
      if (code !== 0) {
        this.logger.error(`Worker stopped with exit code ${code}`);

        this.logger.info("Starting new worker");
        this.startWorker(true);
        this.logger.info("New worker started");
      } else {
        this.logger.info("Worker stopped");
      }
    });
  }

  public start() {
    this.refreshData();
  }

  private async refreshData() {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
    }

    this.timeoutHandle = null;
    let time = 0;

    try {
      const start = Date.now();

      this.logger.info("Refreshing data...");
      this.data.next(await this.fetchData());

      time = Date.now() - start;

      if (this.avgRefreshTime === 0) {
        this.avgRefreshTime = time;
      } else {
        this.avgRefreshTime = (this.avgRefreshTime + time) / 2;
      }

      this.refreshCount++;

      this.logger.success(`Data refreshed in ${time}ms (avg: ${this.avgRefreshTime}ms)`);

      this.writeStats(time);
    } catch (e) {
      this.logger.error("Error refreshing data: " + e);
    }

    this.timeoutHandle = setTimeout(
      () => this.refreshData(),
      Math.max(0, this.refreshInterval - time)
    );
  }

  protected writeStats(time: number) {
    prisma.stats
      .create({
        data: {
          service_id: this.module,
          duration: time,
          count: this.refreshCount,
        },
      })
      .then(() => {
        this.logger.debug("Stats written");
      })
      .catch((e: unknown) => {
        this.logger.error("Error writing stats: " + e);
      });
  }

  public get currentData(): T | null {
    return this.data.value;
  }

  protected async fetchData(): Promise<T> {
    const promise = new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.logger.error("Timeout, restarting worker...");
        this.startWorker(true);
        reject(new Error("Timeout"));
      }, WORKER_TIMEOUT);

      this.worker.once("message", (msg) => {
        clearTimeout(timeout);
        if (msg.type === "done") {
          resolve(msg.data);
        } else if (msg.type === "error") {
          reject(new Error(msg.data));
        } else {
          reject(new Error(`Unknown message type: ${msg.type}`));
        }
      });
    });

    this.worker.postMessage({ type: "run" });

    return promise;
  }
}

export class PerServerFetcher<T> extends Fetcher<Map<string, T>> {
  private perServerData = new Subject<{ server: string; data: T }>();
  public perServerData$ = this.perServerData.asObservable();

  constructor(
    module: string,
    defaultRefreshInterval: number,
    private serverFetcher: Fetcher<ServerStatus[]>
  ) {
    super(module, defaultRefreshInterval);
  }

  protected writeStats(time: number) {
    prisma.stats
      .create({
        data: {
          service_id: this.module,
          duration: time,
          count: this.refreshCount,
          server_count: this.currentData?.size,
        },
      })
      .then(() => this.logger.debug("Stats written"))
      .catch((e: unknown) => this.logger.error("Error writing stats: " + e));
  }

  protected async fetchData() {
    const result = new Map<string, T>();

    for (const server of serverFetcher.currentData || []) {
      const data = await this.fetchDataForServer(server.ServerCode);
      result.set(server.ServerCode, data);
      this.perServerData.next({ server: server.ServerCode, data });
    }

    return result;
  }

  protected async fetchDataForServer(server: string): Promise<T> {
    const promise = new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.logger.error("Timeout, restarting worker...");
        this.startWorker(true);
        reject(new Error("Timeout"));
      }, WORKER_TIMEOUT);

      this.worker.once("message", (msg) => {
        clearTimeout(timeout);
        if (msg.type === "done") {
          resolve(msg.data);
        } else if (msg.type === "error") {
          reject(new Error(msg.data));
        } else {
          reject(new Error(`Unknown message type: ${msg.type}`));
        }
      });
    });

    this.worker.postMessage({ type: "run", server });

    return promise;
  }

  public getDataForServer(server: string): T | null {
    return this.currentData?.get(server) || null;
  }
}
