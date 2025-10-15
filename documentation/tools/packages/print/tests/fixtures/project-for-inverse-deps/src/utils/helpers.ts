export function padZero(num: number): string {
  return num.toString().padStart(2, '0');
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
