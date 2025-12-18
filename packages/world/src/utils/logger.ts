import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));

// Configuration derived from environment or defaults
const isProd = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isProd ? 'info' : 'debug');
const logDir = process.env.LOG_DIR || resolve(__dir, '../../logs'); // Adjusted path to match previous location relative to this file

/** Shared text format for console and file */
const textFormat = winston.format.printf((info: winston.Logform.TransformableInfo) => {
  const splat = (info as any)[Symbol.for('splat')] || [];
  const metaCopy = info.metadata ? { ...(info.metadata as Record<string, any>) } : {};

  if (splat.length) {
    for (const arg of splat) {
      if (typeof arg === 'object' && arg !== null) {
        for (const key of Object.keys(arg)) {
          if (metaCopy[key] === arg[key]) {
            delete metaCopy[key];
          }
        }
      }
    }
  }

  const stringify = (value: any): string => {
    if (typeof value === 'string') return value;
    if (value === undefined) return '';
    if (value instanceof Error) return value.stack || value.message || String(value);
    if (typeof value === 'object' && value !== null) return JSON.stringify(value);
    return String(value);
  };

  const msg = stringify(info.message);
  const splatStr = splat.map(stringify).join(' ');
  const metaStr = Object.keys(metaCopy).length ? JSON.stringify(metaCopy) : '';

  return [`[${info.timestamp}]`, `[${info.level}]`, msg, splatStr, metaStr].filter(Boolean).join(' ');
});

/** Build console format (text only) */
function buildConsoleFormat() {
  const { format } = winston;
  const base = [
    format.timestamp(),
    format.errors({ stack: true }),
    format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
  ];
  return format.combine(...base, format.colorize(), textFormat);
}

/** Build file format (text only) */
function buildFileFormat() {
  const { format } = winston;
  const base = [
    format.timestamp(),
    format.errors({ stack: true }),
    format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
  ];

  return format.combine(...base, textFormat);
}

/** Create the Winston logger instance with configured transports */
function createWinstonLogger() {
  const transports: any[] = [];

  // Console transport
  transports.push(
    new winston.transports.Console({
      level: logLevel,
      format: buildConsoleFormat(),
    })
  );

  // File transport
  transports.push(
    new DailyRotateFile({
      dirname: logDir,
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: process.env.LOG_MAX_SIZE || '20m',
      maxFiles: process.env.LOG_MAX_FILES || '14d',
      zippedArchive: true,
      level: logLevel,
      format: buildFileFormat(),
    })
  );
  transports.push(
    new DailyRotateFile({
      dirname: logDir,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: process.env.LOG_MAX_SIZE || '20m',
      maxFiles: process.env.LOG_MAX_FILES || '14d',
      zippedArchive: true,
      level: 'error',
      format: buildFileFormat(),
    })
  );

  return winston.createLogger({
    level: logLevel,
    transports,
    exitOnError: false,
  });
}

const baseLogger = createWinstonLogger();

export const logger = baseLogger;
