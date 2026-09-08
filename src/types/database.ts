import type { Role } from '../lib/roles';

export type { Role };

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  plan_status: string;
  trial_ends_at: string | null;
  retention_days_images: number;
  retention_days_signature: number;
  retention_days_pii: number;
  retention_days_unsubmitted: number;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  org_id: string;
  user_id: string;
  role: Role;
}

export interface OrganizationInvite {
  id: string;
  org_id: string;
  email: string;
  role: Role;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface Property {
  id: string;
  org_id: string;
  slug: string;
  name: string;
  address: Record<string, unknown>;
  timezone: string;
  check_in_instructions: string | null;
  release_instructions_on_approval: boolean;
  verification_rules: Record<string, unknown>;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Verification {
  id: string;
  org_id: string;
  reservation_id: string;
  status: string;
  risk_score: number | null;
  risk_flags: unknown[];
  submitted_at: string | null;
  submitted_ip: string | null;
  submitted_user_agent: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  decision_reason: string | null;
  instructions_released_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface AuditEvent {
  id: number;
  org_id: string;
  actor_type: string;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/** Row shape returned by the my_memberships() RPC. */
export interface Membership {
  org_id: string;
  slug: string;
  name: string;
  role: Role;
  plan: string;
}

/** Row shape returned by the dashboard_counts(p_org) RPC. */
export interface DashboardCount {
  status: string;
  n: number;
}
