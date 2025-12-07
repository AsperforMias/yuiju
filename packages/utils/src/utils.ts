export type Checker = boolean | (() => boolean);

export function allTrue(items: Checker[]): boolean {
  return items.every(item => (typeof item === 'function' ? item() : item));
}
