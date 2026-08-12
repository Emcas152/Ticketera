export interface User {
  id: string;
  roleId?: number;
  fullName: string;
  email: string;
  phone?: string;
  city?: string;
  membershipTier?: 'Core' | 'Prime' | 'Elite';
  avatarUrl?: string;
}
