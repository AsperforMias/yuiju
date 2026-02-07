import { type ActionContext, type ActionMetadata, MajorScene } from "@yuiju/utils";
import { anywhereAction } from "./anywhere";
import { cafeAction } from "./cafe";
import { homeAction } from "./home";
import { schoolAction } from "./school";
import { shopAction } from "./shop";
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
    case MajorScene.Shop:
      locationAction = shopAction;
      break;
    case MajorScene.Cafe:
      locationAction = cafeAction;
      break;
    default:
      break;
  }

  return locationAction.concat(anywhereAction).filter((action) => {
    return action.precondition(context);
  });
}
