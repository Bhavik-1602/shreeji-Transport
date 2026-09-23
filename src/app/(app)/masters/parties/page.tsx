'use client';

import { useState } from 'react';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { InputField } from '@/components/Input';
import StatusPill from '@/components/StatusPill';
import Modal from '@/components/Modal';
import EmptyState from '@/components/EmptyState';
import SearchInput from '@/components/SearchInput';
import { getParties, saveParty, togglePartyActive, syncPartiesFromSupabase, deleteParty } from '@/lib/master-store';
import { generateUUID } from '@/lib/supabase-service';
import type { Party } from '@/types/database';
import { useEffect } from 'react';
import { useToast } from '@/components/Toast';

export default function PartiesPage() {
  const toast = useToast();
  const [parties, setParties] = useState<Party[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Party | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setParties(getParties());
    syncPartiesFromSupabase().then(remote => {
      if (remote && remote.length > 0) {
        setParties(remote);
      }
    }).catch(() => {});
  }, []);

  const [name, setName] = useState('');
  const [gstin, setGstin] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [formError, setFormError] = useState('');

  const filtered = parties.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.gstin?.toLowerCase().includes(search.toLowerCase()))
  );

  const openForm = (party?: Party) => {
    if (party) {
      setEditing(party);
      setName(party.name);
      setGstin(party.gstin || '');
      setAddress(party.address || '');
      setPhone(party.phone || '');
    } else {
      setEditing(null);
      setName(''); setGstin(''); setAddress(''); setPhone('');
    }
    setFormError('');
    setShowForm(true);
  };

  const handleSave = () => {
    if (!name.trim()) { setFormError('Enter party name'); return; }
    const entry: Party = {
      id: editing ? editing.id : generateUUID(),
      transport_id: 'a0000000-0000-0000-0000-000000000001',
      name: name.trim(),
      gstin: gstin || null,
      address: address || null,
      phone: phone || null,
      is_active: editing ? editing.is_active : true,
    };
    const updated = saveParty(entry);
    setParties(updated);
    setShowForm(false);
    toast.success(editing ? 'Party updated' : 'Party added', { message: entry.name });
  };

  const toggleActive = (id: string) => {
    const updated = togglePartyActive(id);
    setParties(updated);
    const party = updated.find(p => p.id === id);
    if (party) toast.info(party.is_active ? 'Party activated' : 'Party deactivated', { message: party.name });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SearchInput
          placeholder="Search parties..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
          wrapperClassName="w-full sm:flex-1 sm:max-w-xs"
        />
        <Button onClick={() => openForm()} className="w-full sm:w-auto">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg>
          Add Party
        </Button>
      </div>

      <Card padding="none">
        {filtered.length === 0 ? (
          <EmptyState title="No parties found" description={search ? 'Try a different search term.' : 'Add your first party to get started.'} actionLabel={!search ? 'Add Party' : undefined} onAction={!search ? () => openForm() : undefined} />
        ) : (
          <div className="overflow-x-auto table-scroll">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left text-[13px] font-medium text-muted px-6 py-3">Party Name</th>
                  <th className="text-left text-[13px] font-medium text-muted px-4 py-3">GSTIN</th>
                  <th className="text-left text-[13px] font-medium text-muted px-4 py-3">Address</th>
                  <th className="text-left text-[13px] font-medium text-muted px-4 py-3">Phone</th>
                  <th className="text-center text-[13px] font-medium text-muted px-4 py-3">Status</th>
                  <th className="text-right text-[13px] font-medium text-muted px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-line/50 hover:bg-paper/50 transition-colors duration-100">
                    <td className="px-6 py-3 text-[14px] font-medium text-ink">{p.name}</td>
                    <td className="px-4 py-3 text-[14px] font-mono text-[13px]">{p.gstin || '—'}</td>
                    <td className="px-4 py-3 text-[14px]">{p.address || '—'}</td>
                    <td className="px-4 py-3 text-[14px]">{p.phone || '—'}</td>
                    <td className="px-4 py-3 text-center"><StatusPill status={p.is_active ? 'active' : 'inactive'} /></td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openForm(p)} className="text-[13px] font-medium text-primary hover:underline">Edit</button>
                        <button onClick={() => toggleActive(p.id)} className="text-[13px] font-medium text-muted hover:text-ink">{p.is_active ? 'Deactivate' : 'Activate'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Party' : 'Add Party'} size="sm" footer={<><Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button onClick={handleSave}>{editing ? 'Save Changes' : 'Add Party'}</Button></>}>
        <div className="space-y-4">
          <InputField label="Party Name" placeholder="Ambuja Cement Ltd" value={name} onChange={(e) => setName(e.target.value)} error={formError} autoFocus />
          <InputField label="GSTIN" placeholder="24AABCA1234F1ZP" value={gstin} onChange={(e) => setGstin(e.target.value)} />
          <InputField label="Address" placeholder="Kodinar, Gujarat" value={address} onChange={(e) => setAddress(e.target.value)} />
          <InputField label="Phone" type="tel" placeholder="02846-220100" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}
