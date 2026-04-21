import pino from 'pino';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const logsDir = join(__dirname, '..', 'logs');

try {
  mkdirSync(logsDir, { recursive: true });
} catch (_) {
  // directory already exists
}

const isDev = process.env.NODE_ENV !== 'production';

let logger;

try {
  const transports = pino.transport({
    targets: [
      {
        target: isDev ? 'pino-pretty' : 'pino/file',
        options: isDev ? { colorize: true, ignore: 'pid,hostname' } : {},
        level: 'debug'
      },
      {
        target: 'pino/file',
        options: { destination: join(logsDir, 'envoy.log'), mkdir: true },
        level: 'info'
      }
    ]
  });

  logger = pino({ level: 'debug' }, transports);
} catch (err) {
  // Fallback to simple console logger if pino-pretty is not available
  logger = pino({ level: 'debug' });
}

export default logger;
