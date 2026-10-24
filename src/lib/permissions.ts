import type { User } from '@/types/saas';

// Helper seguro para extrair o valor da role independentemente de vir como string ou objeto
const getRoleString = (role: unknown): string => {
  if (!role) return '';
  if (typeof role === 'string') return role.toLowerCase();
  if (typeof role === 'object') {
    const roleObj = role as Record<string, unknown>;
    return String(roleObj.name || roleObj.slug || roleObj.title || '').toLowerCase();
  }
  return '';
};

export const hasPlatformRole = (user: User | null | undefined, role: 'admin' | 'developer') => {
  if (!user || typeof user !== 'object') return false;
  const userRole = getRoleString(user.role);
  const platformRoles = Array.isArray(user.platformRoles) 
    ? user.platformRoles.map(r => getRoleString(r)) 
    : [];

  return Boolean(
    userRole === 'admin' || 
    userRole === role || 
    platformRoles.includes(role) || 
    platformRoles.includes('admin')
  );
};

export const canAccessAdmin = (user: User | null | undefined) => {
  if (!user || typeof user !== 'object') return false;
  const userRole = getRoleString(user.role);
  const platformRoles = Array.isArray(user.platformRoles) 
    ? user.platformRoles.map(r => getRoleString(r)) 
    : [];

  return Boolean(
    userRole === 'admin' || 
    platformRoles.includes('admin') || 
    platformRoles.includes('developer')
  );
};