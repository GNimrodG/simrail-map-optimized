import chalk from "chalk";
import { TransformableInfo } from "logform";
import { join } from "path";
import { createLogger, format, transports } from "winston";
import "winston-daily-rotate-file";

const dev = process.env.NODE_ENV !== "production";

class LevelUppercase {
  static transform(info: TransformableInfo): TransformableInfo {
    info.level = info.level.toUpperCase();
    return info;
  }
}

const levelColors: Record<string, chalk.Chalk> = {
  error: chalk.red,
  warn: chalk.yellow,
  info: chalk.blue,
  success: chalk.green,
  verbose: chalk.white,
  log: chalk.white,
  debug: chalk.gray,
  silly: chalk.magenta,
};

const fileLogFormat = format.combine(
  format.uncolorize(),
  format.timestamp(),
  format.splat(),
  LevelUppercase,
  format.printf(({ level, message, timestamp, module, label, client, ...rest }) => {
    let line = `[${timestamp}]`;
    if (dev) line += "[DEV]";
    line += `[${level}]`;
    if (module) line += `[${module}]`;
    if (client) line += `[${client}]`;
    line += ` ${message}`;
    if (Object.keys(rest).length) line += ` ${JSON.stringify(rest)}`;

    return line;
  })
);

const consoleLogFormat = format.combine(
  format.timestamp(),
  format.splat(),
  format.printf(({ level, message, timestamp, module, label, client, ...rest }) => {
    let line = `[${new Date(timestamp).toISOString()}]`;
    if (dev) line += chalk.bold.cyan("[DEV]");
    if (module) line += `[${module}]`;
    line += `[${levelColors[level?.toLowerCase() || "warn"](level.toUpperCase())}]`;
    if (client) line += `[${client}]`;
    line += ` ${message.replace(/\d+ms/g, chalk.bold.yellow("$&"))}`;
    if (Object.keys(rest).length) line += ` ${JSON.stringify(rest)}`;

    return line;
  })
);

const logStorage = process.env.LOG_STORAGE || "logs";
const datePattern = "YYYY-MM";
const errorFilename = join(logStorage, `error-%DATE%${dev ? ".dev" : ""}.log`);
const outputFilename = join(logStorage, `output-%DATE%${dev ? ".dev" : ""}.log`);

const logger = createLogger({
  level: dev ? "debug" : "info",
  format: fileLogFormat,
  transports: [
    new transports.Console({ format: consoleLogFormat }),
    new transports.DailyRotateFile({
      filename: errorFilename,
      datePattern,
      level: "error",
    }),
    new transports.DailyRotateFile({ filename: outputFilename, datePattern }),
  ],
  exceptionHandlers: [
    new transports.Console({ format: consoleLogFormat }),
    new transports.DailyRotateFile({ filename: errorFilename, datePattern }),
  ],
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    success: 2,
    verbose: 4,
    debug: 5,
    silly: 6,
  },
});

export default logger;

export class ModuleLogger {
  constructor(private module: string) {}

  error(message: string, meta?: Record<string, any>) {
    logger.error(message, { module: this.module, ...meta });
  }

  warn(message: string, meta?: Record<string, any>) {
    logger.warn(message, { module: this.module, ...meta });
  }

  info(message: string, meta?: Record<string, any>) {
    logger.info(message, { module: this.module, ...meta });
  }

  success(message: string, meta?: Record<string, any>) {
    logger.log("success", message, { module: this.module, ...meta });
  }

  verbose(message: string, meta?: Record<string, any>) {
    logger.verbose(message, { module: this.module, ...meta });
  }

  debug(message: string, meta?: Record<string, any>) {
    logger.debug(message, { module: this.module, ...meta });
  }
}
