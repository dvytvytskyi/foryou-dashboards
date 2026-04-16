export type UserRole = 'admin' | 'partner';

export interface User {
  email: string;
  name: string;
  role: UserRole;
  password?: string; // In a real app, use hashed passwords
  partnerId?: string; // To filter data for partners
}

// Initial users as requested. We can move this to a DB later.
export const USERS: User[] = [
  {
    email: 'admin@foryou.com',
    name: 'Admin User',
    role: 'admin',
    password: 'password123'
  },
  {
    email: 'klykov_boards@foryou-realestate.com',
    name: 'Klykov Boards',
    role: 'partner',
    password: 'klykov_password',
    partnerId: 'klykov'
  },
  {
    email: 'facebook_boards@foryou-realestate.com',
    name: 'Facebook Boards',
    role: 'partner',
    password: 'facebook_password',
    partnerId: 'facebook'
  }
];

export function findUserByEmail(email: string) {
  return USERS.find(u => u.email === email.toLowerCase());
}
