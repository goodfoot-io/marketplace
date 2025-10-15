/**
 * Test fixture with various exported types for types tool testing
 */

export interface Config {
  apiKey: string;
  endpoint: string;
  timeout?: number;
}

export type UserId = string;

export type Status = 'active' | 'inactive' | 'pending';

export function fetchData(_id: UserId): Promise<Config> {
  return Promise.resolve({
    apiKey: 'test',
    endpoint: 'http://localhost',
    timeout: 3000
  });
}

export const API_VERSION = '1.0.0';

export enum Priority {
  Low = 0,
  Medium = 1,
  High = 2
}

export class DataStore<T> {
  private items: T[] = [];

  add(item: T): void {
    this.items.push(item);
  }

  getAll(): T[] {
    return [...this.items];
  }
}
