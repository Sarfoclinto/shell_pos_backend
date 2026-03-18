import morgan from 'morgan';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

const stream = {
  write: (message) => logger.http(message.trim()),
};

const skip = () => env.isProd;

export const httpLogger = morgan(
  ':method :url :status :res[content-length] - :response-time ms',
  { stream, skip: env.isProd ? undefined : skip }
);
