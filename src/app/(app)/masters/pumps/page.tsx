'use client';

import { useState } from 'react';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { InputField } from '@/components/Input';
import StatusPill from '@/components/StatusPill';
import Modal from '@/components/Modal';
import EmptyState from '@/components/EmptyState';
import { getPumps, savePump, togglePumpActive, syncPumpsFromSupabase, deletePump } from '@/lib/master-store';
import { generateUUID } from '@/lib/supabase-service';
import { formatCurrency } from '@/lib/format';
import type { Pump } from '@/types/database';
import { useEffect } from 'react';

export default function PumpsPage() {
  const [pumps, setPumps] = useState<Pump[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Pump | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setPumps(getPumps());
    syncPumpsFromSupabase().then(remote => {
      if (remote && remote.length > 0) {
        setPumps(remote);
      }
    }).catch(() => {});
  }, []);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [formError, setFormError] = useState('');

  const filtered = pumps.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const openForm = (pump?: Pump) => {
    if (pump) {
      setEditing(pump);
      setName(pump.name);
      setPhone(pump.phone || '');
      setOpeningBalance(pump.opening_balance ? String(pump.opening_balance) : '');
    } else {
      setEditing(null);
      setName(''); setPhone(''); setOpeningBalance('');
    }
    setFormError('');
    setShowForm(true);
  };

  const handleSave = () => {
    if (!name.trim()) { setFormError('Enter pump name'); return; }
    const entry: Pump = {
      id: editing ? editing.id : generateUUID(),
      transport_id: 'a0000000-0000-0000-0000-000000000001',
      name: name.trim(),
      phone: phone || null,
      opening_balance: Number(openingBalance) || 0,
      is_active: editing ? editing.is_active : true,
    };
    const updated = savePump(entry);
    setPumps(updated);
    setShowForm(false);
  };

  const toggleActive = (id: string) => {
    const updated = togglePumpActive(id);
    setPumps(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-xs">
          <input type="text" placeholder="Search pumps..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="7" cy="7" r="5" /><path d="M11 11l3 3" /></svg>
        </div>
        <Button onClick={() => openForm()}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg>
          Add Pump
        </Button>
      </div>

      <Card padding="none">
        {filtered.length === 0 ? (
          <EmptyState title="No pumps found" description={search ? 'Try a different search term.' : 'Add your first pump to get started.'} actionLabel={!search ? 'Add Pump' : undefined} onAction={!search ? () => openForm() : undefined} />
        ) : (
          <div className="overflow-x-auto table-scroll">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left text-[13px] font-medium text-muted px-6 py-3">Pump Name</th>
                  <th className="text-left text-[13px] font-medium text-muted px-4 py-3">Phone</th>
                  <th className="text-right text-[13px] font-medium text-muted px-4 py-3">Opening Balance</th>
                  <th className="text-center text-[13px] font-medium text-muted px-4 py-3">Status</th>
                  <th className="text-right text-[13px] font-medium text-muted px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-line/50 hover:bg-paper/50 transition-colors duration-100">
                    <td className="px-6 py-3 text-[14px] font-medium text-ink">{p.name}</td>
                    <td className="px-4 py-3 text-[14px]">{p.phone || '—'}</td>
                    <td className="px-4 py-3 text-[14px] text-right">{formatCurrency(p.opening_balance)}</td>
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

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Pump' : 'Add Pump'} size="sm" footer={<><Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button onClick={handleSave}>{editing ? 'Save Changes' : 'Add Pump'}</Button></>}>
        <div className="space-y-4">
          <InputField label="Pump Name" placeholder="Krishna Petroleum" value={name} onChange={(e) => setName(e.target.value)} error={formError} autoFocus />
          <InputField label="Phone" type="tel" placeholder="9876001001" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <InputField label="Opening Balance" type="number" placeholder="0" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} hint="Existing credit balance with pump, if any" />
        </div>
      </Modal>
    </div>
  );
}
