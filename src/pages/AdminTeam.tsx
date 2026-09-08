import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { OrganizationMember, OrganizationInvite, Role } from '../types/database';

const ROLES: Role[] = ['owner', 'admin', 'staff', 'viewer'];

export function AdminTeam() {
  const { activeOrg, user } = useAuth();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invites, setInvites] = useState<OrganizationInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('staff');
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState('Copy');

  const fetchTeam = async () => {
    if (!activeOrg) return;
    setLoading(true);
    setError(null);
    try {
      const [membersRes, invitesRes] = await Promise.all([
        supabase.from('organization_members').select('*').eq('org_id', activeOrg.org_id),
        supabase
          .from('organization_invites')
          .select('*')
          .eq('org_id', activeOrg.org_id)
          .is('accepted_at', null),
      ]);
      if (membersRes.error) throw membersRes.error;
      if (invitesRes.error) throw invitesRes.error;
      setMembers((membersRes.data as OrganizationMember[]) || []);
      setInvites((invitesRes.data as OrganizationInvite[]) || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load team');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrg?.org_id]);

  const handleRoleChange = async (memberUserId: string, role: Role) => {
    if (!activeOrg) return;
    try {
      const { error } = await supabase
        .from('organization_members')
        .update({ role })
        .eq('org_id', activeOrg.org_id)
        .eq('user_id', memberUserId);
      if (error) throw error;
      setMembers((prev) => prev.map((m) => (m.user_id === memberUserId ? { ...m, role } : m)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  const handleRemove = async (memberUserId: string) => {
    if (!activeOrg) return;
    if (!window.confirm('Remove this team member?')) return;
    try {
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('org_id', activeOrg.org_id)
        .eq('user_id', memberUserId);
      if (error) throw error;
      setMembers((prev) => prev.filter((m) => m.user_id !== memberUserId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg) return;
    setInviting(true);
    setError(null);
    setInviteLink(null);
    try {
      const { data, error } = await supabase.rpc('create_invite', {
        p_org: activeOrg.org_id,
        p_email: inviteEmail,
        p_role: inviteRole,
      });
      if (error) throw error;
      const token = data as string;
      setInviteLink(`${window.location.origin}/invite/${token}`);
      setInviteEmail('');
      setCopyLabel('Copy');
      await fetchTeam();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create invite');
    } finally {
      setInviting(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopyLabel('Copied!');
    } catch {
      setCopyLabel('Copy failed');
    }
  };

  if (loading) {
    return <div className="p-8 text-gray-500">Loading team...</div>;
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-semibold mb-4">Team</h1>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
      )}

      <div className="overflow-x-auto bg-white rounded-lg shadow mb-8">
        <table className="min-w-full text-left text-sm text-gray-500">
          <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-700">
            <tr>
              <th className="px-6 py-3">User ID</th>
              <th className="px-6 py-3">Role</th>
              <th className="px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const isSelf = member.user_id === user?.id;
              return (
                <tr key={member.user_id} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-gray-900">{member.user_id}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.user_id, e.target.value as Role)}
                      className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-hostla-primary focus:border-transparent"
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleRemove(member.user_id)}
                      disabled={isSelf}
                      className="text-red-600 hover:text-red-800 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
            {members.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-gray-400">No team members.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Invite a Team Member</h2>
        <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-hostla-primary focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as Role)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-hostla-primary focus:border-transparent"
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={inviting}
            className="bg-hostla-primary hover:bg-hostla-secondary text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {inviting ? 'Sending...' : 'Send Invite'}
          </button>
        </form>

        {inviteLink && (
          <div className="mt-4 p-4 bg-hostla-light rounded-lg">
            <p className="text-sm text-gray-700 mb-2">Invite link (shown once):</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={inviteLink}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              />
              <button
                onClick={handleCopy}
                type="button"
                className="px-3 py-2 bg-hostla-primary text-white rounded-lg text-sm hover:bg-hostla-secondary"
              >
                {copyLabel}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Pending Invites</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-gray-500">
            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-700">
              <tr>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Expires</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => (
                <tr key={invite.id} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">{invite.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{invite.role}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{new Date(invite.expires_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {invites.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-gray-400">No pending invites.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
