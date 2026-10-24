import type { User } from '@/types/saas';

export const hasPlatformRole = (user: User | null | undefined, role: 'admin' | 'developer') =>
  Boolean(user && (user.role === 'admin' || user.platformRoles?.includes(role) || user.platformRoles?.includes('admin')));

export const canAccessAdmin = (user: User | null | undefined) =>
  Boolean(user && (user.role === 'admin' || user.platformRoles?.includes('admin') || user.platformRoles?.includes('developer')));
