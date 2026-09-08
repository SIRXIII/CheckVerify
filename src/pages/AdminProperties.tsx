import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Property } from '../types/database';

interface PropertyForm {
  id: string | null;
  name: string;
  slug: string;
  timezone: string;
  check_in_instructions: string;
  release_instructions_on_approval: boolean;
  active: boolean;
  verification_rules: string;
}

const emptyForm: PropertyForm = {
  id: null,
  name: '',
  slug: '',
  timezone: 'America/Los_Angeles',
  check_in_instructions: '',
  release_instructions_on_approval: false,
  active: true,
  verification_rules: '{}',
};

export function AdminProperties() {
  const { activeOrg } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<PropertyForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchProperties = async () => {
    if (!activeOrg) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('org_id', activeOrg.org_id)
        .order('name');
      if (error) throw error;
      setProperties((data as Property[]) || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load properties');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrg?.org_id]);

  const openCreate = () => {
    setForm(emptyForm);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (property: Property) => {
    setForm({
      id: property.id,
      name: property.name,
      slug: property.slug,
      timezone: property.timezone,
      check_in_instructions: property.check_in_instructions || '',
      release_instructions_on_approval: property.release_instructions_on_approval,
      active: property.active,
      verification_rules: JSON.stringify(property.verification_rules ?? {}, null, 2),
    });
    setFormError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setFormError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg) return;

    let verificationRules: Record<string, unknown>;
    try {
      verificationRules = JSON.parse(form.verification_rules || '{}');
    } catch {
      setFormError('Verification rules must be valid JSON.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        org_id: activeOrg.org_id,
        name: form.name,
        slug: form.slug,
        timezone: form.timezone,
        check_in_instructions: form.check_in_instructions || null,
        release_instructions_on_approval: form.release_instructions_on_approval,
        active: form.active,
        verification_rules: verificationRules,
      };

      if (form.id) {
        const { error } = await supabase.from('properties').update(payload).eq('id', form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('properties').insert([payload]);
        if (error) throw error;
      }

      setFormOpen(false);
      await fetchProperties();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save property');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-gray-500">Loading properties...</div>;
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold">Properties</h1>
        <button
          onClick={openCreate}
          className="bg-hostla-primary hover:bg-hostla-secondary text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Add Property
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
      )}

      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full text-left text-sm text-gray-500">
          <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-700">
            <tr>
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">Slug</th>
              <th className="px-6 py-3">Timezone</th>
              <th className="px-6 py-3">Active</th>
              <th className="px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {properties.map((property) => (
              <tr key={property.id} className="border-b hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{property.name}</td>
                <td className="px-6 py-4 whitespace-nowrap">{property.slug}</td>
                <td className="px-6 py-4 whitespace-nowrap">{property.timezone}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    property.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {property.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button onClick={() => openEdit(property)} className="text-hostla-primary hover:text-hostla-secondary">
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {properties.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-400">No properties yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">{form.id ? 'Edit Property' : 'Add Property'}</h2>
              <button onClick={closeForm} className="text-gray-500 hover:text-gray-700 text-xl">&times;</button>
            </div>

            {formError && (
              <div className="mb-4 rounded border border-red-200 bg-red-50 p-4 text-red-700">{formError}</div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-hostla-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Slug</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-hostla-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
                <input
                  type="text"
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-hostla-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Check-In Instructions</label>
                <textarea
                  value={form.check_in_instructions}
                  onChange={(e) => setForm({ ...form, check_in_instructions: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-hostla-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Verification Rules (JSON)</label>
                <textarea
                  value={form.verification_rules}
                  onChange={(e) => setForm({ ...form, verification_rules: e.target.value })}
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-hostla-primary focus:border-transparent"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  id="release_instructions_on_approval"
                  type="checkbox"
                  checked={form.release_instructions_on_approval}
                  onChange={(e) => setForm({ ...form, release_instructions_on_approval: e.target.checked })}
                  className="h-4 w-4 text-hostla-primary rounded focus:ring-hostla-primary"
                />
                <label htmlFor="release_instructions_on_approval" className="text-sm text-gray-700">
                  Release instructions automatically on approval
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  id="active"
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="h-4 w-4 text-hostla-primary rounded focus:ring-hostla-primary"
                />
                <label htmlFor="active" className="text-sm text-gray-700">Active</label>
              </div>

              <div className="flex justify-end space-x-3 border-t pt-4">
                <button type="button" onClick={closeForm} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-hostla-primary text-white rounded hover:bg-hostla-secondary disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
