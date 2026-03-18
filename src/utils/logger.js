import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { env } from '../config/env.js';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

const transports = [
  new winston.transports.Console({
    format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
  }),
  new DailyRotateFile({
    dirname: env.logging.dir,
    filename: 'error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxFiles: '30d',
    format: combine(timestamp(), errors({ stack: true }), logFormat),
  }),
  new DailyRotateFile({
    dirname: env.logging.dir,
    filename: 'combined-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxFiles: '14d',
    format: combine(timestamp(), errors({ stack: true }), logFormat),
  }),
];

export const logger = winston.createLogger({
  level: env.logging.level,
  format: combine(errors({ stack: true }), timestamp()),
  transports,
  exitOnError: false,
});
