'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { SelectField } from '@/components/Input';
import StatusPill from '@/components/StatusPill';
import EmptyState from '@/components/EmptyState';
import SearchInput from '@/components/SearchInput';
import { getVehicles, getDrivers, getBankAccounts, syncVehiclesFromSupabase, syncDriversFromSupabase, syncBankAccountsFromSupabase, getAllAccountOptions } from '@/lib/master-store';
import { formatCurrency, formatDate } from '@/lib/format';
import {
  getStoredTrips,
  subscribeTrips,
  deleteTrip,
  syncTripsFromSupabase,
  updateTripPayment,
  organizeTripsWithReturns,
  type UnifiedTrip,
} from '@/lib/trip-store';
import type { PaymentMode, PaymentStatus, Vehicle, Driver, BankAccount } from '@/types/database';

export default function TripsPage() {
  const [trips, setTrips] = useState<UnifiedTrip[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Payment Update Modal State
  const [editingTrip, setEditingTrip] = useState<UnifiedTrip | null>(null);
  const [modalReceivedAmount, setModalReceivedAmount] = useState<string>('');
  const [modalPaymentMode, setModalPaymentMode] = useState<PaymentMode>('Jaymin - HDFC');
  const [modalPaymentStatus, setModalPaymentStatus] = useState<PaymentStatus>('received');
  const [modalDate, setModalDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [modalTxnRef, setModalTxnRef] = useState<string>('');
  const [modalNote, setModalNote] = useState<string>('');

  useEffect(() => {
    const refreshData = () => {
      setTrips([...getStoredTrips()]);
      setVehicles([...getVehicles()]);
      setDrivers([...getDrivers()]);
      setBankAccounts([...getBankAccounts()]);
    };
    refreshData();
    syncTripsFromSupabase().then(remote => {
      if (remote && remote.length > 0) setTrips([...remote]);
    });
    syncVehiclesFromSupabase().then(v => {
      if (v && v.length > 0) setVehicles([...v]);
    });
    syncDriversFromSupabase().then(d => {
      if (d && d.length > 0) setDrivers([...d]);
    });
    syncBankAccountsFromSupabase().then(acc => {
      if (acc && acc.length > 0) setBankAccounts([...acc]);
    });
    window.addEventListener('focus', refreshData);
    window.addEventListener('visibilitychange', refreshData);
    const unsub = subscribeTrips(refreshData);
    return () => {
      window.removeEventListener('focus', refreshData);
      window.removeEventListener('visibilitychange', refreshData);
      unsub();
    };
  }, []);

  // Bank Accounts / Payment Methods list in user-specified priority order
  const bankAccountOptions = useMemo(() => {
    return getAllAccountOptions(bankAccounts);
  }, [bankAccounts]);

  const filtered = useMemo(() => {
    return trips.filter(t => {
      if (!t) return false;
      const sr = (t.sr_number || '').toLowerCase();
      const veh = (t.vehicle_no || '').toLowerCase();
      const drv = (t.driver_name || '').toLowerCase();
      const pty = (t.party_name || '').toLowerCase();
      const q = search.toLowerCase().trim();

      if (q && !sr.includes(q) && !veh.includes(q) && !drv.includes(q) && !pty.includes(q)) {
        return false;
      }
      if (dateFrom && t.date < dateFrom) return false;
      if (dateTo && t.date > dateTo) return false;
      if (vehicleFilter && !veh.includes(vehicleFilter.toLowerCase())) return false;
      if (driverFilter && !drv.includes(driverFilter.toLowerCase())) return false;
      if (modeFilter && t.payment_mode !== modeFilter) return false;
      if (statusFilter && t.payment_status !== statusFilter) return false;
      return true;
    });
  }, [trips, search, dateFrom, dateTo, vehicleFilter, driverFilter, modeFilter, statusFilter]);

  const clearFilters = () => {
    setSearch(''); setDateFrom(''); setDateTo('');
    setVehicleFilter(''); setDriverFilter('');
    setModeFilter(''); setStatusFilter('');
  };

  const hasFilters = dateFrom || dateTo || vehicleFilter || driverFilter || modeFilter || statusFilter;

  // Organize trips so return legs sit directly underneath their parent onward trip
  const organizedTrips = useMemo(() => {
    return organizeTripsWithReturns(filtered);
  }, [filtered]);

  const onwardCount = useMemo(() => filtered.filter(t => !t.is_return_leg).length, [filtered]);
  const returnCount = useMemo(() => filtered.filter(t => t.is_return_leg).length, [filtered]);

  // Comprehensive financial summary for filtered trips
  const totalFreight = useMemo(() => filtered.reduce((s, t) => s + (t.total_freight ?? 0), 0), [filtered]);
  const totalReceived = useMemo(() => {
    return filtered.reduce((s, t) => {
      const tf = t.total_freight ?? 0;
      const rec = t.received_amount != null ? Number(t.received_amount) : (t.payment_status === 'received' ? tf : 0);
      return s + rec;
    }, 0);
  }, [filtered]);
  const totalBalance = useMemo(() => {
    return filtered.reduce((s, t) => {
      const tf = t.total_freight ?? 0;
      const rec = t.received_amount != null ? Number(t.received_amount) : (t.payment_status === 'received' ? tf : 0);
      const bal = t.balance_amount != null ? Number(t.balance_amount) : Math.max(0, tf - rec);
      return s + bal;
    }, 0);
  }, [filtered]);
  const totalExpense = useMemo(() => filtered.reduce((s, t) => s + (t.total_expense ?? 0), 0), [filtered]);
  const totalProfit = useMemo(() => filtered.reduce((s, t) => s + (t.profit ?? 0), 0), [filtered]);

  const handleDeleteTrip = (id: string, sr: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete trip ${sr}?`)) {
      const updated = deleteTrip(id);
      setTrips([...updated]);
    }
  };

  // Open Quick Payment Update Modal
  const handleOpenPaymentModal = (trip: UnifiedTrip, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTrip(trip);
    const rec = trip.received_amount != null ? String(trip.received_amount) : (trip.payment_status === 'received' ? String(trip.total_freight ?? '') : '0');
    setModalReceivedAmount(rec);
    setModalPaymentMode(trip.payment_mode || 'Jaymin - HDFC');
    setModalPaymentStatus(trip.payment_status || 'received');
    setModalDate(trip.date || new Date().toISOString().slice(0, 10));
    setModalTxnRef('');
    setModalNote(trip.notes || '');
  };

  const handleSavePaymentModal = () => {
    if (!editingTrip) return;
    const numReceived = Math.max(0, Number(modalReceivedAmount) || 0);
    const updated = updateTripPayment(
      editingTrip.id,
      numReceived,
      modalPaymentMode,
      modalPaymentStatus,
      {
        date: modalDate,
        bank_account: modalPaymentMode,
        transaction_ref: modalTxnRef.trim() || undefined,
        note: modalNote.trim() || `Payment received: ${formatCurrency(numReceived)}`,
      }
    );
    if (updated) {
      // Re-read immediately from memory store to reflect new payment status
      setTrips([...getStoredTrips()]);
    }
    setEditingTrip(null);
  };

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <SearchInput
            placeholder="Search SR, vehicle, driver, party..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            wrapperClassName="flex-1 max-w-xs"
          />
          <Button variant="secondary" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 4h12M4 8h8M6 12h4" /></svg>
            Filters
            {hasFilters && <span className="w-2 h-2 rounded-full bg-primary" />}
          </Button>
        </div>
        <Link href="/trips/new">
          <Button>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg>
            Add Trip
          </Button>
        </Link>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card padding="sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[13px] font-medium text-muted">Date From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-2 rounded-lg border border-line bg-paper text-[14px]" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[13px] font-medium text-muted">Date To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-2 rounded-lg border border-line bg-paper text-[14px]" />
            </div>
            <SelectField label="Vehicle" value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)} placeholder="All Vehicles" options={vehicles.filter(v => v.is_active).map(v => ({ value: v.vehicle_no, label: v.vehicle_no }))} />
            <SelectField label="Driver" value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)} placeholder="All Drivers" options={drivers.filter(d => d.is_active).map(d => ({ value: d.name, label: d.name }))} />
            <SelectField
              label="Payment Mode / Bank"
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              placeholder="All Modes"
              options={[
                ...bankAccountOptions,
                { value: 'cash', label: 'Cash (Generic)' },
                { value: 'upi', label: 'UPI (Generic)' },
                { value: 'bank_transfer', label: 'Bank Transfer (Generic)' },
              ]}
            />
            <SelectField label="Payment Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} placeholder="All Statuses" options={[{ value: 'pending', label: 'Pending' }, { value: 'partial', label: 'Partial' }, { value: 'received', label: 'Received' }, { value: 'overdue', label: 'Overdue' }]} />
            <div className="flex items-end">
              <Button variant="secondary" size="sm" onClick={clearFilters}>Clear All</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Prominent Payment Breakdown Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3 bg-panel rounded-xl border border-line">
          <span className="text-[11px] font-semibold text-muted uppercase block">Trips Count</span>
          <strong className="text-[17px] font-bold text-ink block mt-0.5">
            {onwardCount} Trips
            {returnCount > 0 && (
              <span className="text-[11px] font-medium text-amber-700 ml-1.5">(+{returnCount} Return)</span>
            )}
          </strong>
        </div>
        <div className="p-3 bg-panel rounded-xl border border-line">
          <span className="text-[11px] font-semibold text-muted uppercase block">Kul Freight</span>
          <strong className="text-[17px] font-bold text-ink block mt-0.5">{formatCurrency(totalFreight)}</strong>
        </div>
        <div className="p-3 bg-panel rounded-xl border border-positive/30 bg-positive/[0.02]">
          <span className="text-[11px] font-semibold text-positive uppercase block">Aavyu (Received)</span>
          <strong className="text-[17px] font-bold text-positive block mt-0.5">{formatCurrency(totalReceived)}</strong>
        </div>
        <div className="p-3 bg-panel rounded-xl border border-amber-300 bg-amber-500/[0.03]">
          <span className="text-[11px] font-semibold text-amber-700 uppercase block">Baki (Pending)</span>
          <strong className="text-[17px] font-bold text-amber-700 block mt-0.5">{formatCurrency(totalBalance)}</strong>
        </div>
        <div className="p-3 bg-panel rounded-xl border border-line">
          <span className="text-[11px] font-semibold text-muted uppercase block">Total Expense</span>
          <strong className="text-[17px] font-bold text-negative block mt-0.5">{formatCurrency(totalExpense)}</strong>
        </div>
        <div className="p-3 bg-panel rounded-xl border border-line">
          <span className="text-[11px] font-semibold text-muted uppercase block">Net Profit</span>
          <strong className={`text-[17px] font-bold block mt-0.5 ${totalProfit >= 0 ? 'text-positive' : 'text-negative'}`}>
            {formatCurrency(totalProfit)}
          </strong>
        </div>
      </div>

      {/* Table */}
      <Card padding="none">
        {filtered.length === 0 ? (
          <EmptyState
            title="No trips found"
            description={search || hasFilters ? 'Try adjusting your search or filters.' : 'Add your first trip to get started.'}
            actionLabel={!search && !hasFilters ? 'Add Trip' : hasFilters ? 'Clear Filters' : undefined}
            onAction={!search && !hasFilters ? undefined : hasFilters ? clearFilters : undefined}
          />
        ) : (
          <div className="overflow-x-auto table-scroll">
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr className="border-b border-line bg-paper/60">
                  <th className="text-left text-[13px] font-semibold text-muted px-4 py-3">SR No.</th>
                  <th className="text-left text-[13px] font-semibold text-muted px-3 py-3">Date</th>
                  <th className="text-left text-[13px] font-semibold text-muted px-3 py-3">Vehicle</th>
                  <th className="text-left text-[13px] font-semibold text-muted px-3 py-3">Driver</th>
                  <th className="text-left text-[13px] font-semibold text-muted px-3 py-3">Party / Route</th>
                  <th className="text-right text-[13px] font-semibold text-muted px-3 py-3">Ton</th>
                  <th className="text-right text-[13px] font-semibold text-ink px-3 py-3">Kul Freight</th>
                  <th className="text-right text-[13px] font-semibold text-positive px-3 py-3">Aavyu (Rec.)</th>
                  <th className="text-right text-[13px] font-semibold text-amber-700 px-3 py-3">Baki (Bal.)</th>
                  <th className="text-right text-[13px] font-semibold text-negative px-3 py-3">Expense</th>
                  <th className="text-right text-[13px] font-semibold text-muted px-3 py-3">Profit</th>
                  <th className="text-center text-[13px] font-semibold text-muted px-3 py-3">Status</th>
                  <th className="text-center text-[13px] font-semibold text-muted px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {organizedTrips.map((trip) => {
                  const tf = trip.total_freight ?? 0;
                  const rec = trip.received_amount != null ? Number(trip.received_amount) : (trip.payment_status === 'received' ? tf : 0);
                  const bal = trip.balance_amount != null ? Number(trip.balance_amount) : Math.max(0, tf - rec);

                  return (
                    <tr
                      key={trip.id}
                      className={`border-b border-line/50 transition-colors duration-100 ${
                        trip.is_return_leg
                          ? 'bg-amber-500/[0.04] hover:bg-amber-500/[0.08] border-l-4 border-l-amber-500'
                          : 'hover:bg-paper/60'
                      }`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        {trip.is_return_leg ? (
                          <div className="flex items-center gap-1.5 pl-2">
                            <span className="text-amber-600 font-bold text-[14px]">↳</span>
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-900 border border-amber-300">
                              Return
                            </span>
                          </div>
                        ) : (
                          <span className="text-[14px] font-bold text-primary font-mono tracking-tight">{trip.sr_number}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-[13px] whitespace-nowrap text-muted">{formatDate(trip.date)}</td>
                      <td className="px-3 py-3 text-[14px] font-medium whitespace-nowrap">{trip.vehicle_no || '—'}</td>
                      <td className="px-3 py-3 text-[13px] whitespace-nowrap">{trip.driver_name || '—'}</td>
                      <td className="px-3 py-3 text-[13px] max-w-[220px]">
                        <div className="flex items-center gap-1.5">
                          {trip.is_return_leg && <span className="text-amber-600 font-bold text-[13px]">↳</span>}
                          <p className="font-semibold text-ink truncate">{trip.party_name || '—'}</p>
                        </div>
                        <p className="text-[12px] text-muted truncate">
                          {trip.loading_from || '—'} → {trip.loading_to || '—'}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-[13px] text-right whitespace-nowrap">
                        {trip.ton != null ? `${trip.ton}` : '—'} {trip.unload_ton != null ? `/ ${trip.unload_ton}` : ''}
                      </td>

                      {/* Kul Freight */}
                      <td className="px-3 py-3 text-[14px] text-right font-bold text-ink whitespace-nowrap">
                        {formatCurrency(tf)}
                      </td>

                      {/* Aavyu (Received) */}
                      <td className="px-3 py-3 text-[14px] text-right font-bold text-positive whitespace-nowrap bg-positive/[0.01]">
                        {formatCurrency(rec)}
                      </td>

                      {/* Baki (Balance) */}
                      <td className="px-3 py-3 text-[14px] text-right font-bold whitespace-nowrap bg-amber-500/[0.01]">
                        <span className={bal > 0 ? 'text-amber-700' : 'text-muted/60'}>
                          {formatCurrency(bal)}
                        </span>
                      </td>

                      {/* Expense */}
                      <td className="px-3 py-3 text-[13px] text-right text-negative whitespace-nowrap">
                        {formatCurrency(trip.total_expense)}
                      </td>

                      {/* Profit */}
                      <td className={`px-3 py-3 text-[14px] text-right font-bold whitespace-nowrap ${(trip.profit ?? 0) >= 0 ? 'text-positive' : 'text-negative'}`}>
                        {formatCurrency(trip.profit)}
                      </td>

                      {/* Status & Payment Method */}
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center gap-1">
                          <StatusPill status={trip.payment_status} />
                          {trip.payment_mode && (
                            <StatusPill status={trip.payment_mode} className="text-[10px] px-2 py-0 font-medium" />
                          )}
                        </div>
                      </td>

                      {/* Actions (Update Payment & Delete) */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => handleOpenPaymentModal(trip, e)}
                            className="px-2 py-1 rounded text-[12px] font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                            title="Update payment for this trip"
                          >
                            ₹ Pay
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteTrip(trip.id, trip.sr_number, e)}
                            className="text-muted hover:text-negative p-1.5 rounded-md hover:bg-negative/10 transition-colors"
                            title="Delete this trip"
                          >
                            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                              <path d="M3 4h10M6 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4M4.5 4v9a1 1 0 001 1h5a1 1 0 001-1V4" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Footer totals */}
              <tfoot>
                <tr className="border-t-2 border-line bg-paper font-bold text-ink">
                  <td colSpan={6} className="px-4 py-3.5 text-[14px]">
                    Totals ({filtered.length} trips)
                  </td>
                  <td className="px-3 py-3.5 text-[15px] text-right text-ink whitespace-nowrap">
                    {formatCurrency(totalFreight)}
                  </td>
                  <td className="px-3 py-3.5 text-[15px] text-right text-positive whitespace-nowrap">
                    {formatCurrency(totalReceived)}
                  </td>
                  <td className="px-3 py-3.5 text-[15px] text-right text-amber-700 whitespace-nowrap">
                    {formatCurrency(totalBalance)}
                  </td>
                  <td className="px-3 py-3.5 text-[14px] text-right text-negative whitespace-nowrap">
                    {formatCurrency(totalExpense)}
                  </td>
                  <td className={`px-3 py-3.5 text-[15px] text-right whitespace-nowrap ${totalProfit >= 0 ? 'text-positive' : 'text-negative'}`}>
                    {formatCurrency(totalProfit)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* Quick Payment Update Modal */}
      {editingTrip && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-panel rounded-2xl border border-line shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                  <span>Update Payment</span>
                  <span className="text-sm font-mono text-primary px-2 py-0.5 rounded bg-primary/10">
                    {editingTrip.sr_number}
                  </span>
                </h3>
                <p className="text-[12px] text-muted mt-0.5">{editingTrip.party_name} &bull; {editingTrip.vehicle_no}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingTrip(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:bg-paper hover:text-ink"
              >
                ✕
              </button>
            </div>

            {/* Total Freight Display */}
            <div className="p-3.5 rounded-xl bg-paper border border-line flex items-center justify-between">
              <span className="text-[13px] text-muted font-medium">Kul Freight (Total):</span>
              <span className="text-[17px] font-bold text-ink">{formatCurrency(editingTrip.total_freight)}</span>
            </div>

            {/* Quick action buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const full = String(editingTrip.total_freight ?? 0);
                  setModalReceivedAmount(full);
                  setModalPaymentStatus('received');
                }}
                className="flex-1 py-1.5 px-2 rounded-lg border border-positive/30 bg-positive/10 text-positive text-[12px] font-bold hover:bg-positive/20 transition-colors text-center"
              >
                ✓ Poora Aavi Gaya ({formatCurrency(editingTrip.total_freight)})
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalReceivedAmount('0');
                  setModalPaymentStatus('pending');
                }}
                className="flex-1 py-1.5 px-2 rounded-lg border border-line bg-paper text-muted text-[12px] font-medium hover:bg-line transition-colors text-center"
              >
                0 Aavyu (Poora Baki)
              </button>
            </div>

            {/* Input Received Amount */}
            <div className="space-y-1">
              <label className="text-[13px] font-bold text-positive flex items-center justify-between">
                <span>Ketlu Aavyu / Received Amount (₹)</span>
                <span className="text-[11px] font-normal text-muted">Enter received cash/bank</span>
              </label>
              <input
                type="number"
                step="1"
                placeholder="20000"
                value={modalReceivedAmount}
                onChange={(e) => {
                  const val = e.target.value;
                  setModalReceivedAmount(val);
                  const num = Number(val) || 0;
                  const tf = editingTrip.total_freight ?? 0;
                  if (tf > 0 && num >= tf) {
                    setModalPaymentStatus('received');
                  } else if (num > 0) {
                    setModalPaymentStatus('partial');
                  } else {
                    setModalPaymentStatus('pending');
                  }
                }}
                className="w-full px-3 py-2.5 rounded-xl border border-positive/40 bg-paper text-[18px] font-extrabold text-positive focus:outline-none focus:ring-2 focus:ring-positive/20"
                autoFocus
              />
            </div>

            {/* Live Remaining Balance */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-300 flex items-center justify-between text-[14px]">
              <span className="text-amber-800 font-semibold">Ketlu Baki Rehshe (Balance):</span>
              <span className="font-extrabold text-amber-800 text-[16px]">
                {formatCurrency(Math.max(0, (editingTrip.total_freight ?? 0) - (Number(modalReceivedAmount) || 0)))}
              </span>
            </div>

            {/* Date & Account (Kema Aavyu) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-muted">Payment Date (તારીખ)</label>
                <input
                  type="date"
                  value={modalDate}
                  onChange={(e) => setModalDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-paper text-[13px]"
                />
              </div>
              <SelectField
                label="Kema Aavyu (ખાતું / Cash)"
                value={modalPaymentMode}
                onChange={(e) => setModalPaymentMode(e.target.value as PaymentMode)}
                options={bankAccountOptions}
              />
            </div>

            {/* Status & UTR Ref */}
            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="Payment Status (સ્થિતિ)"
                value={modalPaymentStatus}
                onChange={(e) => setModalPaymentStatus(e.target.value as PaymentStatus)}
                options={[
                  { value: 'received', label: 'Received (જમા / ચૂકતે)' },
                  { value: 'partial', label: 'Partial (અડધા જમા)' },
                  { value: 'pending', label: 'Pending (બાકી)' },
                  { value: 'overdue', label: 'Overdue (મુદત વીતી)' },
                ]}
              />
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-muted">Txn / UTR Ref (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. UTR / Chq No."
                  value={modalTxnRef}
                  onChange={(e) => setModalTxnRef(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-paper text-[13px]"
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setEditingTrip(null)}>
                Cancel
              </Button>
              <Button onClick={handleSavePaymentModal}>
                Save Payment
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
