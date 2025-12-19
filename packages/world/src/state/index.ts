import { charactorState } from './charactor-state';
import { worldState } from './world-state';

export async function initState(): Promise<void> {
  await charactorState.load();
  await worldState.load();
}
