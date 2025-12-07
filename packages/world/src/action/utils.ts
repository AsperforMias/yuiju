import { ActionContext, ActionId } from '@/types/action';
import { anywhereAction } from './anywhere';
import { homeAction } from './home';
import { schoolAction } from './school';

export const isDoing = (context: ActionContext, action: ActionId) => context.charactorState.action === action;

export const isNotDoing = (context: ActionContext, action: ActionId) => context.charactorState.action !== action;

export const getActionById = (action: ActionId) => {
  return [...anywhereAction, ...homeAction, ...schoolAction].find(item => item.action === action)!;
};
