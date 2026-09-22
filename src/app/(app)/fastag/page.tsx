'use client';

import { useState, useMemo, useEffect } from 'react';
import Card from '@/components/Card';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import Modal from '@/components/Modal';
import SearchInput from '@/components/SearchInput';
import { TextField, SelectField } from '@/components/Input';
import { formatCurrency, formatDate } from '@/lib/format';
import { getStoredFastag, saveFastag, deleteFastag, getNextFastagNo, syncFastagFromSupabase } from '@/lib/operations-store';
import { getVehicles, syncVehiclesFromSupabase } from '@/lib/master-store';
import { generateUUID } from '@/lib/supabase-service';
import type { Fastag, PaymentMode, Vehicle } from '@/types/database';

const PAYMENT_OPTIONS = [
  { value: 'upi', label: 'UPI' },
  { value: 'cash', label: 'Cash' },
  { value: 'online', label: 'Online / NetBanking' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

const emptyForm = (): Partial<Fastag> => ({
  fastag_no: '',
  date: new Date().toISOString().split('T')[0],
  recharge_amount: undefined,
  payment_mode: 'upi',
  vehicle_no: '',
  note: '',
});

export default function FastagPage() {
  const [records, setRecords] = useState<Fastag[]>([]);
  const [availableVehicles, setAvailableVehicles] = useState<Vehicle[]>([]);
  const [customVehicleMode, setCustomVehicleMode] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Partial<Fastag>>(emptyForm());
  const [autoFastagNo, setAutoFastagNo] = useState<string>('');
  const [editId, setEditId] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    setRecords(getStoredFastag());
    const v = getVehicles();
    setAvailableVehicles(v || []);

    syncFastagFromSupabase().then(remote => {
      if (remote && remote.length > 0) {
        setRecords(remote);
      }
    }).catch(() => {});

    syncVehiclesFromSupabase().then(remoteVehicles => {
      if (remoteVehicles && remoteVehicles.length > 0) {
        setAvailableVehicles(remoteVehicles);
      }
    }).catch(() => {});
  }, []);

  const filtered = useMemo(() => records.filter(r => {
    if (search && !r.fastag_no.toLowerCase().includes(search.toLowerCase()) &&
        !(r.vehicle_no ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    if (dateFrom && r.date < dateFrom) return false;
    if (dateTo && r.date > dateTo) return false;
    return true;
  }), [records, search, dateFrom, dateTo]);

  const totalRecharge = filtered.reduce((s, r) => s + r.recharge_amount, 0);

  function openAdd() {
    setForm(emptyForm());
    setEditId(null);
    setCustomVehicleMode(false);
    setModalError(null);
    const nextNo = getNextFastagNo();
    setAutoFastagNo(nextNo);
    setShowModal(true);
  }

  function openEdit(r: Fastag) {
    setForm({ ...r });
    setEditId(r.id);
    setAutoFastagNo(r.fastag_no);
    const inMaster = availableVehicles.some(v => v.vehicle_no === r.vehicle_no);
    setCustomVehicleMode(!inMaster && Boolean(r.vehicle_no));
    setModalError(null);
    setShowModal(true);
  }

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this FASTag recharge record?')) {
      const updated = deleteFastag(id);
      setRecords([...updated]);
    }
  }

  function handleSave() {
    setModalError(null);
    if (!form.date) {
      setModalError('Please select recharge date');
      return;
    }
    if (form.recharge_amount == null || form.recharge_amount === ('' as unknown as number) || Number(form.recharge_amount) <= 0) {
      setModalError('Please enter a valid recharge amount (₹)');
      return;
    }

    const assignedFastagNo = editId ? (form.fastag_no || autoFastagNo) : (autoFastagNo || getNextFastagNo(form.vehicle_no ?? undefined));

    const entry: Fastag = {
      id: editId ?? generateUUID(),
      transport_id: 'a0000000-0000-0000-0000-000000000001',
      fastag_no: assignedFastagNo,
      date: form.date,
      recharge_amount: Number(form.recharge_amount),
      payment_mode: (form.payment_mode as PaymentMode) ?? 'upi',
      vehicle_no: form.vehicle_no?.trim() || null,
      note: form.note?.trim() || null,
      created_at: new Date().toISOString(),
    };

    const updated = saveFastag(entry);
    setRecords([...updated]);
    setShowModal(false);
  }

  const f = (k: keyof Fastag) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = e.target.value;
    setForm(prev => ({ ...prev, [k]: val }));
  };

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <SearchInput
            placeholder="Search FASTag no. or vehicle..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            wrapperClassName="w-full sm:w-60"
          />
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="text-[13px]" />
          <span className="text-muted text-[13px]">to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="text-[13px]" />
        </div>
        <Button onClick={openAdd}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg>
          Add Recharge
        </Button>
      </div>

      {/* Summary */}
      <div className="flex gap-4 text-[13px]">
        <span className="text-muted">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
        <span className="text-muted">•</span>
        <span>Total Recharged: <strong className="text-ink">{formatCurrency(totalRecharge)}</strong></span>
      </div>

      {/* Table */}
      <Card padding="none">
        {filtered.length === 0 ? (
          <EmptyState title="No FASTag records" description="Add your first FASTag recharge." actionLabel="Add Recharge" onAction={openAdd} />
        ) : (
          <div className="overflow-x-auto table-scroll">
            <table className="w-full min-w-[750px]">
              <thead>
                <tr className="border-b border-line">
                  {['FASTag No.','Date','Vehicle No.','Recharge Amount','UPI / Cash','Note','Action'].map(h => (
                    <th key={h} className="text-left text-[12px] font-medium text-muted px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b border-line/50 hover:bg-paper/50 transition-colors cursor-pointer" onClick={() => openEdit(r)}>
                    <td className="px-4 py-3 text-[13px] font-mono font-semibold text-primary">{r.fastag_no}</td>
                    <td className="px-4 py-3 text-[13px] whitespace-nowrap">{formatDate(r.date)}</td>
                    <td className="px-4 py-3 text-[13px] font-medium">
                      {r.vehicle_no ? (
                        <span className="px-2 py-0.5 rounded bg-paper border border-line font-mono text-[12px]">
                          {r.vehicle_no}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-right font-bold text-ink whitespace-nowrap">{formatCurrency(r.recharge_amount)}</td>
                    <td className="px-4 py-3 text-[13px]">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-paper border border-line capitalize">{r.payment_mode}</span>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-muted max-w-[200px] truncate">{r.note ?? '—'}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(r.id, e)}
                        className="text-muted hover:text-negative p-1 rounded hover:bg-negative/10 transition-colors"
                        title="Delete FASTag recharge record"
                      >
                        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M3 4h10M6 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4M4.5 4v9a1 1 0 001 1h5a1 1 0 001-1V4" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-line bg-paper/50">
                  <td colSpan={3} className="px-4 py-3 text-[13px] font-semibold text-ink">Total</td>
                  <td className="px-4 py-3 text-[13px] text-right font-bold">{formatCurrency(totalRecharge)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Edit FASTag Recharge' : 'Add FASTag Recharge'} size="md">
        <div className="space-y-4">
          {modalError && (
            <div className="p-3 rounded-lg bg-negative/10 border border-negative/30 text-negative text-[13px] font-medium flex items-center gap-2">
              <span>⚠️</span>
              <span>{modalError}</span>
            </div>
          )}

          {/* Auto Generated FASTag ID Banner */}
          <div className="bg-gradient-to-r from-primary/[0.08] via-primary/[0.04] to-paper border border-primary/20 rounded-xl p-3.5 flex items-center justify-between shadow-xs">
            <div>
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">FASTag ID / No. (Auto)</span>
              <span className="text-[17px] font-bold text-primary font-mono mt-0.5 block">{autoFastagNo || 'FT-0005'}</span>
            </div>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-positive/10 text-positive font-medium border border-positive/20 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
              Auto-Generated ID
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TextField label="Date" type="date" value={form.date ?? ''} onChange={f('date')} required />

            {/* Vehicle No. Dropdown from Master */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-[13px] font-medium text-muted">Vehicle No.</label>
                <button
                  type="button"
                  onClick={() => {
                    setCustomVehicleMode(!customVehicleMode);
                    setForm(prev => ({ ...prev, vehicle_no: '' }));
                  }}
                  className="text-[11px] text-primary hover:underline font-medium"
                >
                  {customVehicleMode ? '← Select from master' : '+ Custom vehicle'}
                </button>
              </div>

              {customVehicleMode ? (
                <input
                  type="text"
                  placeholder="e.g. GJ-03-AB-1234"
                  value={form.vehicle_no ?? ''}
                  onChange={f('vehicle_no')}
                  className="w-full px-3 py-2.5 rounded-lg border border-line bg-panel text-[15px] text-ink uppercase placeholder:normal-case focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
              ) : (
                <select
                  value={form.vehicle_no ?? ''}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setCustomVehicleMode(true);
                      setForm(prev => ({ ...prev, vehicle_no: '' }));
                    } else {
                      setForm(prev => ({ ...prev, vehicle_no: e.target.value }));
                    }
                  }}
                  className="w-full px-3 py-2.5 rounded-lg border border-line bg-panel text-[15px] text-ink focus:border-primary focus:ring-1 focus:ring-primary/20"
                >
                  <option value="">Select vehicle from master</option>
                  {availableVehicles.map(v => (
                    <option key={v.id || v.vehicle_no} value={v.vehicle_no}>
                      {v.vehicle_no} ({v.type || 'Truck'})
                    </option>
                  ))}
                  <option value="__custom__">+ Enter custom vehicle...</option>
                </select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TextField
              label="Recharge Amount (₹)"
              type="number"
              value={form.recharge_amount ?? ''}
              onChange={f('recharge_amount')}
              placeholder="5000"
              required
            />
            <SelectField
              label="Payment Mode"
              value={form.payment_mode ?? 'upi'}
              onChange={f('payment_mode')}
              options={PAYMENT_OPTIONS}
            />
          </div>

          <TextField
            label="Note (Optional)"
            value={form.note ?? ''}
            onChange={f('note')}
            placeholder="e.g. Low balance recharge, toll pass, etc."
          />

          <div className="flex justify-end gap-3 pt-2 border-t border-line">
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editId ? 'Save Changes' : 'Add Recharge'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
