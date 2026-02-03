// This file also imports via the barrel
import { capitalize } from "../utils/index";

export function formatUserName(firstName: string, lastName: string): string {
  return `${capitalize(firstName)} ${capitalize(lastName)}`;
}
