export function formatDate(date: Date): string {
  return date.toISOString();
}

export function parseJSON(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}
