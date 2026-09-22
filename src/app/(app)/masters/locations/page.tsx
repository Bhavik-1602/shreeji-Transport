'use client';

import { useState } from 'react';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { InputField } from '@/components/Input';
import StatusPill from '@/components/StatusPill';
import Modal from '@/components/Modal';
import EmptyState from '@/components/EmptyState';
import { getLocations, saveLocation, toggleLocationActive, syncLocationsFromSupabase, deleteLocation } from '@/lib/master-store';
import { generateUUID } from '@/lib/supabase-service';
import type { Location } from '@/types/database';
import { useEffect } from 'react';

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLocations(getLocations());
    syncLocationsFromSupabase().then(remote => {
      if (remote && remote.length > 0) {
        setLocations(remote);
      }
    }).catch(() => {});
  }, []);

  const [name, setName] = useState('');
  const [district, setDistrict] = useState('');
  const [formError, setFormError] = useState('');

  const filtered = locations.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    (l.district?.toLowerCase().includes(search.toLowerCase()))
  );

  const openForm = (location?: Location) => {
    if (location) {
      setEditing(location);
      setName(location.name);
      setDistrict(location.district || '');
    } else {
      setEditing(null);
      setName(''); setDistrict('');
    }
    setFormError('');
    setShowForm(true);
  };

  const handleSave = () => {
    if (!name.trim()) { setFormError('Enter location name'); return; }
    const entry: Location = {
      id: editing ? editing.id : generateUUID(),
      transport_id: 'a0000000-0000-0000-0000-000000000001',
      name: name.trim(),
      district: district || null,
      is_active: editing ? editing.is_active : true,
    };
    const updated = saveLocation(entry);
    setLocations(updated);
    setShowForm(false);
  };

  const toggleActive = (id: string) => {
    const updated = toggleLocationActive(id);
    setLocations(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-xs">
          <input type="text" placeholder="Search locations..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="7" cy="7" r="5" /><path d="M11 11l3 3" /></svg>
        </div>
        <Button onClick={() => openForm()}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg>
          Add Location
        </Button>
      </div>

      <Card padding="none">
        {filtered.length === 0 ? (
          <EmptyState title="No locations found" description={search ? 'Try a different search term.' : 'Add your first location to get started.'} actionLabel={!search ? 'Add Location' : undefined} onAction={!search ? () => openForm() : undefined} />
        ) : (
          <div className="overflow-x-auto table-scroll">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left text-[13px] font-medium text-muted px-6 py-3">Location Name</th>
                  <th className="text-left text-[13px] font-medium text-muted px-4 py-3">District</th>
                  <th className="text-center text-[13px] font-medium text-muted px-4 py-3">Status</th>
                  <th className="text-right text-[13px] font-medium text-muted px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id} className="border-b border-line/50 hover:bg-paper/50 transition-colors duration-100">
                    <td className="px-6 py-3 text-[14px] font-medium text-ink">{l.name}</td>
                    <td className="px-4 py-3 text-[14px]">{l.district || '—'}</td>
                    <td className="px-4 py-3 text-center"><StatusPill status={l.is_active ? 'active' : 'inactive'} /></td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openForm(l)} className="text-[13px] font-medium text-primary hover:underline">Edit</button>
                        <button onClick={() => toggleActive(l.id)} className="text-[13px] font-medium text-muted hover:text-ink">{l.is_active ? 'Deactivate' : 'Activate'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Location' : 'Add Location'} size="sm" footer={<><Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button onClick={handleSave}>{editing ? 'Save Changes' : 'Add Location'}</Button></>}>
        <div className="space-y-4">
          <InputField label="Location Name" placeholder="Wakaner" value={name} onChange={(e) => setName(e.target.value)} error={formError} autoFocus />
          <InputField label="District" placeholder="Morbi" value={district} onChange={(e) => setDistrict(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}
