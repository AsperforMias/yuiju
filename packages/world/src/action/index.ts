import type { ActionContext, ActionMetadata } from "@/types/action";
import { MajorScene } from "@/types/state";
import { anywhereAction } from "./anywhere";
import { homeAction } from "./home";
import { schoolAction } from "./school";
import { precheckAction } from "./utils";

export function getActionList(context: ActionContext) {
  let locationAction: ActionMetadata[] = [];

  const actionList = precheckAction(context);
  if (actionList) {
    return actionList;
  }

  switch (context.characterState.location.major) {
    case MajorScene.Home:
      locationAction = homeAction;
      break;
    case MajorScene.School:
      locationAction = schoolAction;
      break;
    default:
      break;
  }

  return locationAction.concat(anywhereAction).filter((action) => {
    return action.precondition(context);
  });
}
