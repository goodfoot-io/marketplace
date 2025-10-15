import { padZero } from './helpers';

export function formatDate(date: Date): string {
  const day = padZero(date.getDate());
  const month = padZero(date.getMonth() + 1);
  const year = date.getFullYear();
  return `${year}-${month}-${day}`;
}
