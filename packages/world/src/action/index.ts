import { ActionContext, ActionMetadata } from '@/types/action';
import { homeAction } from './home';
import { MajorScene } from '@/types/state';
import { schoolAction } from './school';
import { anywhereAction } from './anywhere';

export function getActionList(context: ActionContext) {
  let locationAction: ActionMetadata[] = [];

  switch (context.charactorState.location.major) {
    case MajorScene.Home:
      locationAction = homeAction;
      break;
    case MajorScene.School:
      locationAction = schoolAction;
      break;
    default:
      break;
  }

  return locationAction.concat(anywhereAction);
}
