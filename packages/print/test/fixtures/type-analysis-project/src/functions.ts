export function add(a: number, b: number): number {
  return a + b;
}

export function processItems(items: string[]): string[] {
  const result: string[] = [];
  for (const item of items) {
    if (item.length > 0) {
      result.push(item.toUpperCase());
    }
  }
  return result;
}

export enum Status {
  Active = "active",
  Inactive = "inactive",
  Pending = "pending",
}
