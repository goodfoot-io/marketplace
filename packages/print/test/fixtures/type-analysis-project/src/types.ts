export interface User {
  id: number;
  name: string;
  email?: string;
}

export type UserRole = "admin" | "user" | "guest";

export interface AdminUser extends User {
  permissions: string[];
}
