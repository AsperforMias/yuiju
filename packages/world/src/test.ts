import "dotenv/config";
import { characterState } from "./state/charactor-state";

async function main() {
  await characterState.setAction("Go_To_School" as any);
  console.log(characterState.action);
}
main();
