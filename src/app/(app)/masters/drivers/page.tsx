'use client';

import { useState } from 'react';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { InputField } from '@/components/Input';
import StatusPill from '@/components/StatusPill';
import Modal from '@/components/Modal';
import EmptyState from '@/components/EmptyState';
import SearchInput from '@/components/SearchInput';
import { getDrivers, saveDriver, toggleDriverActive, syncDriversFromSupabase, deleteDriver } from '@/lib/master-store';
import { generateUUID } from '@/lib/supabase-service';
import { formatCurrency } from '@/lib/format';
import type { Driver } from '@/types/database';
import { useEffect } from 'react';

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setDrivers(getDrivers());
    syncDriversFromSupabase().then(remote => {
      if (remote && remote.length > 0) {
        setDrivers(remote);
      }
    }).catch(() => {});
  }, []);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [licenceNo, setLicenceNo] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [formError, setFormError] = useState('');

  const filtered = drivers.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    (d.phone?.includes(search))
  );

  const openForm = (driver?: Driver) => {
    if (driver) {
      setEditing(driver);
      setName(driver.name);
      setPhone(driver.phone || '');
      setLicenceNo(driver.licence_no || '');
      setOpeningBalance(driver.opening_balance ? String(driver.opening_balance) : '');
    } else {
      setEditing(null);
      setName(''); setPhone(''); setLicenceNo(''); setOpeningBalance('');
    }
    setFormError('');
    setShowForm(true);
  };

  const handleSave = () => {
    if (!name.trim()) { setFormError('Enter driver name'); return; }

    const entry: Driver = {
      id: editing ? editing.id : generateUUID(),
      transport_id: 'a0000000-0000-0000-0000-000000000001',
      name: name.trim(),
      phone: phone || null,
      licence_no: licenceNo || null,
      opening_balance: Number(openingBalance) || 0,
      is_active: editing ? editing.is_active : true,
    };

    const updated = saveDriver(entry);
    setDrivers(updated);
    setShowForm(false);
  };

  const toggleActive = (id: string) => {
    const updated = toggleDriverActive(id);
    setDrivers(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SearchInput
          placeholder="Search drivers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
          wrapperClassName="flex-1 max-w-xs"
        />
        <Button onClick={() => openForm()}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg>
          Add Driver
        </Button>
      </div>

      <Card padding="none">
        {filtered.length === 0 ? (
          <EmptyState title="No drivers found" description={search ? 'Try a different search term.' : 'Add your first driver to get started.'} actionLabel={!search ? 'Add Driver' : undefined} onAction={!search ? () => openForm() : undefined} />
        ) : (
          <div className="overflow-x-auto table-scroll">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left text-[13px] font-medium text-muted px-6 py-3">Name</th>
                  <th className="text-left text-[13px] font-medium text-muted px-4 py-3">Phone</th>
                  <th className="text-left text-[13px] font-medium text-muted px-4 py-3">Licence No</th>
                  <th className="text-right text-[13px] font-medium text-muted px-4 py-3">Opening Balance</th>
                  <th className="text-center text-[13px] font-medium text-muted px-4 py-3">Status</th>
                  <th className="text-right text-[13px] font-medium text-muted px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id} className="border-b border-line/50 hover:bg-paper/50 transition-colors duration-100">
                    <td className="px-6 py-3 text-[14px] font-medium text-ink">{d.name}</td>
                    <td className="px-4 py-3 text-[14px]">{d.phone || '—'}</td>
                    <td className="px-4 py-3 text-[14px]">{d.licence_no || '—'}</td>
                    <td className="px-4 py-3 text-[14px] text-right">{formatCurrency(d.opening_balance)}</td>
                    <td className="px-4 py-3 text-center"><StatusPill status={d.is_active ? 'active' : 'inactive'} /></td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openForm(d)} className="text-[13px] font-medium text-primary hover:underline">Edit</button>
                        <button onClick={() => toggleActive(d.id)} className="text-[13px] font-medium text-muted hover:text-ink">{d.is_active ? 'Deactivate' : 'Activate'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Driver' : 'Add Driver'} size="sm" footer={<><Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button onClick={handleSave}>{editing ? 'Save Changes' : 'Add Driver'}</Button></>}>
        <div className="space-y-4">
          <InputField label="Driver Name" placeholder="Enter full name" value={name} onChange={(e) => setName(e.target.value)} error={formError} autoFocus />
          <InputField label="Phone" type="tel" placeholder="9876543210" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <InputField label="Licence Number" placeholder="GJ03-2019-0045678" value={licenceNo} onChange={(e) => setLicenceNo(e.target.value)} />
          <InputField label="Opening Balance" type="number" placeholder="0" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} hint="Existing balance amount, if any" />
        </div>
      </Modal>
    </div>
  );
}
