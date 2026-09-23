'use client';

import { useState, useMemo, useEffect } from 'react';
import Card from '@/components/Card';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import Modal from '@/components/Modal';
import SearchInput from '@/components/SearchInput';
import { TextField, SelectField } from '@/components/Input';
import { formatCurrency, formatDate } from '@/lib/format';
import { getStoredInvestments, saveInvestment, syncInvestmentsFromSupabase } from '@/lib/operations-store';
import type { Investment, InvestmentCategory, PaymentMode } from '@/types/database';
import { useToast } from '@/components/Toast';

const CATEGORY_OPTIONS: { value: InvestmentCategory; label: string }[] = [
  { value: 'vehicle_purchase', label: 'Vehicle Purchase' },
  { value: 'vehicle_insurance', label: 'Vehicle Insurance' },
  { value: 'vehicle_fitness', label: 'Vehicle Fitness' },
  { value: 'vehicle_permit', label: 'Vehicle Permit' },
  { value: 'tyre', label: 'Tyre' },
  { value: 'battery', label: 'Battery' },
  { value: 'tool_equipment', label: 'Tool / Equipment' },
  { value: 'office_expense', label: 'Office Expense' },
  { value: 'other', label: 'Other' },
];

const PAYMENT_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'online', label: 'Online' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

const CATEGORY_COLORS: Record<InvestmentCategory, string> = {
  vehicle_purchase: 'text-purple-600 bg-purple-50 border-purple-200',
  vehicle_insurance: 'text-blue-600 bg-blue-50 border-blue-200',
  vehicle_fitness: 'text-cyan-600 bg-cyan-50 border-cyan-200',
  vehicle_permit: 'text-indigo-600 bg-indigo-50 border-indigo-200',
  tyre: 'text-orange-600 bg-orange-50 border-orange-200',
  battery: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  tool_equipment: 'text-gray-600 bg-gray-50 border-gray-200',
  office_expense: 'text-green-600 bg-green-50 border-green-200',
  other: 'text-muted bg-paper border-line',
};

const emptyForm = (): Partial<Investment> => ({
  date: new Date().toISOString().split('T')[0],
  category: 'other',
  description: '',
  vehicle_no: '',
  amount: undefined,
  payment_mode: 'cash',
  paid_to: '',
  bill_receipt_no: '',
  note: '',
});

export default function InvestmentPage() {
  const toast = useToast();
  const [records, setRecords] = useState<Investment[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Partial<Investment>>(emptyForm());
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    setRecords(getStoredInvestments());
    syncInvestmentsFromSupabase().then(remote => {
      if (remote && remote.length > 0) setRecords(remote);
    }).catch(() => {});
  }, []);

  const filtered = useMemo(() => records.filter(r => {
    if (search && !r.description.toLowerCase().includes(search.toLowerCase()) &&
        !(r.vehicle_no ?? '').toLowerCase().includes(search.toLowerCase()) &&
        !(r.paid_to ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter && r.category !== categoryFilter) return false;
    return true;
  }), [records, search, categoryFilter]);

  const totalAmount = filtered.reduce((s, r) => s + r.amount, 0);

  // Group by category for summary
  const byCategory = useMemo(() => {
    const map: Partial<Record<InvestmentCategory, number>> = {};
    filtered.forEach(r => { map[r.category] = (map[r.category] ?? 0) + r.amount; });
    return Object.entries(map) as [InvestmentCategory, number][];
  }, [filtered]);

  function openAdd() { setForm(emptyForm()); setEditId(null); setShowModal(true); }
  function openEdit(r: Investment) { setForm({ ...r }); setEditId(r.id); setShowModal(true); }

  function handleSave() {
    if (!form.date || !form.description || !form.amount) {
      toast.error('Some details are missing', { message: 'Please fill Date, Description and Amount.' });
      return;
    }
    const entry: Investment = {
      id: editId ?? `inv${Date.now()}`,
      transport_id: 't1',
      date: form.date!,
      category: (form.category as InvestmentCategory) ?? 'other',
      description: form.description!,
      vehicle_no: form.vehicle_no ?? null,
      amount: Number(form.amount),
      payment_mode: (form.payment_mode as PaymentMode) ?? 'cash',
      paid_to: form.paid_to ?? null,
      bill_receipt_no: form.bill_receipt_no ?? null,
      note: form.note ?? null,
      created_at: new Date().toISOString(),
    };
    const updated = saveInvestment(entry);
    setRecords(updated);
    setShowModal(false);
    toast.success(editId ? 'Investment updated' : 'Investment added', {
      message: `${entry.description} · ${formatCurrency(entry.amount)}`,
    });
  }

  const f = (k: keyof Investment) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const getCategoryLabel = (cat: InvestmentCategory) =>
    CATEGORY_OPTIONS.find(o => o.value === cat)?.label ?? cat;

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap filter-bar min-w-0 w-full">
          <SearchInput
            placeholder="Search description, vehicle, vendor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            wrapperClassName="w-full sm:w-64"
          />
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="text-[13px] sm:w-auto">
            <option value="">All Categories</option>
            {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <Button onClick={openAdd} className="w-full sm:w-auto">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg>
          Add Investment
        </Button>
      </div>

      {/* Summary row */}
      <div className="flex gap-4 text-[13px] flex-wrap">
        <span className="text-muted">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
        <span className="text-muted">•</span>
        <span>Total: <strong className="text-ink">{formatCurrency(totalAmount)}</strong></span>
      </div>

      {/* Category breakdown */}
      {byCategory.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {byCategory.sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
            <div key={cat} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[12px] font-medium ${CATEGORY_COLORS[cat]}`}>
              <span>{getCategoryLabel(cat)}</span>
              <span className="font-bold">{formatCurrency(amt)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <Card padding="none">
        {filtered.length === 0 ? (
          <EmptyState title="No investment records" description="Add your first investment entry." actionLabel="Add Investment" onAction={openAdd} />
        ) : (
          <div className="overflow-x-auto table-scroll">
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="border-b border-line">
                  {['Date','Category','Description','Vehicle No.','Amount','Payment Mode','Paid To','Bill / Receipt No.','Note'].map(h => (
                    <th key={h} className="text-left text-[12px] font-medium text-muted px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b border-line/50 hover:bg-paper/50 transition-colors cursor-pointer" onClick={() => openEdit(r)}>
                    <td className="px-4 py-3 text-[13px] whitespace-nowrap">{formatDate(r.date)}</td>
                    <td className="px-4 py-3 text-[13px]">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium border ${CATEGORY_COLORS[r.category]}`}>
                        {getCategoryLabel(r.category)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px]">{r.description}</td>
                    <td className="px-4 py-3 text-[13px] font-medium">{r.vehicle_no ?? '—'}</td>
                    <td className="px-4 py-3 text-[13px] text-right font-semibold whitespace-nowrap">{formatCurrency(r.amount)}</td>
                    <td className="px-4 py-3 text-[13px]">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-paper border border-line capitalize">{r.payment_mode.replace('_', ' ')}</span>
                    </td>
                    <td className="px-4 py-3 text-[13px]">{r.paid_to ?? '—'}</td>
                    <td className="px-4 py-3 text-[13px] font-mono text-muted">{r.bill_receipt_no ?? '—'}</td>
                    <td className="px-4 py-3 text-[13px] text-muted max-w-[160px] truncate">{r.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-line bg-paper/50">
                  <td colSpan={4} className="px-4 py-3 text-[13px] font-semibold text-ink">Total</td>
                  <td className="px-4 py-3 text-[13px] text-right font-bold">{formatCurrency(totalAmount)}</td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Edit Investment' : 'Add Investment'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 min-[481px]:grid-cols-2 gap-4">
            <TextField label="Date" type="date" value={form.date ?? ''} onChange={f('date')} required />
            <SelectField label="Category" value={form.category ?? 'other'} onChange={f('category')} options={CATEGORY_OPTIONS} />
          </div>
          <TextField label="Description / Item" value={form.description ?? ''} onChange={f('description')} placeholder="Tyre set replacement (6 tyres)" required />
          <div className="grid grid-cols-1 min-[481px]:grid-cols-2 gap-4">
            <TextField label="Vehicle No. (if applicable)" value={form.vehicle_no ?? ''} onChange={f('vehicle_no')} placeholder="GJ-03-AB-1234" />
            <TextField label="Amount (₹)" type="number" value={form.amount ?? ''} onChange={f('amount')} placeholder="111000" required />
          </div>
          <div className="grid grid-cols-1 min-[481px]:grid-cols-2 gap-4">
            <SelectField label="Payment Mode" value={form.payment_mode ?? 'cash'} onChange={f('payment_mode')} options={PAYMENT_OPTIONS} />
            <TextField label="Paid To / Vendor" value={form.paid_to ?? ''} onChange={f('paid_to')} placeholder="MRF Tyre Depot" />
          </div>
          <div className="grid grid-cols-1 min-[481px]:grid-cols-2 gap-4">
            <TextField label="Bill / Receipt No." value={form.bill_receipt_no ?? ''} onChange={f('bill_receipt_no')} placeholder="MRF/2026/0987" />
            <TextField label="Note" value={form.note ?? ''} onChange={f('note')} placeholder="Additional notes..." />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editId ? 'Save Changes' : 'Add Investment'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
