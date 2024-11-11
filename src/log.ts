import { config } from "@/config.ts";
import * as log from "@std/log";
const LOG_LEVEL = config.DB_LOG_LEVEL() as never;

log.setup({
  handlers: {
    console: new log.ConsoleHandler("DEBUG", {
      // formatter: log.formatters.jsonFormatter,
      formatter: (logRecord) => {
        let msg =
          `[${logRecord.levelName}] ${logRecord.datetime.toISOString()} ${logRecord.msg}`;

        logRecord.args.forEach((arg, _index) => {
          msg += ` ${arg}`;
        });

        return msg;
      },
      useColors: true,
    }),
  },
  loggers: {
    default: {
      level: LOG_LEVEL,
      handlers: ["console"],
    },
  },
});

log.critical("Log level set to: ", LOG_LEVEL);

export default log;
