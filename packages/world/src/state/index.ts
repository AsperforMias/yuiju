import { characterState } from "./character-state";
import { worldState } from "./world-state";
import { planManager } from "@/plan";

export async function initState(): Promise<void> {
  await characterState.load();
  await worldState.load();
  await planManager.getState();
}
