'use client';

import { useState, useMemo, useEffect } from 'react';
import Card from '@/components/Card';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import Modal from '@/components/Modal';
import SearchInput from '@/components/SearchInput';
import { TextField } from '@/components/Input';
import { formatCurrency, formatDate } from '@/lib/format';
import {
  getStoredDiesel,
  saveDieselEntry,
  deleteDieselEntry,
  syncDieselFromSupabase,
  syncDieselFromTrips,
} from '@/lib/diesel-store';
import { getStoredTrips, syncTripsFromSupabase } from '@/lib/trip-store';
import { getVehicles, getDrivers, syncVehiclesFromSupabase, syncDriversFromSupabase } from '@/lib/master-store';
import type { DieselEntry, Vehicle, Driver } from '@/types/database';

const emptyForm = (): Partial<DieselEntry> => ({
  date: new Date().toISOString().slice(0, 10),
  slip_no: '',
  truck_no: '',
  diesel_liter: undefined,
  rate: 99.53,
  amount: undefined,
  driver_name: '',
  notes: '',
});

export default function DieselPage() {
  const [entries, setEntries] = useState<DieselEntry[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [truckFilter, setTruckFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<DieselEntry>>(emptyForm());
  const [isCustomTruck, setIsCustomTruck] = useState(false);
  const [isCustomDriver, setIsCustomDriver] = useState(false);

  useEffect(() => {
    const refreshData = () => {
      const trips = getStoredTrips();
      if (trips && trips.length > 0) {
        syncDieselFromTrips(trips);
      }
      setEntries(getStoredDiesel());
      setVehicles(getVehicles());
      setDrivers(getDrivers());
    };

    refreshData();
    syncDieselFromSupabase().then(res => {
      if (res && res.length > 0) setEntries([...res]);
    });
    syncTripsFromSupabase().then(trips => {
      if (trips && trips.length > 0) {
        const synced = syncDieselFromTrips(trips);
        setEntries([...synced]);
      }
    });
    syncVehiclesFromSupabase().then(v => {
      if (v && v.length > 0) setVehicles([...v]);
    });
    syncDriversFromSupabase().then(d => {
      if (d && d.length > 0) setDrivers([...d]);
    });

    window.addEventListener('shreeji_diesel_updated', refreshData);
    window.addEventListener('shreeji_trips_updated', refreshData);
    return () => {
      window.removeEventListener('shreeji_diesel_updated', refreshData);
      window.removeEventListener('shreeji_trips_updated', refreshData);
    };
  }, []);

  // Filtered entries
  const filtered = useMemo(() => {
    return entries.filter(e => {
      const q = search.trim().toLowerCase();
      const truck = (e.truck_no || '').toLowerCase();
      const driver = (e.driver_name || '').toLowerCase();
      const slip = (e.slip_no || '').toLowerCase();

      if (q && !truck.includes(q) && !driver.includes(q) && !slip.includes(q)) {
        return false;
      }
      if (dateFrom && e.date < dateFrom) return false;
      if (dateTo && e.date > dateTo) return false;
      if (truckFilter && !truck.includes(truckFilter.toLowerCase())) return false;
      if (driverFilter && !driver.includes(driverFilter.toLowerCase())) return false;
      return true;
    });
  }, [entries, search, dateFrom, dateTo, truckFilter, driverFilter]);

  // Statistics
  const totalLiters = useMemo(() => filtered.reduce((s, e) => s + (Number(e.diesel_liter) || 0), 0), [filtered]);
  const totalAmount = useMemo(() => filtered.reduce((s, e) => s + (Number(e.amount) || 0), 0), [filtered]);
  const avgRate = useMemo(() => {
    return totalLiters > 0 ? Number((totalAmount / totalLiters).toFixed(2)) : 0;
  }, [totalLiters, totalAmount]);

  // Form Field Change with Auto Calculation of Amount
  const handleLiterChange = (val: string) => {
    const liter = Number(val);
    const rate = Number(form.rate) || 0;
    const computedAmt = !isNaN(liter) && rate > 0 ? Number((liter * rate).toFixed(2)) : form.amount;
    setForm(prev => ({
      ...prev,
      diesel_liter: val as unknown as number,
      amount: computedAmt,
    }));
  };

  const handleRateChange = (val: string) => {
    const rate = Number(val);
    const liter = Number(form.diesel_liter) || 0;
    const computedAmt = !isNaN(rate) && liter > 0 ? Number((liter * rate).toFixed(2)) : form.amount;
    setForm(prev => ({
      ...prev,
      rate: val as unknown as number,
      amount: computedAmt,
    }));
  };

  function openCreate() {
    setForm({
      ...emptyForm(),
      truck_no: vehicles[0]?.vehicle_no || 'GJ03CW9144',
      driver_name: drivers[0]?.name || '',
    });
    setEditId(null);
    setIsCustomTruck(false);
    setIsCustomDriver(false);
    setShowModal(true);
  }

  function openEdit(item: DieselEntry) {
    setForm({ ...item });
    setEditId(item.id);
    const inVehicles = vehicles.some(v => v.vehicle_no === item.truck_no);
    const inDrivers = drivers.some(d => d.name === item.driver_name);
    setIsCustomTruck(!inVehicles && Boolean(item.truck_no));
    setIsCustomDriver(!inDrivers && Boolean(item.driver_name));
    setShowModal(true);
  }

  function handleDelete(id: string, slipNo: string, amount: number) {
    if (confirm(`Are you sure you want to delete Diesel Slip ${slipNo || id} (Amount: ${formatCurrency(amount)})?`)) {
      const updated = deleteDieselEntry(id);
      setEntries([...updated]);
    }
  }

  function handleSubmit() {
    if (!form.date || !form.truck_no || !form.diesel_liter || !form.rate) {
      alert('Please fill Date, Truck No, Diesel Liter and Rate.');
      return;
    }

    const liter = Number(form.diesel_liter);
    const rate = Number(form.rate);
    const amount = form.amount != null ? Number(form.amount) : Number((liter * rate).toFixed(2));

    const updated = saveDieselEntry({
      ...form,
      id: editId || undefined,
      diesel_liter: liter,
      rate,
      amount,
    });

    setEntries([...updated]);
    setShowModal(false);
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-800 border border-amber-500/20">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18" />
                <path d="M15 10h2a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2 2 2 0 0 0 2-2V9.5a1.5 1.5 0 0 0-.44-1.06L20 6" />
                <path d="M6 12h6" />
                <rect x="6" y="5" width="6" height="4" rx="1" />
              </svg>
            </span>
            <span>Diesel Management</span>
          </h1>
          <p className="text-[13px] text-muted mt-1">
            Diesel slip records, fuel tracking, rate calculations, and truck-wise diesel expenses.
          </p>
        </div>

        <Button variant="primary" onClick={openCreate} className="gap-2 shadow-sm font-semibold">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M8 3v10M3 8h10" />
          </svg>
          Add Diesel Entry
        </Button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <Card className="p-4 bg-paper/80 border border-line">
          <p className="text-[12px] font-semibold text-muted">Total Diesel Litres</p>
          <p className="text-2xl font-bold text-ink mt-1 font-mono tracking-tight">
            {totalLiters.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm font-normal text-muted">L</span>
          </p>
          <p className="text-[11px] text-muted mt-0.5">{filtered.length} fuel slips</p>
        </Card>

        <Card className="p-4 bg-paper/80 border border-line">
          <p className="text-[12px] font-semibold text-muted">Total Diesel Amount</p>
          <p className="text-2xl font-bold text-amber-700 mt-1 font-mono tracking-tight">
            {formatCurrency(totalAmount)}
          </p>
          <p className="text-[11px] text-muted mt-0.5">Total expense</p>
        </Card>

        <Card className="p-4 bg-paper/80 border border-line">
          <p className="text-[12px] font-semibold text-muted">Average Rate / Litre</p>
          <p className="text-2xl font-bold text-ink mt-1 font-mono tracking-tight">
            ₹{avgRate} <span className="text-sm font-normal text-muted">/L</span>
          </p>
          <p className="text-[11px] text-muted mt-0.5">Weighted avg</p>
        </Card>

        <Card className="p-4 bg-paper/80 border border-line">
          <p className="text-[12px] font-semibold text-muted">Total Slips</p>
          <p className="text-2xl font-bold text-primary mt-1 font-mono tracking-tight">
            {filtered.length}
          </p>
          <p className="text-[11px] text-muted mt-0.5">Recorded slips</p>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-3 bg-panel border border-line">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div className="md:col-span-2">
            <SearchInput
              placeholder="Search by Slip No, Truck No, Driver..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClear={() => setSearch('')}
              className="text-[13px]"
            />
          </div>

          <div>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full text-[13px] px-2.5 py-2 rounded-lg border border-line bg-paper text-ink"
              title="From Date"
            />
          </div>

          <div>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full text-[13px] px-2.5 py-2 rounded-lg border border-line bg-paper text-ink"
              title="To Date"
            />
          </div>

          <div>
            <select
              value={truckFilter}
              onChange={e => setTruckFilter(e.target.value)}
              className="w-full text-[13px] px-2.5 py-2 rounded-lg border border-line bg-paper text-ink"
            >
              <option value="">All Trucks</option>
              {Array.from(new Set(entries.map(e => e.truck_no).filter(Boolean))).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Diesel Table */}
      <Card padding="none" className="overflow-hidden border border-line shadow-sm">
        {filtered.length === 0 ? (
          <EmptyState
            title="No diesel records found"
            description="Record a fuel slip by clicking the Add Diesel Entry button above."
          />
        ) : (
          <div className="overflow-x-auto table-scroll">
            <table className="w-full min-w-[950px] border-collapse">
              <thead>
                <tr className="border-b border-line bg-paper/90 text-muted uppercase tracking-wider text-[11px] font-bold">
                  <th className="px-4 py-3 text-center w-14">SR NO</th>
                  <th className="px-4 py-3 text-left">DATE</th>
                  <th className="px-4 py-3 text-left">SLIP NO</th>
                  <th className="px-4 py-3 text-left">TRUCK NO</th>
                  <th className="px-4 py-3 text-right">DIESEL LITER</th>
                  <th className="px-4 py-3 text-right">RATE</th>
                  <th className="px-4 py-3 text-right font-bold text-ink">AMOUNT</th>
                  <th className="px-4 py-3 text-left">DRIVER NAME</th>
                  <th className="px-4 py-3 text-center w-24">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {filtered.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-paper/50 transition-colors">
                    {/* SR NO */}
                    <td className="px-4 py-3 text-center text-[13px] font-mono font-medium text-muted">
                      {item.sr_no ?? idx + 1}
                    </td>

                    {/* DATE */}
                    <td className="px-4 py-3 text-[13px] whitespace-nowrap text-ink">
                      {formatDate(item.date)}
                    </td>

                    {/* SLIP NO */}
                    <td className="px-4 py-3 text-[13px] font-mono font-bold text-primary whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span>{item.slip_no || '—'}</span>
                        {Boolean(item.trip_id || item.notes?.toLowerCase().includes('trip')) && (
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider"
                            title={item.notes || 'Imported from trip'}
                          >
                            Trip
                          </span>
                        )}
                      </div>
                    </td>

                    {/* TRUCK NO */}
                    <td className="px-4 py-3 text-[13px] font-mono font-semibold whitespace-nowrap text-ink">
                      {item.truck_no}
                    </td>

                    {/* DIESEL LITER */}
                    <td className="px-4 py-3 text-[14px] font-mono text-right font-semibold text-ink whitespace-nowrap">
                      {Number(item.diesel_liter).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* RATE */}
                    <td className="px-4 py-3 text-[13px] font-mono text-right text-muted whitespace-nowrap">
                      {Number(item.rate).toFixed(2)}
                    </td>

                    {/* AMOUNT */}
                    <td className="px-4 py-3 text-[14px] font-mono text-right font-bold text-amber-700 whitespace-nowrap bg-amber-500/[0.02]">
                      {formatCurrency(item.amount)}
                    </td>

                    {/* DRIVER NAME */}
                    <td className="px-4 py-3 text-[13px] font-semibold text-ink uppercase whitespace-nowrap">
                      {item.driver_name || '—'}
                    </td>

                    {/* ACTIONS */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="text-[12px] font-medium text-primary hover:underline px-2 py-0.5 rounded hover:bg-primary/10 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id, item.slip_no, item.amount)}
                          className="text-[12px] font-medium text-negative hover:underline px-2 py-0.5 rounded hover:bg-negative/10 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Table Footer Totals */}
              <tfoot>
                <tr className="border-t-2 border-line bg-paper font-bold text-ink">
                  <td colSpan={4} className="px-4 py-3.5 text-[13px] font-bold">
                    Totals ({filtered.length} entries)
                  </td>
                  <td className="px-4 py-3.5 text-[14px] font-mono text-right font-bold text-ink whitespace-nowrap">
                    {totalLiters.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L
                  </td>
                  <td className="px-4 py-3.5 text-[13px] font-mono text-right text-muted whitespace-nowrap">
                    ₹{avgRate}/L
                  </td>
                  <td className="px-4 py-3.5 text-[15px] font-mono text-right font-bold text-amber-700 whitespace-nowrap">
                    {formatCurrency(totalAmount)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* Add / Edit Diesel Slip Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editId ? 'Edit Diesel Slip' : 'Add Diesel Entry (ડીઝલ સ્લિપ નોંધો)'}
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <TextField
              label="Date (તારીખ) *"
              type="date"
              value={form.date ?? ''}
              onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
              required
            />

            <TextField
              label="Slip No. (સ્લિપ નંબર) *"
              value={form.slip_no ?? ''}
              onChange={e => setForm(prev => ({ ...prev, slip_no: e.target.value }))}
              placeholder="e.g. 117"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Truck No */}
            <div>
              <label className="block text-[13px] font-medium text-ink mb-1.5">
                Truck No. (વાહન નંબર) *
              </label>
              {isCustomTruck ? (
                <div className="space-y-1">
                  <input
                    type="text"
                    value={form.truck_no ?? ''}
                    onChange={e => setForm(prev => ({ ...prev, truck_no: e.target.value.toUpperCase() }))}
                    placeholder="e.g. GJ03CW9144"
                    className="w-full uppercase font-mono text-[13px]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => { setIsCustomTruck(false); setForm(prev => ({ ...prev, truck_no: vehicles[0]?.vehicle_no || '' })); }}
                    className="text-[11px] text-primary hover:underline"
                  >
                    Select from vehicle list
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <select
                    value={form.truck_no ?? ''}
                    onChange={e => {
                      if (e.target.value === '__custom__') {
                        setIsCustomTruck(true);
                        setForm(prev => ({ ...prev, truck_no: '' }));
                      } else {
                        setForm(prev => ({ ...prev, truck_no: e.target.value }));
                      }
                    }}
                    className="w-full text-[13px] font-mono"
                    required
                  >
                    <option value="">Select Vehicle...</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.vehicle_no}>{v.vehicle_no}</option>
                    ))}
                    <option value="GJ03CW9144">GJ03CW9144</option>
                    <option value="__custom__">+ Enter custom truck no...</option>
                  </select>
                </div>
              )}
            </div>

            {/* Driver Name */}
            <div>
              <label className="block text-[13px] font-medium text-ink mb-1.5">
                Driver Name (ડ્રાઈવર) *
              </label>
              {isCustomDriver ? (
                <div className="space-y-1">
                  <input
                    type="text"
                    value={form.driver_name ?? ''}
                    onChange={e => setForm(prev => ({ ...prev, driver_name: e.target.value.toUpperCase() }))}
                    placeholder="e.g. SANJAY"
                    className="w-full uppercase text-[13px]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => { setIsCustomDriver(false); setForm(prev => ({ ...prev, driver_name: drivers[0]?.name || '' })); }}
                    className="text-[11px] text-primary hover:underline"
                  >
                    Select from driver list
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <select
                    value={form.driver_name ?? ''}
                    onChange={e => {
                      if (e.target.value === '__custom__') {
                        setIsCustomDriver(true);
                        setForm(prev => ({ ...prev, driver_name: '' }));
                      } else {
                        setForm(prev => ({ ...prev, driver_name: e.target.value }));
                      }
                    }}
                    className="w-full text-[13px]"
                    required
                  >
                    <option value="">Select Driver...</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                    <option value="SANJAY">SANJAY</option>
                    <option value="SEBAJ">SEBAJ</option>
                    <option value="IQBAL">IQBAL</option>
                    <option value="__custom__">+ Enter custom driver...</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <TextField
              label="Diesel Liter (લીટર) *"
              type="number"
              step="0.01"
              value={form.diesel_liter ?? ''}
              onChange={e => handleLiterChange(e.target.value)}
              placeholder="e.g. 302.1"
              required
            />

            <TextField
              label="Rate (ભાવ પ્રતિ લીટર) *"
              type="number"
              step="0.01"
              value={form.rate ?? ''}
              onChange={e => handleRateChange(e.target.value)}
              placeholder="e.g. 99.53"
              required
            />

            <TextField
              label="Amount (કુલ રકમ ₹) *"
              type="number"
              step="0.01"
              value={form.amount ?? ''}
              onChange={e => setForm(prev => ({ ...prev, amount: e.target.value as unknown as number }))}
              placeholder="Auto-calculated"
              required
            />
          </div>

          <TextField
            label="Notes / Pump / Remarks (વધારાની નોંધ)"
            value={form.notes ?? ''}
            onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="e.g. Reliance pump Kodinar..."
          />

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmit}>
              {editId ? 'Update Entry' : 'Save Diesel Entry'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
