import 'dotenv/config';
import { charactorState } from './state/charactor-state';

async function main() {
  await charactorState.setAction('Go_To_School' as any);
  console.log(charactorState.action);
}
main();
