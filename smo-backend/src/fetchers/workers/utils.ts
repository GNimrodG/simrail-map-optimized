import { parentPort } from "worker_threads";
import { ModuleLogger } from "../../logger";
import { basename, extname } from "path";

function getModuleName(filename: string) {
  return basename(filename, extname(filename)).toUpperCase();
}

export function registerWorkerFunction(
  filename: string,
  fn: (logger: ModuleLogger) => Promise<unknown>
) {
  const logger = new ModuleLogger(`${getModuleName(filename)}-WORKER`);

  parentPort?.on("message", async (msg) => {
    switch (msg.type) {
      case "run": {
        const result = await fn(logger);
        parentPort?.postMessage({ type: "done", data: result });
        break;
      }
      default:
        logger.warn(`Unknown message type: ${msg.type}`);
        break;
    }
  });

  logger.debug("Worker function registered");
}

export function registerPerServerWorkerFunction<T>(
  filename: string,
  fn: (server: string, logger: ModuleLogger) => Promise<T>
) {
  const logger = new ModuleLogger(`${getModuleName(filename)}-WORKER`);

  parentPort?.on("message", async (msg) => {
    switch (msg.type) {
      case "run": {
        const result = await fn(msg.server, logger);
        parentPort?.postMessage({ type: "done", data: result });
        break;
      }
      default:
        logger.warn(`Unknown message type: ${msg.type}`);
        break;
    }
  });

  logger.debug("Worker function registered");
}
