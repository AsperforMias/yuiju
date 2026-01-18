export type Checker = boolean | (() => boolean);

export function allTrue(items: Checker[]): boolean {
  return items.every((item) => (typeof item === "function" ? item() : item));
}

export const safeParseJson = <T>(input: string): T | undefined => {
  try {
    return JSON.parse(input) as T;
  } catch {
    return undefined;
  }
};
