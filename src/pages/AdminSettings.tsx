import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Organization } from '../types/database';

export function AdminSettings() {
  const { activeOrg } = useAuth();
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState('');
  const [retentionImages, setRetentionImages] = useState(30);
  const [retentionSignature, setRetentionSignature] = useState(30);
  const [retentionPii, setRetentionPii] = useState(30);
  const [retentionUnsubmitted, setRetentionUnsubmitted] = useState(30);

  const fetchOrg = async () => {
    if (!activeOrg) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', activeOrg.org_id)
        .single();
      if (error) throw error;
      const organization = data as Organization;
      setOrg(organization);
      setName(organization.name);
      setRetentionImages(organization.retention_days_images);
      setRetentionSignature(organization.retention_days_signature);
      setRetentionPii(organization.retention_days_pii);
      setRetentionUnsubmitted(organization.retention_days_unsubmitted);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load organization');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrg();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrg?.org_id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name,
          retention_days_images: retentionImages,
          retention_days_signature: retentionSignature,
          retention_days_pii: retentionPii,
          retention_days_unsubmitted: retentionUnsubmitted,
        })
        .eq('id', activeOrg.org_id);
      if (error) throw error;
      setSaved(true);
      await fetchOrg();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-gray-500">Loading settings...</div>;
  }

  if (!org) {
    return <div className="p-8 text-red-600">Organization not found.</div>;
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-4">Organization Settings</h1>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
      )}
      {saved && (
        <div className="mb-4 rounded border border-green-200 bg-green-50 p-4 text-green-700">Settings saved.</div>
      )}

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Plan</p>
            <p className="font-medium text-gray-900">{org.plan}</p>
          </div>
          <div>
            <p className="text-gray-500">Trial Ends</p>
            <p className="font-medium text-gray-900">
              {org.trial_ends_at ? new Date(org.trial_ends_at).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Organization Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-hostla-primary focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Image Retention (days, max 730)</label>
          <input
            type="number"
            min={1}
            max={730}
            value={retentionImages}
            onChange={(e) => setRetentionImages(Number(e.target.value))}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-hostla-primary focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Signature Retention (days)</label>
          <input
            type="number"
            min={1}
            value={retentionSignature}
            onChange={(e) => setRetentionSignature(Number(e.target.value))}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-hostla-primary focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">PII Retention (days)</label>
          <input
            type="number"
            min={1}
            value={retentionPii}
            onChange={(e) => setRetentionPii(Number(e.target.value))}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-hostla-primary focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Unsubmitted Retention (days)</label>
          <input
            type="number"
            min={1}
            value={retentionUnsubmitted}
            onChange={(e) => setRetentionUnsubmitted(Number(e.target.value))}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-hostla-primary focus:border-transparent"
          />
        </div>

        <div className="flex justify-end border-t pt-4">
          <button
            type="submit"
            disabled={saving}
            className="bg-hostla-primary hover:bg-hostla-secondary text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
