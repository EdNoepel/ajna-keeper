import { createLogger, transports } from 'winston';
import { Transports } from 'winston/lib/winston/transports';

export const logger = createLogger({
  level: 'debug',
  transports: [
    new transports.Console({ level: 'info' }),
    new transports.File({ filename: 'debug.log', level: 'debug' }),
    // new transports.File({ filename: 'info.log', level: 'info' }),
    // new transports.File({ filename: 'error.log', level: 'error' }),
  ],
});
