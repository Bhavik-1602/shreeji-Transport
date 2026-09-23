'use client';

import { useState, useMemo, useEffect } from 'react';
import Card from '@/components/Card';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import Modal from '@/components/Modal';
import SearchInput from '@/components/SearchInput';
import { TextField } from '@/components/Input';
import { formatCurrency, formatDate } from '@/lib/format';
import { getStoredDriverSummaries, saveDriverSummary, deleteDriverSummary, syncDriverSummariesFromSupabase, syncDriverSummariesFromTrips } from '@/lib/operations-store';
import { getStoredTrips, syncTripsFromSupabase } from '@/lib/trip-store';
import { generateUUID } from '@/lib/supabase-service';
import type { DriverSummary } from '@/types/database';
import { useToast } from '@/components/Toast';

const emptyForm = (): Partial<DriverSummary> => ({
  date: new Date().toISOString().split('T')[0],
  vehicle_no: '',
  driver_name: '',
  silik_amount: undefined,
  note: '',
});

export default function DriverSummaryPage() {
  const toast = useToast();
  const [records, setRecords] = useState<DriverSummary[]>([]);
  const [search, setSearch] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Partial<DriverSummary>>(emptyForm());
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => {
      const trips = getStoredTrips();
      if (trips.length > 0) syncDriverSummariesFromTrips(trips);
      setRecords(getStoredDriverSummaries());
    };

    refresh();

    Promise.all([
      syncDriverSummariesFromSupabase().catch(() => null),
      syncTripsFromSupabase().catch(() => null),
    ]).then(() => {
      const trips = getStoredTrips();
      if (trips.length > 0) syncDriverSummariesFromTrips(trips);
      setRecords(getStoredDriverSummaries());
    });

    window.addEventListener('shreeji_operations_updated', refresh);
    window.addEventListener('shreeji_trips_updated', refresh);
    return () => {
      window.removeEventListener('shreeji_operations_updated', refresh);
      window.removeEventListener('shreeji_trips_updated', refresh);
    };
  }, []);

  // Distinct lists for dropdown filters
  const driverList = useMemo(() => [...new Set(records.map(r => r.driver_name).filter(Boolean))].sort(), [records]);
  const vehicleList = useMemo(() => [...new Set(records.map(r => r.vehicle_no).filter(Boolean))].sort(), [records]);

  // Filtered records
  const filtered = useMemo(() => {
    return records.filter(r => {
      if (search && !r.driver_name.toLowerCase().includes(search.toLowerCase()) &&
          !r.vehicle_no.toLowerCase().includes(search.toLowerCase()) &&
          !(r.note ?? '').toLowerCase().includes(search.toLowerCase())) return false;
      if (driverFilter && r.driver_name !== driverFilter) return false;
      if (vehicleFilter && r.vehicle_no !== vehicleFilter) return false;
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo && r.date > dateTo) return false;
      return true;
    }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [records, search, driverFilter, vehicleFilter, dateFrom, dateTo]);

  // Totals & aggregations
  const totalSilik = filtered.reduce((s, r) => s + (r.silik_amount ?? 0), 0);

  // Per-driver breakdown
  const driverBreakdown = useMemo(() => {
    const map: Record<string, { total: number; count: number; vehicles: Set<string> }> = {};
    filtered.forEach(r => {
      const name = r.driver_name;
      if (!map[name]) {
        map[name] = { total: 0, count: 0, vehicles: new Set() };
      }
      map[name].total += r.silik_amount ?? 0;
      map[name].count += 1;
      if (r.vehicle_no) map[name].vehicles.add(r.vehicle_no);
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [filtered]);

  function openAdd() {
    setForm(emptyForm());
    setEditId(null);
    setShowModal(true);
  }

  function openEdit(r: DriverSummary) {
    setForm({ ...r });
    setEditId(r.id);
    setShowModal(true);
  }

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this driver silik record?')) {
      const updated = deleteDriverSummary(id);
      setRecords(updated);
      toast.success('Silik record deleted');
    }
  }

  function handleSave() {
    if (!form.date || !form.vehicle_no || !form.driver_name || form.silik_amount == null) {
      toast.error('Some details are missing', { message: 'Please fill Date, Vehicle, Driver and Silik Amount.' });
      return;
    }
    const entry: DriverSummary = {
      id: editId ?? generateUUID(),
      transport_id: 'a0000000-0000-0000-0000-000000000001',
      date: form.date,
      vehicle_no: form.vehicle_no,
      driver_name: form.driver_name,
      silik_amount: Number(form.silik_amount) || 0,
      note: form.note || null,
      created_at: new Date().toISOString(),
    };

    const updated = saveDriverSummary(entry);
    setRecords(updated);
    setShowModal(false);
    toast.success(editId ? 'Silik record updated' : 'Silik record added', {
      message: `${entry.driver_name} · ${formatCurrency(entry.silik_amount)}`,
    });
  }

  const f = (k: keyof DriverSummary) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="space-y-6">
      {/* Top action & filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap filter-bar min-w-0 w-full">
          <SearchInput
            placeholder="Search driver, vehicle, note..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            wrapperClassName="w-full sm:w-60"
          />

          <select
            value={driverFilter}
            onChange={e => setDriverFilter(e.target.value)}
            className="text-[13px] sm:w-auto"
          >
            <option value="">All Drivers</option>
            {driverList.map(d => <option key={d} value={d}>{d}</option>)}
          </select>

          <select
            value={vehicleFilter}
            onChange={e => setVehicleFilter(e.target.value)}
            className="text-[13px] sm:w-auto"
          >
            <option value="">All Vehicles</option>
            {vehicleList.map(v => <option key={v} value={v}>{v}</option>)}
          </select>

          <div className="filter-inline flex items-center gap-2 w-full sm:w-auto">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="text-[13px] min-w-0" />
            <span className="text-muted text-[13px] shrink-0">to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="text-[13px] min-w-0" />
          </div>
        </div>

        <Button onClick={openAdd} className="w-full sm:w-auto">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M8 3v10M3 8h10" />
          </svg>
          Add Silik Record
        </Button>
      </div>

      {/* Driver Silik KPI Cards */}
      <div className="grid grid-cols-1 min-[481px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-line bg-panel p-4">
          <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">Total Silik Paid</p>
          <p className="text-[22px] font-bold text-ink mt-1">{formatCurrency(totalSilik)}</p>
          <p className="text-[11px] text-muted mt-1">{filtered.length} entries recorded</p>
        </div>
        <div className="rounded-xl border border-line bg-panel p-4">
          <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">Drivers Count</p>
          <p className="text-[22px] font-bold text-ink mt-1">{driverBreakdown.length}</p>
          <p className="text-[11px] text-muted mt-1">Drivers with silik</p>
        </div>
        <div className="rounded-xl border border-line bg-panel p-4">
          <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">Avg. Silik / Trip</p>
          <p className="text-[22px] font-bold text-ink mt-1">
            {formatCurrency(filtered.length > 0 ? Math.round(totalSilik / filtered.length) : 0)}
          </p>
          <p className="text-[11px] text-muted mt-1">Per transaction average</p>
        </div>
        <div className="rounded-xl border border-line bg-panel p-4">
          <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">Highest Driver Silik</p>
          <p className="text-[22px] font-bold text-primary mt-1">
            {driverBreakdown.length > 0 ? formatCurrency(driverBreakdown[0][1].total) : '₹0'}
          </p>
          <p className="text-[11px] text-muted mt-1 truncate">
            {driverBreakdown.length > 0 ? driverBreakdown[0][0] : 'None'}
          </p>
        </div>
      </div>

      {/* Driver-wise Summary Cards */}
      {driverBreakdown.length > 0 && (
        <div>
          <h2 className="text-[13px] font-semibold text-muted uppercase tracking-wider mb-3">Driver-wise Breakdown</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {driverBreakdown.map(([driverName, data]) => {
              const pct = totalSilik > 0 ? ((data.total / totalSilik) * 100).toFixed(1) : '0';
              return (
                <div key={driverName} className="rounded-xl border border-line bg-panel p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-semibold text-ink truncate">{driverName}</span>
                    <span className="text-[12px] font-bold text-primary">{formatCurrency(data.total)}</span>
                  </div>
                  <div className="h-1.5 w-full bg-line rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted">
                    <span>{data.count} trip{data.count !== 1 ? 's' : ''} • {[...data.vehicles].join(', ') || 'No vehicle'}</span>
                    <span>{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Table Section */}
      <Card padding="none">
        {filtered.length === 0 ? (
          <EmptyState
            title="No driver silik records found"
            description="Add your first driver silik record to view driver summary."
            actionLabel="Add Silik Record"
            onAction={openAdd}
          />
        ) : (
          <div className="overflow-x-auto table-scroll">
            <table className="w-full min-w-[750px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left text-[12px] font-medium text-muted px-4 py-3 whitespace-nowrap">Date</th>
                  <th className="text-left text-[12px] font-medium text-muted px-4 py-3 whitespace-nowrap">Vehicle No.</th>
                  <th className="text-left text-[12px] font-medium text-muted px-4 py-3 whitespace-nowrap">Driver Name</th>
                  <th className="text-right text-[12px] font-medium text-muted px-4 py-3 whitespace-nowrap">Silik Amount</th>
                  <th className="text-left text-[12px] font-medium text-muted px-4 py-3 whitespace-nowrap">Note</th>
                  <th className="px-4 py-3 text-right" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr
                    key={r.id}
                    className="border-b border-line/50 hover:bg-paper/50 transition-colors duration-100 cursor-pointer"
                    onClick={() => openEdit(r)}
                  >
                    <td className="px-4 py-3 text-[13px] whitespace-nowrap">{formatDate(r.date)}</td>
                    <td className="px-4 py-3 text-[13px] font-medium whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded bg-paper border border-line font-mono text-[12px]">
                        {r.vehicle_no}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] font-medium whitespace-nowrap text-ink">
                      👨‍✈️ {r.driver_name}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-right font-bold text-ink whitespace-nowrap">
                      {formatCurrency(r.silik_amount)}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-muted max-w-xs truncate">
                      {r.note ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={e => { e.stopPropagation(); openEdit(r); }}
                        className="text-muted hover:text-ink text-[12px] font-medium mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={e => handleDelete(r.id, e)}
                        className="text-muted hover:text-negative text-[12px] font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-line bg-paper/50 font-semibold">
                  <td colSpan={3} className="px-4 py-3 text-[13px] text-ink">
                    Total ({filtered.length} entries)
                  </td>
                  <td className="px-4 py-3 text-[13px] text-right text-ink font-bold">
                    {formatCurrency(totalSilik)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* Add / Edit Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editId ? 'Edit Driver Silik' : 'Add Driver Silik Record'}
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 min-[481px]:grid-cols-2 gap-4">
            <TextField
              label="Date"
              type="date"
              value={form.date ?? ''}
              onChange={f('date')}
              required
            />
            <TextField
              label="Vehicle No."
              value={form.vehicle_no ?? ''}
              onChange={f('vehicle_no')}
              placeholder="GJ-03-AB-1234"
              required
            />
          </div>

          <div className="grid grid-cols-1 min-[481px]:grid-cols-2 gap-4">
            <TextField
              label="Driver Name"
              value={form.driver_name ?? ''}
              onChange={f('driver_name')}
              placeholder="Ramesh Solanki"
              required
            />
            <TextField
              label="Silik Amount (₹)"
              type="number"
              value={form.silik_amount ?? ''}
              onChange={f('silik_amount')}
              placeholder="3500"
              required
            />
          </div>

          <TextField
            label="Note"
            value={form.note ?? ''}
            onChange={f('note')}
            placeholder="Route advance, food allowance, etc."
          />

          <div className="flex justify-end gap-3 pt-2 border-t border-line">
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!form.date || !form.vehicle_no || !form.driver_name || form.silik_amount == null}
            >
              {editId ? 'Update Record' : 'Save Record'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
