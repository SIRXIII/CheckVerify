export type Role = 'owner' | 'admin' | 'staff' | 'viewer';

const ROLE_RANK: Record<Role, number> = {
  viewer: 0,
  staff: 1,
  admin: 2,
  owner: 3,
};

export function roleAtLeast(role: Role, min: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}
