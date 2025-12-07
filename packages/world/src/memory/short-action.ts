import { saveActionModal } from '@/db/action.schema';
import { ActionId } from '@/types/action';

export interface ActionMemory {
  action: ActionId;
  reason: string;
  timestamp: number;
}

// 简单的短期记忆实现，记录最近 N 次的 action
export class ShortActionMemory {
  private buffer: Array<ActionMemory> = [];
  private readonly capacity: number;

  constructor(capacity = 6) {
    this.capacity = capacity;
  }

  push(entry: ActionMemory) {
    this.buffer.push(entry);
    // 存储数据库
    saveActionModal({
      action_id: entry.action,
      reason: entry.reason,
    });
    if (this.buffer.length > this.capacity) {
      this.buffer.shift();
    }
  }

  list() {
    return [...this.buffer];
  }
}

export const shortActionMemory = new ShortActionMemory();
