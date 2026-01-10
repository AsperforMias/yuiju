import { characterState } from "./character-state";
import { worldState } from "./world-state";

export async function initState(): Promise<void> {
  await characterState.load();
  await worldState.load();
}
