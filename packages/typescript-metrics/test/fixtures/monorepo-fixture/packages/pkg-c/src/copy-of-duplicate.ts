export function copyOfDuplicate(items: string[]): { total: number; filtered: string[] } {
  const filtered: string[] = [];
  let total = 0;
  for (const item of items) {
    if (item.length > 0) {
      filtered.push(item.trim());
      total += item.length;
    }
  }
  return { total, filtered };
}
