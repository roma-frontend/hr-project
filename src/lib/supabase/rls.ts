import { supabase } from './client';

export async function getOrganizationId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data?.organization_id) return null;
  return data.organization_id;
}

export async function getUserRole(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data?.role) return null;
  return data.role;
}

export async function hasRole(userId: string, roles: string[]): Promise<boolean> {
  const role = await getUserRole(userId);
  return role ? roles.includes(role) : false;
}

export async function isSuperadmin(userId: string): Promise<boolean> {
  return hasRole(userId, ['superadmin']);
}

export async function isAdmin(userId: string): Promise<boolean> {
  return hasRole(userId, ['superadmin', 'admin']);
}

export async function isSupervisor(userId: string): Promise<boolean> {
  return hasRole(userId, ['superadmin', 'admin', 'supervisor']);
}

export async function canAccessOrgData(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return false;

  const userOrgId = data.organization_id;
  if (!userOrgId) return false;

  return userOrgId === organizationId || await isSuperadmin(userId);
}

export async function getOrgMembers(organizationId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role, is_active')
    .eq('organization_id', organizationId)
    .eq('is_active', true);

  if (error) throw error;
  return data || [];
}
