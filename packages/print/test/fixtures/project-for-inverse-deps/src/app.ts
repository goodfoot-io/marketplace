// This file imports via the barrel (re-export) instead of directly from helpers
import { capitalize, formatDate } from "./utils/index";

export function greet(name: string): string {
  const formattedName = capitalize(name);
  const today = formatDate(new Date());
  return `Hello, ${formattedName}! Today is ${today}.`;
}
