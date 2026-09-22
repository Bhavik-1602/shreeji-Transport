'use client';

import { useState } from 'react';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { InputField, SelectField } from '@/components/Input';
import Modal from '@/components/Modal';
import EmptyState from '@/components/EmptyState';
import { getBankAccounts, saveBankAccount, deleteBankAccount, syncBankAccountsFromSupabase } from '@/lib/master-store';
import type { BankAccount, BankAccountType } from '@/types/database';
import { useEffect } from 'react';

export default function BankAccountsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>(() => getBankAccounts());
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setAccounts(getBankAccounts());
    syncBankAccountsFromSupabase().then(remote => {
      if (remote && remote.length > 0) setAccounts([...remote]);
    });
  }, []);

  const [label, setLabel] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [accountType, setAccountType] = useState<BankAccountType>('bank');
  const [formError, setFormError] = useState('');

  const filtered = accounts.filter(a =>
    a.label.toLowerCase().includes(search.toLowerCase()) ||
    (a.bank_name?.toLowerCase().includes(search.toLowerCase()))
  );

  const openForm = (account?: BankAccount) => {
    if (account) {
      setEditing(account);
      setLabel(account.label);
      setBankName(account.bank_name || '');
      setAccountHolder(account.account_holder || '');
      setAccountType(account.type);
    } else {
      setEditing(null);
      setLabel(''); setBankName(''); setAccountHolder(''); setAccountType('bank');
    }
    setFormError('');
    setShowForm(true);
  };

  const handleSave = () => {
    if (!label.trim()) { setFormError('Enter account label'); return; }
    const entry: BankAccount = {
      id: editing ? editing.id : `ba-${Date.now()}`,
      transport_id: 'a0000000-0000-0000-0000-000000000001',
      label: label.trim(),
      bank_name: bankName || null,
      account_holder: accountHolder || null,
      type: accountType,
    };
    const updated = saveBankAccount(entry);
    setAccounts(updated);
    setShowForm(false);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete bank account "${name}"?`)) {
      const updated = deleteBankAccount(id);
      setAccounts(updated);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-xs">
          <input type="text" placeholder="Search accounts..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="7" cy="7" r="5" /><path d="M11 11l3 3" /></svg>
        </div>
        <Button onClick={() => openForm()}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg>
          Add Account
        </Button>
      </div>

      <Card padding="none">
        {filtered.length === 0 ? (
          <EmptyState title="No bank accounts found" description={search ? 'Try a different search term.' : 'Add your first bank account to get started.'} actionLabel={!search ? 'Add Account' : undefined} onAction={!search ? () => openForm() : undefined} />
        ) : (
          <div className="overflow-x-auto table-scroll">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left text-[13px] font-medium text-muted px-6 py-3">Label</th>
                  <th className="text-left text-[13px] font-medium text-muted px-4 py-3">Bank Name</th>
                  <th className="text-left text-[13px] font-medium text-muted px-4 py-3">Account Holder</th>
                  <th className="text-left text-[13px] font-medium text-muted px-4 py-3">Type</th>
                  <th className="text-right text-[13px] font-medium text-muted px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className="border-b border-line/50 hover:bg-paper/50 transition-colors duration-100">
                    <td className="px-6 py-3 text-[14px] font-medium text-ink">{a.label}</td>
                    <td className="px-4 py-3 text-[14px]">{a.bank_name || '—'}</td>
                    <td className="px-4 py-3 text-[14px]">{a.account_holder || '—'}</td>
                    <td className="px-4 py-3 text-[14px]">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[12px] font-medium ${a.type === 'bank' ? 'bg-online/10 text-online' : 'bg-cash/10 text-cash'}`}>
                        {a.type === 'bank' ? 'Bank' : 'Cash'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => openForm(a)} className="text-[13px] font-medium text-primary hover:underline">Edit</button>
                        <button onClick={() => handleDelete(a.id, a.label)} className="text-[13px] font-medium text-negative hover:underline">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Account' : 'Add Account'} size="sm" footer={<><Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button onClick={handleSave}>{editing ? 'Save Changes' : 'Add Account'}</Button></>}>
        <div className="space-y-4">
          <InputField label="Account Label" placeholder="Main Business Account" value={label} onChange={(e) => setLabel(e.target.value)} error={formError} autoFocus />
          <SelectField label="Account Type" value={accountType} onChange={(e) => setAccountType(e.target.value as BankAccountType)} options={[{ value: 'bank', label: 'Bank Account' }, { value: 'cash', label: 'Cash Counter' }]} />
          {accountType === 'bank' && (
            <>
              <InputField label="Bank Name" placeholder="State Bank of India" value={bankName} onChange={(e) => setBankName(e.target.value)} />
              <InputField label="Account Holder" placeholder="Shreeji Transport" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} />
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
