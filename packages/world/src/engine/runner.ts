import process from 'node:process';
import { tick } from './tick';
import { worldState } from '@/state/world-state';
import { setTimeout } from 'timers/promises';

let running = false;
let stopped = false;

process.on('SIGINT', () => {
  stopped = true;
  process.exit();
});
process.on('SIGTERM', () => {
  stopped = true;
  process.exit();
});

export async function startRealtimeLoop() {
  stopped = false;
  if (running) return;
  running = true;

  let eventDescription: string | undefined = undefined;

  while (!stopped) {
    worldState.updateTime();

    const { nextTickInMinutes, completionEvent } = await tick({});
    eventDescription = completionEvent;
    await setTimeout(nextTickInMinutes * 60 * 1000);
  }
}
