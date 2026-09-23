'use client';

import { useState, useMemo, useEffect } from 'react';
import Card from '@/components/Card';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import Modal from '@/components/Modal';
import SearchInput from '@/components/SearchInput';
import { TextField, SelectField } from '@/components/Input';
import { formatCurrency, formatDate } from '@/lib/format';
import { getStoredMaintenance, saveMaintenance, deleteMaintenance, syncMaintenanceFromSupabase } from '@/lib/operations-store';
import { getVehicles, syncVehiclesFromSupabase } from '@/lib/master-store';
import { generateUUID } from '@/lib/supabase-service';
import type { Maintenance, PaymentMode, Vehicle } from '@/types/database';
import { useToast } from '@/components/Toast';

const PAYMENT_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'online', label: 'Online' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

const QUICK_WORK_TAGS = [
  'Tyre Replacement',
  'Oil & Filter Service',
  'Brake Pad Replacement',
  'AC Repair & Gas',
  'Battery Replacement',
  'Greasing & Wash',
];

const emptyForm = (): Partial<Maintenance> => ({
  date: new Date().toISOString().split('T')[0],
  vehicle_no: '',
  work_part: '',
  amount: undefined,
  paid_to: '',
  payment_method: 'cash',
  bill_receipt_no: '',
  note: '',
});

export default function MaintenancePage() {
  const toast = useToast();
  const [records, setRecords] = useState<Maintenance[]>([]);
  const [availableVehicles, setAvailableVehicles] = useState<Vehicle[]>([]);
  const [customVehicleMode, setCustomVehicleMode] = useState(false);
  const [search, setSearch] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Partial<Maintenance>>(emptyForm());
  const [editId, setEditId] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    setRecords(getStoredMaintenance());
    const v = getVehicles();
    setAvailableVehicles(v || []);

    syncMaintenanceFromSupabase().then(remote => {
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

  const vehicles = useMemo(() => {
    const list = new Set(records.map(r => r.vehicle_no));
    availableVehicles.forEach(v => list.add(v.vehicle_no));
    return [...list].filter(Boolean);
  }, [records, availableVehicles]);

  const filtered = useMemo(() => records.filter(r => {
    if (search && !r.work_part.toLowerCase().includes(search.toLowerCase()) &&
        !r.vehicle_no.toLowerCase().includes(search.toLowerCase()) &&
        !(r.paid_to ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    if (vehicleFilter && r.vehicle_no !== vehicleFilter) return false;
    if (methodFilter && (r.payment_method || 'cash') !== methodFilter) return false;
    if (dateFrom && r.date < dateFrom) return false;
    if (dateTo && r.date > dateTo) return false;
    return true;
  }), [records, search, vehicleFilter, methodFilter, dateFrom, dateTo]);

  const totalAmount = filtered.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const overallTotal = useMemo(
    () => records.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [records],
  );

  const vehicleBreakdown = useMemo(() => {
    const map = new Map<string, { sum: number; count: number }>();
    for (const r of records) {
      const key = r.vehicle_no || '—';
      const cur = map.get(key) ?? { sum: 0, count: 0 };
      cur.sum += Number(r.amount) || 0;
      cur.count += 1;
      map.set(key, cur);
    }
    return [...map.entries()]
      .map(([label, v]) => ({ label, sum: v.sum, count: v.count }))
      .sort((a, b) => b.sum - a.sum);
  }, [records]);

  const methodBreakdown = useMemo(() => {
    const map = new Map<string, { sum: number; count: number }>();
    for (const r of records) {
      const key = (r.payment_method || 'cash').toLowerCase();
      const cur = map.get(key) ?? { sum: 0, count: 0 };
      cur.sum += Number(r.amount) || 0;
      cur.count += 1;
      map.set(key, cur);
    }
    return [...map.entries()]
      .map(([key, v]) => ({
        key,
        label: PAYMENT_OPTIONS.find(o => o.value === key)?.label || key,
        sum: v.sum,
        count: v.count,
      }))
      .sort((a, b) => b.sum - a.sum);
  }, [records]);

  const averageAmount = records.length > 0 ? overallTotal / records.length : 0;

  function openAdd() {
    setForm(emptyForm());
    setEditId(null);
    setCustomVehicleMode(false);
    setModalError(null);
    setShowModal(true);
  }

  function openEdit(r: Maintenance) {
    setForm({ ...r });
    setEditId(r.id);
    const inMaster = availableVehicles.some(v => v.vehicle_no === r.vehicle_no);
    setCustomVehicleMode(!inMaster && Boolean(r.vehicle_no));
    setModalError(null);
    setShowModal(true);
  }

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this maintenance record?')) {
      const updated = deleteMaintenance(id);
      setRecords([...updated]);
      toast.success('Maintenance record deleted');
    }
  }

  function handleSave() {
    setModalError(null);
    if (!form.date) {
      setModalError('Please select date');
      return;
    }
    if (!form.vehicle_no || !form.vehicle_no.trim()) {
      setModalError('Please select or enter vehicle number');
      return;
    }
    if (!form.work_part || !form.work_part.trim()) {
      setModalError('Please enter maintenance work or part description');
      return;
    }
    if (form.amount == null || form.amount === ('' as unknown as number) || Number(form.amount) <= 0) {
      setModalError('Please enter a valid amount (₹)');
      return;
    }

    const entry: Maintenance = {
      id: editId ?? generateUUID(),
      transport_id: 'a0000000-0000-0000-0000-000000000001',
      date: form.date,
      vehicle_no: form.vehicle_no.trim(),
      work_part: form.work_part.trim(),
      amount: Number(form.amount),
      paid_to: form.paid_to?.trim() || null,
      payment_method: (form.payment_method as PaymentMode) ?? 'cash',
      bill_receipt_no: form.bill_receipt_no?.trim() || null,
      note: form.note?.trim() || null,
      created_at: new Date().toISOString(),
    };

    const updated = saveMaintenance(entry);
    setRecords([...updated]);
    setShowModal(false);
    toast.success(editId ? 'Maintenance record updated' : 'Maintenance record added', {
      message: `${entry.vehicle_no} · ${entry.work_part} · ${formatCurrency(entry.amount)}`,
    });
  }

  const f = (k: keyof Maintenance) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap filter-bar min-w-0 w-full">
          <SearchInput
            placeholder="Search work, vehicle, vendor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            wrapperClassName="w-full sm:w-64"
          />
          <select value={vehicleFilter} onChange={e => setVehicleFilter(e.target.value)} className="text-[13px] sm:w-auto">
            <option value="">All Vehicles</option>
            {vehicles.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <div className="filter-inline flex items-center gap-2 w-full sm:w-auto">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="text-[13px] min-w-0" />
            <span className="text-muted text-[13px] shrink-0">to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="text-[13px] min-w-0" />
          </div>
        </div>
        <Button onClick={openAdd} className="w-full sm:w-auto">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg>
          Add Record
        </Button>
      </div>

      {/* Totals — same card style as Payment */}
      <div className="grid grid-cols-1 min-[481px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-line bg-panel p-4 shadow-sm border-l-4 border-l-negative">
          <p className="text-[11px] text-negative uppercase tracking-wider font-bold">Total Maintenance</p>
          <p className="text-[22px] font-bold text-negative mt-1">{formatCurrency(overallTotal)}</p>
          <p className="text-[11px] text-muted mt-1">Across all {records.length} records</p>
        </div>
        <div className="rounded-xl border border-line bg-panel p-4 shadow-sm">
          <p className="text-[11px] text-muted uppercase tracking-wider font-semibold">Showing Now</p>
          <p className="text-[22px] font-bold text-ink mt-1">{formatCurrency(totalAmount)}</p>
          <p className="text-[11px] text-muted mt-1">{filtered.length} record{filtered.length === 1 ? '' : 's'} in current filter</p>
        </div>
        <div className="rounded-xl border border-line bg-panel p-4 shadow-sm">
          <p className="text-[11px] text-muted uppercase tracking-wider font-semibold">Vehicles</p>
          <p className="text-[22px] font-bold text-primary mt-1">{vehicleBreakdown.length}</p>
          <p className="text-[11px] text-muted mt-1">Vehicles with maintenance</p>
        </div>
        <div className="rounded-xl border border-line bg-panel p-4 shadow-sm">
          <p className="text-[11px] text-muted uppercase tracking-wider font-semibold">Average Bill</p>
          <p className="text-[22px] font-bold text-ink mt-1">{formatCurrency(averageAmount)}</p>
          <p className="text-[11px] text-muted mt-1">Per maintenance record</p>
        </div>
      </div>

      {vehicleBreakdown.length > 0 && (
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">Vehicle-wise Maintenance</h2>
              <p className="text-[12px] text-muted">Click a vehicle to filter the list below</p>
            </div>
            {(vehicleFilter || methodFilter) && (
              <button
                type="button"
                onClick={() => { setVehicleFilter(''); setMethodFilter(''); }}
                className="text-[12px] font-medium text-primary hover:underline self-start sm:self-auto"
              >
                Reset Filter (Show All)
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 min-[481px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {vehicleBreakdown.map(item => {
              const selected = vehicleFilter === item.label;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setVehicleFilter(selected ? '' : item.label)}
                  className={`text-left p-3 rounded-xl border transition-all duration-150 ${
                    selected
                      ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary'
                      : 'border-line/70 bg-paper/60 hover:bg-paper hover:border-line'
                  }`}
                >
                  <span className="text-[12px] font-bold text-ink truncate block" title={item.label}>{item.label}</span>
                  <p className="text-[16px] font-bold text-negative mt-1">{formatCurrency(item.sum)}</p>
                  <p className="text-[11px] text-muted mt-0.5">{item.count} {item.count === 1 ? 'record' : 'records'}</p>
                </button>
              );
            })}
          </div>

          {methodBreakdown.length > 0 && (
            <div className="mt-4 pt-4 border-t border-line">
              <h3 className="text-[13px] font-semibold text-ink mb-2">Payment method totals</h3>
              <div className="grid grid-cols-1 min-[481px]:grid-cols-2 sm:grid-cols-4 gap-3">
                {methodBreakdown.map(item => {
                  const selected = methodFilter === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setMethodFilter(selected ? '' : item.key)}
                      className={`text-left p-3 rounded-xl border transition-all duration-150 ${
                        selected
                          ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary'
                          : 'border-line/70 bg-paper/60 hover:bg-paper hover:border-line'
                      }`}
                    >
                      <span className="text-[12px] font-bold text-ink">{item.label}</span>
                      <p className="text-[16px] font-bold text-ink mt-1">{formatCurrency(item.sum)}</p>
                      <p className="text-[11px] text-muted mt-0.5">{item.count} {item.count === 1 ? 'payment' : 'payments'}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Table */}
      <Card padding="none">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line bg-paper/70">
          <span className="text-[13px] font-bold text-ink">Total ({filtered.length} {filtered.length === 1 ? 'entry' : 'entries'})</span>
          <span className="text-[16px] font-bold text-negative whitespace-nowrap">{formatCurrency(totalAmount)}</span>
        </div>
        {filtered.length === 0 ? (
          <EmptyState title="No maintenance records" description="Add the first maintenance record." actionLabel="Add Record" onAction={openAdd} />
        ) : (
          <div className="overflow-x-auto table-scroll">
            <table className="w-full min-w-[950px]">
              <thead>
                <tr className="border-b border-line">
                  {['Date','Vehicle No.','Maintenance Work / Part','Amount','Paid To','Payment Method','Bill / Receipt No.','Note','Action'].map(h => (
                    <th key={h} className="text-left text-[12px] font-medium text-muted px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b border-line/50 hover:bg-paper/50 transition-colors cursor-pointer" onClick={() => openEdit(r)}>
                    <td className="px-4 py-3 text-[13px] whitespace-nowrap">{formatDate(r.date)}</td>
                    <td className="px-4 py-3 text-[13px] font-medium whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-paper border border-line font-mono text-[12px]">
                        {r.vehicle_no}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] font-medium text-ink">{r.work_part}</td>
                    <td className="px-4 py-3 text-[13px] text-right font-bold text-negative whitespace-nowrap">{formatCurrency(r.amount)}</td>
                    <td className="px-4 py-3 text-[13px] whitespace-nowrap text-muted">{r.paid_to ?? '—'}</td>
                    <td className="px-4 py-3 text-[13px]">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-paper border border-line capitalize">{r.payment_method ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-[13px] font-mono text-muted">{r.bill_receipt_no ?? '—'}</td>
                    <td className="px-4 py-3 text-[13px] text-muted max-w-[200px] truncate">{r.note ?? '—'}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(r.id, e)}
                        className="text-muted hover:text-negative p-1 rounded hover:bg-negative/10 transition-colors"
                        title="Delete maintenance record"
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
                <tr className="border-t-2 border-line bg-paper/70 font-semibold">
                  <td colSpan={3} className="px-4 py-3.5 text-[13px] font-bold text-ink">
                    Total Maintenance ({filtered.length} Entries)
                  </td>
                  <td className="px-4 py-3.5 text-[13px] text-right font-bold text-negative">{formatCurrency(totalAmount)}</td>
                  <td colSpan={5} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Edit Maintenance Record' : 'Add Maintenance Record'} size="lg">
        <div className="space-y-4">
          {modalError && (
            <div className="p-3 rounded-lg bg-negative/10 border border-negative/30 text-negative text-[13px] font-medium flex items-center gap-2">
              <span>⚠️</span>
              <span>{modalError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 min-[481px]:grid-cols-2 gap-4">
            <TextField label="Date" type="date" value={form.date ?? ''} onChange={f('date')} required />

            {/* Vehicle No. Dropdown from Master */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-[13px] font-medium text-muted">
                  Vehicle No. <span className="text-negative">*</span>
                </label>
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
                  required
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
                  required
                >
                  <option value="">Select vehicle from master</option>
                  {availableVehicles.map(v => (
                    <option key={v.id || v.vehicle_no} value={v.vehicle_no}>
                      {v.vehicle_no} {((v as any).type || (v as any).model) ? `(${((v as any).type || (v as any).model)})` : ''}
                    </option>
                  ))}
                  <option value="__custom__">+ Enter custom vehicle...</option>
                </select>
              )}
            </div>
          </div>

          {/* Maintenance Work / Part — Full Width Crisp Box with Suggestions */}
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-muted">
              Maintenance Work / Part <span className="text-negative">*</span>
            </label>
            <input
              type="text"
              list="maintenance-part-suggestions"
              value={form.work_part ?? ''}
              onChange={f('work_part')}
              placeholder="e.g. Tyre Replacement (Front Left), Oil Filter, Brake Pad..."
              className="w-full px-3 py-2.5 rounded-lg border border-line bg-panel text-[15px] text-ink placeholder:text-muted/60 focus:border-primary focus:ring-1 focus:ring-primary/20"
              required
            />
            <datalist id="maintenance-part-suggestions">
              <option value="Tyre Replacement (Front Left)" />
              <option value="Tyre Replacement (Front Right)" />
              <option value="Tyre Replacement (Rear)" />
              <option value="Oil Filter + Engine Oil Change" />
              <option value="Brake Pad Replacement" />
              <option value="AC Compressor Repair & Gas Refill" />
              <option value="Clutch Plate Replacement" />
              <option value="Battery Replacement" />
              <option value="Leaf Spring (Patta) Repair" />
              <option value="Greasing & Vehicle Wash" />
              <option value="Electrical & Wiring Repair" />
              <option value="Diesel Filter Change" />
            </datalist>

            {/* Quick click tags */}
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span className="text-[11px] text-muted mr-0.5">Quick fill:</span>
              {QUICK_WORK_TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, work_part: tag }))}
                  className="px-2 py-0.5 rounded text-[11px] bg-paper hover:bg-primary/10 hover:text-primary text-muted border border-line transition-colors"
                >
                  + {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 min-[481px]:grid-cols-2 gap-4">
            <TextField
              label="Amount (₹)"
              type="number"
              value={form.amount ?? ''}
              onChange={f('amount')}
              placeholder="18500"
              required
            />
            <TextField
              label="Paid To (Optional)"
              value={form.paid_to ?? ''}
              onChange={f('paid_to')}
              placeholder="Rajesh Tyre Works / Workshop"
              hint="Vendor or mechanic shop name"
            />
          </div>

          <div className="grid grid-cols-1 min-[481px]:grid-cols-2 gap-4">
            <SelectField
              label="Payment Method"
              value={form.payment_method ?? 'cash'}
              onChange={f('payment_method')}
              options={PAYMENT_OPTIONS}
            />
            <TextField
              label="Bill / Receipt No. (Optional)"
              value={form.bill_receipt_no ?? ''}
              onChange={f('bill_receipt_no')}
              placeholder="RTW/2026/0341"
              hint="Bill / invoice number if available"
            />
          </div>

          <TextField
            label="Note (Optional)"
            value={form.note ?? ''}
            onChange={f('note')}
            placeholder="Additional instructions or repair details..."
          />

          <div className="flex justify-end gap-3 pt-2 border-t border-line">
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editId ? 'Save Changes' : 'Add Record'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
