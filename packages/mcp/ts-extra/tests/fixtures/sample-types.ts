/**
 * Sample TypeScript file with various type constructs for testing
 */

export interface User {
  id: string;
  name: string;
  email: string;
}

export type UserId = string;

export class UserService {
  private users: User[] = [];

  public addUser(user: User): void {
    this.users.push(user);
  }

  public getUser(id: string): User | undefined {
    return this.users.find((u) => u.id === id);
  }
}

export enum UserRole {
  Admin = 'admin',
  User = 'user',
  Guest = 'guest'
}

export function calculateComplexity(value: number): string {
  if (value < 0) {
    return 'negative';
  } else if (value === 0) {
    return 'zero';
  } else if (value > 0 && value < 10) {
    return 'low';
  } else {
    return 'high';
  }
}
