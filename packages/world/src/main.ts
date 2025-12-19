import 'dotenv/config';
import { logger } from '@/utils/logger';
import { startRealtimeLoop } from '@/engine/runner';
import process from 'node:process';
import { connectDB } from '@yuiju/utils';
import { initState } from './state';

async function main() {
  await connectDB();
  await initState();

  process.on('uncaughtException', err => {
    logger.error({ event: 'process.uncaughtException', error: String(err), stack: (err as any)?.stack });
  });
  process.on('unhandledRejection', reason => {
    logger.error({ event: 'process.unhandledRejection', error: String(reason) });
  });

  logger.info('[main] Starting realtime loop...');
  await startRealtimeLoop();
}

main();
