import process from "node:process";
import { setTimeout } from "node:timers/promises";
import { worldState } from "@/state/world-state";
import { tick } from "./tick";

let running = false;
let stopped = false;

process.on("SIGINT", () => {
  stopped = true;
  process.exit();
});
process.on("SIGTERM", () => {
  stopped = true;
  process.exit();
});

export async function startRealtimeLoop() {
  stopped = false;
  if (running) return;
  running = true;

  let eventDescription: string | undefined;

  while (!stopped) {
    worldState.updateTime();

    const { nextTickInMinutes, completionEvent } = await tick({
      eventDescription,
    });
    eventDescription = completionEvent;
    await setTimeout(nextTickInMinutes * 60 * 1000);
  }
}
