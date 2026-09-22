'use client';

import { useState, useMemo, useEffect } from 'react';
import Card from '@/components/Card';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import Modal from '@/components/Modal';
import StatusPill from '@/components/StatusPill';
import SearchInput from '@/components/SearchInput';
import { TextField, SelectField } from '@/components/Input';
import { formatCurrency, formatDate } from '@/lib/format';
import { getStoredPayments, savePayment, deletePayment, syncPaymentsFromSupabase, syncPaymentsFromTrips } from '@/lib/operations-store';
import { getBankAccounts, getVehicles, getParties, syncBankAccountsFromSupabase } from '@/lib/master-store';
import { getStoredTrips, subscribeTrips, updateTripPayment, syncTripsFromSupabase, isSrNumberMatch, isPaymentForTrip, type UnifiedTrip } from '@/lib/trip-store';
import { generateUUID } from '@/lib/supabase-service';
import type { Payment, PaymentMode, BankAccount, Vehicle, Party } from '@/types/database';

const PAYMENT_OPTIONS = [
  { value: 'cash', label: 'Cash (Cash Counter)' },
  { value: 'upi', label: 'UPI / QR Code' },
  { value: 'online', label: 'Online NetBanking' },
  { value: 'bank_transfer', label: 'Bank Transfer (NEFT/RTGS/IMPS)' },
];

const emptyForm = (): Partial<Payment> => ({
  date: new Date().toISOString().split('T')[0],
  party_name: '',
  vehicle_no: '',
  trip_ref: '',
  freight_amount: undefined,
  received_amount: undefined,
  payment_mode: 'bank_transfer',
  bank_account: 'Jaymin - HDFC',
  transaction_ref: '',
  note: '',
});

export default function PaymentPage() {
  const [records, setRecords] = useState<Payment[]>(() => getStoredPayments());
  const [trips, setTrips] = useState<UnifiedTrip[]>(() => getStoredTrips());
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(() => getBankAccounts());
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => getVehicles().filter(v => v.is_active));
  const [parties, setParties] = useState<Party[]>(() => getParties().filter(p => p.is_active));

  const [activeTab, setActiveTab] = useState<'collections' | 'receivables'>('collections');
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Partial<Payment>>(emptyForm());
  const [editId, setEditId] = useState<string | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [isCustomAccount, setIsCustomAccount] = useState(false);
  const [customAccountText, setCustomAccountText] = useState('');
  const [isCustomVehicle, setIsCustomVehicle] = useState(false);

  useEffect(() => {
    const refreshData = () => {
      const currentTrips = getStoredTrips();
      syncPaymentsFromTrips(currentTrips);
      setRecords(getStoredPayments());
      setTrips(currentTrips);
      setBankAccounts(getBankAccounts());
      setVehicles(getVehicles().filter(v => v.is_active));
      setParties(getParties().filter(p => p.is_active));
    };

    refreshData();

    // Auto-sync with Supabase if online
    syncTripsFromSupabase().then(remote => {
      if (remote && remote.length > 0) {
        setTrips([...remote]);
        syncPaymentsFromTrips(remote);
        setRecords(getStoredPayments());
      }
    });
    syncPaymentsFromSupabase().then(remote => {
      if (remote && remote.length > 0) setRecords([...remote]);
    });
    syncBankAccountsFromSupabase().then(remote => {
      if (remote && remote.length > 0) setBankAccounts([...remote]);
    });

    const unsubTrips = subscribeTrips((latestTrips) => {
      const freshTrips = latestTrips && latestTrips.length > 0 ? latestTrips : getStoredTrips();
      syncPaymentsFromTrips(freshTrips);
      setTrips([...freshTrips]);
      setRecords(getStoredPayments());
    });

    const handleOperationsUpdate = () => {
      const freshTrips = getStoredTrips();
      setRecords(getStoredPayments());
      setTrips([...freshTrips]);
    };

    window.addEventListener('shreeji_operations_updated', handleOperationsUpdate);
    window.addEventListener('shreeji_trips_updated', handleOperationsUpdate);
    window.addEventListener('focus', refreshData);
    window.addEventListener('visibilitychange', refreshData);

    return () => {
      unsubTrips();
      window.removeEventListener('shreeji_operations_updated', handleOperationsUpdate);
      window.removeEventListener('shreeji_trips_updated', handleOperationsUpdate);
      window.removeEventListener('focus', refreshData);
      window.removeEventListener('visibilitychange', refreshData);
    };
  }, []);

  // Pending Trips: Trips where payment is pending, partial, or overdue (balance > 0)
  const pendingTrips = useMemo(() => {
    return trips.filter(t => {
      const tf = t.total_freight ?? 0;
      const rec = t.received_amount != null ? Number(t.received_amount) : (t.payment_status === 'received' ? tf : 0);
      const bal = t.balance_amount != null ? Number(t.balance_amount) : Math.max(0, tf - rec);
      return bal > 0 || t.payment_status === 'pending' || t.payment_status === 'partial' || t.payment_status === 'overdue';
    });
  }, [trips]);

  // Overall Business Totals (Unified across Trips & Payments)
  const totalFreight = useMemo(() => trips.reduce((s, t) => s + (t.total_freight ?? 0), 0), [trips]);
  
  const totalReceived = useMemo(() => {
    return records.reduce((s, r) => s + (Number(r.received_amount) || 0), 0);
  }, [records]);

  const totalPendingBalance = useMemo(() => {
    return pendingTrips.reduce((s, t) => {
      const tf = t.total_freight ?? 0;
      const rec = t.received_amount != null ? Number(t.received_amount) : (t.payment_status === 'received' ? tf : 0);
      const bal = t.balance_amount != null ? Number(t.balance_amount) : Math.max(0, tf - rec);
      return s + bal;
    }, 0);
  }, [pendingTrips]);

  // Filtered payment records for Tab 1 (Received Collections)
  const filteredRecords = useMemo(() => records.filter(r => {
    if (search) {
      const q = search.toLowerCase();
      const matchParty = r.party_name.toLowerCase().includes(q);
      const matchTrip = (r.trip_ref ?? '').toLowerCase().includes(q);
      const matchVeh = (r.vehicle_no ?? '').toLowerCase().includes(q);
      const matchAcc = (r.bank_account ?? '').toLowerCase().includes(q);
      const matchTxn = (r.transaction_ref ?? '').toLowerCase().includes(q);
      if (!matchParty && !matchTrip && !matchVeh && !matchAcc && !matchTxn) return false;
    }
    if (modeFilter && r.payment_mode !== modeFilter) return false;
    if (accountFilter) {
      const acc = (r.bank_account || (r.payment_mode === 'cash' ? 'Cash' : '')).toLowerCase();
      if (!acc.includes(accountFilter.toLowerCase())) return false;
    }
    return true;
  }), [records, search, modeFilter, accountFilter]);

  // Filtered pending trips for Tab 2 (Pending Receivables)
  const filteredPendingTrips = useMemo(() => {
    return pendingTrips.filter(t => {
      if (search) {
        const q = search.toLowerCase();
        const matchParty = (t.party_name || '').toLowerCase().includes(q);
        const matchSr = (t.sr_number || '').toLowerCase().includes(q);
        const matchVeh = (t.vehicle_no || '').toLowerCase().includes(q);
        const matchRoute = `${t.loading_from} ${t.loading_to}`.toLowerCase().includes(q);
        if (!matchParty && !matchSr && !matchVeh && !matchRoute) return false;
      }
      return true;
    });
  }, [pendingTrips, search]);

  // Tab 1 Subtotals
  const tab1Freight = filteredRecords.reduce((s, r) => s + (r.freight_amount ?? 0), 0);
  const tab1Received = filteredRecords.reduce((s, r) => s + r.received_amount, 0);
  const tab1Balance = filteredRecords.reduce((s, r) => s + (r.balance ?? 0), 0);

  // Dynamic Bank Account Options
  const accountLabels = useMemo(() => {
    const list: string[] = [];
    const priority = [
      'Jaymin - HDFC',
      'Shreeji - ICICI',
      'Vijay - HDFC',
      'Jaymin - IDFC',
      'Jaymin - Cash',
      'Jaymin - Online',
      'Vijay - Cash',
      'Vijay - Online',
      'Shreeji - Cash',
      'Shreeji - Online',
      'Cash',
      'Online / UPI',
    ];
    priority.forEach(p => {
      if (!list.includes(p)) list.push(p);
    });
    bankAccounts.forEach(ba => {
      if (!list.includes(ba.label)) list.push(ba.label);
    });
    records.forEach(r => {
      if (r.bank_account && !list.includes(r.bank_account)) {
        list.push(r.bank_account);
      }
    });
    return list;
  }, [bankAccounts, records]);

  // Account-wise Breakdown Totals (based on records)
  const accountBreakdown = useMemo(() => {
    return accountLabels.map(label => {
      const matching = records.filter(r => {
        const acc = r.bank_account || (r.payment_mode === 'cash' ? 'Cash' : '');
        return acc.toLowerCase() === label.toLowerCase();
      });
      const sum = matching.reduce((s, r) => s + r.received_amount, 0);
      const count = matching.length;
      return { label, sum, count };
    });
  }, [accountLabels, records]);

  // Computed balance inside modal form
  const computedBalance = useMemo(() => {
    if (form.freight_amount != null && form.received_amount != null) {
      return Math.max(0, Number(form.freight_amount) - Number(form.received_amount));
    }
    return null;
  }, [form.freight_amount, form.received_amount]);

  // Open Modal for Generic New Payment
  function openAdd() {
    setForm(emptyForm());
    setEditId(null);
    setSelectedTripId(null);
    setIsCustomAccount(false);
    setCustomAccountText('');
    setIsCustomVehicle(false);
    setShowModal(true);
  }

  // Open Modal Pre-filled for a Specific Pending Trip
  function openReceiveForTrip(trip: UnifiedTrip) {
    const tf = trip.total_freight ?? 0;
    const rec = trip.received_amount != null ? Number(trip.received_amount) : 0;
    const bal = trip.balance_amount != null ? Number(trip.balance_amount) : Math.max(0, tf - rec);

    setSelectedTripId(trip.id);
    setForm({
      date: new Date().toISOString().split('T')[0],
      party_name: trip.party_name,
      vehicle_no: trip.vehicle_no || '',
      trip_ref: trip.is_return_leg ? `${trip.sr_number} (Return)` : trip.sr_number,
      freight_amount: tf,
      received_amount: bal, // Pre-fill with remaining pending balance for 1-click clearing!
      payment_mode: (trip.payment_mode?.toLowerCase().includes('cash') || trip.payment_mode?.toLowerCase().includes('case'))
        ? 'cash'
        : (trip.payment_mode?.toLowerCase().includes('upi') || trip.payment_mode?.toLowerCase().includes('online'))
        ? 'upi'
        : 'bank_transfer',
      bank_account: trip.payment_mode || 'Jaymin - HDFC',
      transaction_ref: '',
      note: `Payment for ${trip.is_return_leg ? 'return leg of' : 'trip'} ${trip.sr_number} (${trip.loading_from} to ${trip.loading_to})`,
    });
    setEditId(null);
    setIsCustomAccount(false);
    setCustomAccountText('');
    setIsCustomVehicle(false);
    setShowModal(true);
  }

  // Open Edit Existing Payment
  function openEdit(r: Payment) {
    setForm({ ...r });
    setEditId(r.id);
    const matchedTrip = trips.find(t => t.sr_number && t.sr_number.toLowerCase() === (r.trip_ref || '').toLowerCase());
    setSelectedTripId(matchedTrip?.id || null);

    const inList = accountLabels.some(l => l.toLowerCase() === (r.bank_account ?? '').toLowerCase());
    if (r.bank_account && !inList) {
      setIsCustomAccount(true);
      setCustomAccountText(r.bank_account);
    } else {
      setIsCustomAccount(false);
      setCustomAccountText('');
    }
    const inVehicles = vehicles.some(v => v.vehicle_no === r.vehicle_no);
    setIsCustomVehicle(!inVehicles && Boolean(r.vehicle_no));
    setShowModal(true);
  }

  // Delete Payment
  function handleDelete(id: string, partyName: string, amount: number) {
    if (window.confirm(`Are you sure you want to delete payment record of ${formatCurrency(amount)} from "${partyName}"?`)) {
      const updated = deletePayment(id);
      setRecords(updated);
    }
  }

  // Handle Save Payment (Synchronizes with Trip Store)
  function handleSave() {
    if (!form.date || !form.party_name || form.received_amount == null || form.received_amount === ('' as unknown as number)) {
      alert('Please fill Date, Party Name and Received Amount.');
      return;
    }

    const recAmount = Number(form.received_amount);
    if (isNaN(recAmount) || recAmount < 0) {
      alert('Please enter a valid received amount.');
      return;
    }

    const resolvedAccount = isCustomAccount
      ? customAccountText.trim()
      : (form.bank_account || (form.payment_mode === 'cash' ? 'Cash' : 'Jaymin - HDFC'));

    const resolvedTripRef = form.trip_ref?.trim() || null;

    // 1. Create or Update Payment Entry
    // Use a proper UUID for Supabase compatibility (pay_xxx format is not a valid UUID)
    const paymentId = editId ?? generateUUID();
    const entry: Payment = {
      id: paymentId,
      transport_id: 'a0000000-0000-0000-0000-000000000001',
      date: form.date!,
      party_name: form.party_name.trim(),
      vehicle_no: form.vehicle_no?.trim() || null,
      trip_ref: resolvedTripRef,
      freight_amount: form.freight_amount != null && form.freight_amount !== ('' as unknown as number) ? Number(form.freight_amount) : null,
      received_amount: recAmount,
      balance: computedBalance,
      payment_mode: (form.payment_mode as PaymentMode) ?? 'bank_transfer',
      bank_account: resolvedAccount || null,
      transaction_ref: form.transaction_ref?.trim() || null,
      note: form.note?.trim() || null,
      created_at: new Date().toISOString(),
    };

    // 2. Identify Corresponding Trip in Trip Store if linked
    let targetTrip = trips.find(t => {
      if (selectedTripId && t.id === selectedTripId) return true;
      if (resolvedTripRef && t.id === resolvedTripRef) return true;
      if (resolvedTripRef && isSrNumberMatch(t.sr_number, resolvedTripRef)) {
        // If payment mentions return, prioritize return leg
        const payMentionsReturn = resolvedTripRef.toLowerCase().includes('return') || (form.note || '').toLowerCase().includes('return');
        if (payMentionsReturn) return Boolean(t.is_return_leg);
        // If party name is specified, check party match
        if (form.party_name && t.party_name && form.party_name.trim().toLowerCase() === t.party_name.trim().toLowerCase()) {
          return true;
        }
        return !t.is_return_leg;
      }
      return false;
    });

    // If still not matched, check if party name has a single pending trip
    if (!targetTrip && form.party_name) {
      const partyTrips = trips.filter(t => 
        t.party_name.trim().toLowerCase() === form.party_name.trim().toLowerCase() &&
        (t.payment_status !== 'received' || (t.balance_amount ?? 0) > 0)
      );
      if (partyTrips.length === 1) {
        targetTrip = partyTrips[0];
      }
    }

    if (targetTrip) {
      entry.trip_ref = targetTrip.is_return_leg ? `${targetTrip.sr_number} (Return)` : targetTrip.sr_number;
    }

    const updatedPayments = savePayment(entry);
    setRecords(updatedPayments);

    if (targetTrip) {
      const totalFreightVal = targetTrip.total_freight ?? (form.freight_amount ? Number(form.freight_amount) : 0);
      
      // Calculate total received strictly for this trip (distinguishing onward vs return legs)
      const matchingPayments = updatedPayments.filter(p => isPaymentForTrip(p, targetTrip!, trips));
      const newTripReceived = matchingPayments.reduce((s, p) => s + (Number(p.received_amount) || 0), 0);

      // If new received exceeds or equals total freight, mark received
      let newStatus: PaymentStatus = 'pending';
      if (totalFreightVal > 0 && newTripReceived >= totalFreightVal) {
        newStatus = 'received';
      } else if (newTripReceived > 0) {
        newStatus = 'partial';
      }

      updateTripPayment(
        targetTrip.id,
        newTripReceived,
        resolvedAccount as any,
        newStatus,
        {
          date: form.date,
          bank_account: resolvedAccount,
          transaction_ref: form.transaction_ref?.trim() || null,
          note: form.note?.trim() || `Payment received: ${formatCurrency(recAmount)}`,
        }
      );

      // Re-read trips from storage AFTER updateTripPayment has written new data
      const refreshedTrips = getStoredTrips();
      setTrips([...refreshedTrips]);
      setRecords(getStoredPayments());
    } else {
      // Even if no linked trip, refresh data
      setRecords(getStoredPayments());
    }

    setShowModal(false);
  }

  const f = (k: keyof Payment) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = e.target.value;
    setForm(prev => {
      const next = { ...prev, [k]: val };
      // Smart bank account auto-selection when mode changes
      if (k === 'payment_mode') {
        if (val === 'cash') {
          next.bank_account = 'Cash';
          setIsCustomAccount(false);
        } else if (val === 'upi' && (!prev.bank_account || prev.bank_account === 'Cash')) {
          next.bank_account = 'Online / UPI';
          setIsCustomAccount(false);
        } else if (val === 'online' && (!prev.bank_account || prev.bank_account === 'Cash')) {
          next.bank_account = 'Online / UPI';
          setIsCustomAccount(false);
        } else if (val === 'bank_transfer' && (prev.bank_account === 'Cash' || prev.bank_account === 'Online / UPI')) {
          next.bank_account = 'Jaymin - HDFC';
          setIsCustomAccount(false);
        }
      }
      return next;
    });
  };

  return (
    <div className="space-y-5">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap flex-1">
          <SearchInput
            placeholder="Search party, trip SR, vehicle, account..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            wrapperClassName="flex-1 max-w-xs"
          />
          {activeTab === 'collections' && (
            <>
              <select value={modeFilter} onChange={e => setModeFilter(e.target.value)} className="text-[13px] py-2">
                <option value="">All Payment Modes</option>
                {PAYMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select value={accountFilter} onChange={e => setAccountFilter(e.target.value)} className="text-[13px] py-2">
                <option value="">All Bank Accounts</option>
                {accountLabels.map(acc => <option key={acc} value={acc}>{acc}</option>)}
              </select>
            </>
          )}
        </div>
        <Button onClick={openAdd}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg>
          Record Payment
        </Button>
      </div>

      {/* Main Metric Cards (100% Unified across Trips & Payments) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-line bg-panel p-4 shadow-sm">
          <p className="text-[11px] text-muted uppercase tracking-wider font-semibold">Total Freight Billed (કુલ ભાડું)</p>
          <p className="text-[22px] font-bold text-ink mt-1">{formatCurrency(totalFreight)}</p>
          <p className="text-[11px] text-muted mt-1">Across all {trips.length} recorded trips</p>
        </div>
        <div className="rounded-xl border border-line bg-panel p-4 shadow-sm border-l-4 border-l-positive">
          <p className="text-[11px] text-positive uppercase tracking-wider font-bold">Total Received (જમા રકમ)</p>
          <p className="text-[22px] font-bold text-positive mt-1">{formatCurrency(totalReceived)}</p>
          <p className="text-[11px] text-positive/80 mt-1">Successfully collected in accounts</p>
        </div>
        <div className="rounded-xl border border-line bg-panel p-4 shadow-sm border-l-4 border-l-amber-500">
          <p className="text-[11px] text-amber-700 uppercase tracking-wider font-bold">Outstanding Balance (બાકી રકમ)</p>
          <p className={`text-[22px] font-bold mt-1 ${totalPendingBalance > 0 ? 'text-amber-700' : 'text-positive'}`}>
            {formatCurrency(totalPendingBalance)}
          </p>
          <p className="text-[11px] text-muted mt-1">
            {totalPendingBalance > 0 ? `${pendingTrips.length} trips awaiting collection` : 'All customer bills cleared'}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-panel p-4 shadow-sm">
          <p className="text-[11px] text-muted uppercase tracking-wider font-semibold">Pending Trips to Collect</p>
          <p className="text-[22px] font-bold text-primary mt-1">{pendingTrips.length} Trips</p>
          <p className="text-[11px] text-muted mt-1">Click &ldquo;Pending Receivables&rdquo; below</p>
        </div>
      </div>

      {/* Account-wise Collections Breakdown ("કયા ખાતામાં આવ્યા / Bank Account Breakdown") */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
              Account-wise Collections (કયા ખાતામાં કેટલા આવ્યા)
            </h2>
            <p className="text-[12px] text-muted">Click any account below to filter received payment transactions</p>
          </div>
          {accountFilter && (
            <button
              onClick={() => setAccountFilter('')}
              className="text-[12px] font-medium text-primary hover:underline self-start sm:self-auto"
            >
              Reset Filter (Show All)
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {accountBreakdown.map(item => {
            const isSelected = accountFilter.toLowerCase() === item.label.toLowerCase();
            const isCash = item.label.toLowerCase().includes('cash');
            const isUpi = item.label.toLowerCase().includes('upi') || item.label.toLowerCase().includes('online');

            return (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setActiveTab('collections');
                  setAccountFilter(isSelected ? '' : item.label);
                }}
                className={`text-left p-3 rounded-xl border transition-all duration-150 ${
                  isSelected
                    ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary'
                    : 'border-line/70 bg-paper/60 hover:bg-paper hover:border-line'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-[12px] font-bold text-ink truncate" title={item.label}>
                    {item.label}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                    isCash ? 'bg-cash/15 text-cash' : isUpi ? 'bg-online/15 text-online' : 'bg-primary/15 text-primary'
                  }`}>
                    {isCash ? 'Cash' : isUpi ? 'UPI' : 'Bank'}
                  </span>
                </div>
                <p className="text-[16px] font-bold text-ink">
                  {formatCurrency(item.sum)}
                </p>
                <p className="text-[11px] text-muted mt-0.5">
                  {item.count} {item.count === 1 ? 'collection' : 'collections'}
                </p>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-line pb-0">
        <button
          type="button"
          onClick={() => setActiveTab('collections')}
          className={`flex items-center gap-2 px-4 py-2.5 text-[14px] font-semibold border-b-2 transition-colors ${
            activeTab === 'collections'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-muted hover:text-ink'
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Received Collections (જમા રકમ)
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-positive/10 text-positive font-bold">
            {records.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('receivables')}
          className={`flex items-center gap-2 px-4 py-2.5 text-[14px] font-semibold border-b-2 transition-colors ${
            activeTab === 'receivables'
              ? 'border-amber-600 text-amber-700 font-bold'
              : 'border-transparent text-muted hover:text-ink'
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Pending Receivables (બાકી લેવાના નાણાં)
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-amber-500/15 text-amber-700 font-bold">
            {pendingTrips.length} Trips &bull; {formatCurrency(totalPendingBalance)}
          </span>
        </button>
      </div>

      {/* TAB 1: Received Collections Table */}
      {activeTab === 'collections' && (
        <Card padding="none">
          {filteredRecords.length === 0 ? (
            <EmptyState
              title="No payment records found"
              description={search || modeFilter || accountFilter ? 'No payments match your active filters.' : 'Record your first payment.'}
              actionLabel={!search && !modeFilter && !accountFilter ? 'Record Payment' : undefined}
              onAction={!search && !modeFilter && !accountFilter ? openAdd : undefined}
            />
          ) : (
            <div className="overflow-x-auto table-scroll">
              <table className="w-full min-w-[1150px]">
                <thead>
                  <tr className="border-b border-line bg-paper/40">
                    <th className="text-left text-[12px] font-semibold text-muted px-4 py-3 whitespace-nowrap">Payment Date</th>
                    <th className="text-left text-[12px] font-semibold text-muted px-4 py-3 whitespace-nowrap">Party / Customer</th>
                    <th className="text-left text-[12px] font-semibold text-muted px-4 py-3 whitespace-nowrap">Vehicle No.</th>
                    <th className="text-left text-[12px] font-semibold text-muted px-4 py-3 whitespace-nowrap">Trip / SR Ref</th>
                    <th className="text-right text-[12px] font-semibold text-muted px-4 py-3 whitespace-nowrap">Total Freight</th>
                    <th className="text-right text-[12px] font-semibold text-positive px-4 py-3 whitespace-nowrap">Received Amount (જમા)</th>
                    <th className="text-right text-[12px] font-semibold text-muted px-4 py-3 whitespace-nowrap">Balance (બાકી)</th>
                    <th className="text-left text-[12px] font-semibold text-muted px-4 py-3 whitespace-nowrap">Payment Mode</th>
                    <th className="text-left text-[12px] font-semibold text-primary px-4 py-3 whitespace-nowrap">Deposited In / Kema Aavyu (ખાતું)</th>
                    <th className="text-left text-[12px] font-semibold text-muted px-4 py-3 whitespace-nowrap">Txn / UTR Ref</th>
                    <th className="text-left text-[12px] font-semibold text-muted px-4 py-3 whitespace-nowrap">Note</th>
                    <th className="text-right text-[12px] font-semibold text-muted px-4 py-3 whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map(r => {
                    const mode = (r.payment_mode || 'bank_transfer').toLowerCase();
                    const isCash = mode === 'cash' || (r.bank_account && r.bank_account.toLowerCase().includes('cash'));
                    const isUpi = mode === 'upi' || (r.bank_account && r.bank_account.toLowerCase().includes('upi'));

                    return (
                      <tr key={r.id} className="border-b border-line/50 hover:bg-paper/50 transition-colors">
                        <td className="px-4 py-3 text-[13px] whitespace-nowrap font-medium text-ink">
                          {formatDate(r.date)}
                        </td>
                        <td className="px-4 py-3 text-[13px] font-semibold text-ink whitespace-nowrap">
                          {r.party_name}
                        </td>
                        <td className="px-4 py-3 text-[13px] font-mono text-muted whitespace-nowrap">
                          {r.vehicle_no ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-[13px] font-mono text-primary whitespace-nowrap">
                          {r.trip_ref ? (
                            <span className="px-2 py-0.5 rounded bg-primary/10 font-bold">{r.trip_ref}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3 text-[13px] text-right font-medium">
                          {r.freight_amount != null ? formatCurrency(r.freight_amount) : '—'}
                        </td>
                        <td className="px-4 py-3 text-[13px] text-right font-bold text-positive whitespace-nowrap bg-positive/[0.02]">
                          {formatCurrency(r.received_amount)}
                        </td>
                        <td className={`px-4 py-3 text-[13px] text-right font-bold whitespace-nowrap ${(r.balance ?? 0) > 0 ? 'text-amber-700' : 'text-positive'}`}>
                          {r.balance != null ? formatCurrency(r.balance) : '—'}
                        </td>
                        <td className="px-4 py-3 text-[13px] whitespace-nowrap">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-paper border border-line capitalize">
                            {(r.payment_mode || 'bank_transfer').replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[13px] whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[12px] font-medium border ${
                            isCash
                              ? 'bg-cash/10 text-cash border-cash/30'
                              : isUpi
                              ? 'bg-online/10 text-online border-online/30'
                              : 'bg-primary/10 text-primary border-primary/30'
                          }`}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              {isCash ? (
                                <>
                                  <rect x="2" y="6" width="20" height="12" rx="2" />
                                  <circle cx="12" cy="12" r="2" />
                                </>
                              ) : isUpi ? (
                                <>
                                  <rect x="3" y="3" width="18" height="18" rx="2" />
                                  <path d="M7 7h.01M17 7h.01M7 17h.01M17 17h.01" />
                                </>
                              ) : (
                                <>
                                  <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v4M12 14v4M16 14v4" />
                                </>
                              )}
                            </svg>
                            {r.bank_account || (r.payment_mode === 'cash' ? 'Cash' : '—')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[13px] font-mono text-muted whitespace-nowrap">
                          {r.transaction_ref ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-[13px] text-muted max-w-[180px] truncate" title={r.note ?? ''}>
                          {r.note ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-3">
                            <button
                              onClick={() => openEdit(r)}
                              className="text-[13px] font-medium text-primary hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(r.id, r.party_name, r.received_amount)}
                              className="text-[13px] font-medium text-negative hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-line bg-paper/70 font-semibold">
                    <td colSpan={4} className="px-4 py-3.5 text-[13px] font-bold text-ink">
                      Total Collections ({filteredRecords.length} Entries)
                    </td>
                    <td className="px-4 py-3.5 text-[13px] text-right font-bold text-ink">
                      {formatCurrency(tab1Freight)}
                    </td>
                    <td className="px-4 py-3.5 text-[13px] text-right font-bold text-positive">
                      {formatCurrency(tab1Received)}
                    </td>
                    <td className={`px-4 py-3.5 text-[13px] text-right font-bold ${tab1Balance > 0 ? 'text-amber-700' : 'text-positive'}`}>
                      {formatCurrency(tab1Balance)}
                    </td>
                    <td colSpan={5} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB 2: Pending Receivables Table (Trips Awaiting Customer Payment) */}
      {activeTab === 'receivables' && (
        <Card padding="none">
          {filteredPendingTrips.length === 0 ? (
            <EmptyState
              title="All trips are fully paid!"
              description={search ? 'No pending trips match your search.' : 'There are currently no outstanding receivables from customers.'}
            />
          ) : (
            <div className="overflow-x-auto table-scroll">
              <table className="w-full min-w-[1150px]">
                <thead>
                  <tr className="border-b border-line bg-amber-500/5">
                    <th className="text-left text-[12px] font-semibold text-muted px-4 py-3 whitespace-nowrap">Trip Date</th>
                    <th className="text-left text-[12px] font-semibold text-muted px-4 py-3 whitespace-nowrap">SR Number</th>
                    <th className="text-left text-[12px] font-semibold text-muted px-4 py-3 whitespace-nowrap">Party / Customer</th>
                    <th className="text-left text-[12px] font-semibold text-muted px-4 py-3 whitespace-nowrap">Route (From → To)</th>
                    <th className="text-left text-[12px] font-semibold text-muted px-4 py-3 whitespace-nowrap">Vehicle & Driver</th>
                    <th className="text-right text-[12px] font-semibold text-ink px-4 py-3 whitespace-nowrap">Kul Freight (₹)</th>
                    <th className="text-right text-[12px] font-semibold text-positive px-4 py-3 whitespace-nowrap">Already Received (₹)</th>
                    <th className="text-right text-[12px] font-bold text-amber-700 px-4 py-3 whitespace-nowrap">Pending Balance (બાકી ₹)</th>
                    <th className="text-center text-[12px] font-semibold text-muted px-4 py-3 whitespace-nowrap">Status</th>
                    <th className="text-center text-[12px] font-semibold text-muted px-4 py-3 whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPendingTrips.map(trip => {
                    const tf = trip.total_freight ?? 0;
                    const rec = trip.received_amount != null ? Number(trip.received_amount) : (trip.payment_status === 'received' ? tf : 0);
                    const bal = trip.balance_amount != null ? Number(trip.balance_amount) : Math.max(0, tf - rec);

                    return (
                      <tr key={trip.id} className="border-b border-line/50 hover:bg-paper/60 transition-colors">
                        <td className="px-4 py-3 text-[13px] whitespace-nowrap text-muted font-medium">
                          {formatDate(trip.date)}
                        </td>
                        <td className="px-4 py-3 text-[13px] font-mono whitespace-nowrap">
                          <span className="font-bold text-primary px-2 py-0.5 rounded bg-primary/10">
                            {trip.sr_number}
                          </span>
                          {trip.is_return_leg && (
                            <span className="ml-1.5 text-[11px] font-bold text-amber-800 bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-300">
                              ↳ Return
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[13px] font-bold text-ink whitespace-nowrap">
                          {trip.party_name}
                        </td>
                        <td className="px-4 py-3 text-[13px] text-muted whitespace-nowrap">
                          {trip.loading_from} → {trip.loading_to}
                        </td>
                        <td className="px-4 py-3 text-[13px] whitespace-nowrap">
                          <span className="font-mono font-medium text-ink block">{trip.vehicle_no || '—'}</span>
                          <span className="text-[11px] text-muted block">{trip.driver_name || '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-[13px] text-right font-semibold text-ink whitespace-nowrap">
                          {formatCurrency(tf)}
                        </td>
                        <td className="px-4 py-3 text-[13px] text-right font-semibold text-positive whitespace-nowrap">
                          {formatCurrency(rec)}
                        </td>
                        <td className="px-4 py-3 text-[14px] text-right font-extrabold text-amber-700 whitespace-nowrap bg-amber-500/10">
                          {formatCurrency(bal)}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <StatusPill status={trip.payment_status} />
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openReceiveForTrip(trip)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-[12px] font-bold hover:bg-primary/90 transition-all shadow-sm"
                            title="Record received payment for this trip"
                          >
                            <span>₹ Receive Payment</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-line bg-paper/70 font-semibold">
                    <td colSpan={5} className="px-4 py-3.5 text-[13px] font-bold text-ink">
                      Total Pending Trips ({filteredPendingTrips.length} Trips)
                    </td>
                    <td className="px-4 py-3.5 text-[13px] text-right font-bold text-ink">
                      {formatCurrency(filteredPendingTrips.reduce((s, t) => s + (t.total_freight ?? 0), 0))}
                    </td>
                    <td className="px-4 py-3.5 text-[13px] text-right font-bold text-positive">
                      {formatCurrency(filteredPendingTrips.reduce((s, t) => {
                        const tf = t.total_freight ?? 0;
                        const rec = t.received_amount != null ? Number(t.received_amount) : 0;
                        return s + rec;
                      }, 0))}
                    </td>
                    <td className="px-4 py-3.5 text-[14px] text-right font-extrabold text-amber-700 bg-amber-500/15">
                      {formatCurrency(filteredPendingTrips.reduce((s, t) => {
                        const tf = t.total_freight ?? 0;
                        const rec = t.received_amount != null ? Number(t.received_amount) : 0;
                        const bal = t.balance_amount != null ? Number(t.balance_amount) : Math.max(0, tf - rec);
                        return s + bal;
                      }, 0))}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Modal for Add / Edit Payment (With Direct Trip Selection & Auto-Fill) */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editId ? 'Edit Payment Record' : 'Record Received Payment (નાણાં જમા કરો)'}
        size="lg"
      >
        <div className="space-y-4">
          {/* Trip Linking Selector (Allows selecting any pending trip to auto-fill) */}
          <div className="p-3 rounded-xl bg-paper border border-line">
            <label className="block text-[12px] font-bold text-primary mb-1">
              Select Pending Trip / Customer (ટ્રિપ પસંદ કરો - ઓટો ભરાશે)
            </label>
            <select
              value={selectedTripId ?? ''}
              onChange={(e) => {
                const tripId = e.target.value;
                setSelectedTripId(tripId || null);
                if (tripId) {
                  const t = trips.find(item => item.id === tripId);
                  if (t) {
                    const tf = t.total_freight ?? 0;
                    const rec = t.received_amount != null ? Number(t.received_amount) : 0;
                    const bal = t.balance_amount != null ? Number(t.balance_amount) : Math.max(0, tf - rec);

                    setForm(prev => ({
                      ...prev,
                      party_name: t.party_name,
                      vehicle_no: t.vehicle_no || '',
                      trip_ref: t.sr_number,
                      freight_amount: tf,
                      received_amount: bal, // Default to full remaining balance!
                      note: `Payment for trip ${t.sr_number} (${t.loading_from} to ${t.loading_to})`,
                    }));
                  }
                }
              }}
              className="w-full text-[13px] font-medium"
            >
              <option value="">-- Manual Payment (Or select pending trip below) --</option>
              {pendingTrips.map(t => {
                const tf = t.total_freight ?? 0;
                const rec = t.received_amount != null ? Number(t.received_amount) : 0;
                const bal = t.balance_amount != null ? Number(t.balance_amount) : Math.max(0, tf - rec);
                return (
                  <option key={t.id} value={t.id}>
                    [{t.sr_number}{t.is_return_leg ? ' (Return)' : ''}] {t.party_name} — Baki: {formatCurrency(bal)} ({t.loading_from} → {t.loading_to})
                  </option>
                );
              })}
            </select>
            <p className="text-[11px] text-muted mt-1">
              Selecting a trip automatically fills Party, Vehicle, SR Ref, Freight, and Remaining Balance.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TextField
              label="Payment Date *"
              type="date"
              value={form.date ?? ''}
              onChange={f('date')}
              required
            />
            <div>
              <TextField
                label="Party / Customer Name *"
                value={form.party_name ?? ''}
                onChange={f('party_name')}
                placeholder="Ambuja Cement Ltd"
                required
                list="payment-parties-datalist"
              />
              <datalist id="payment-parties-datalist">
                {parties.map(p => (
                  <option key={p.id} value={p.name} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-ink mb-1.5">
                Vehicle No. <span className="text-muted text-[12px]">(Optional)</span>
              </label>
              {isCustomVehicle ? (
                <div className="space-y-1">
                  <input
                    type="text"
                    value={form.vehicle_no ?? ''}
                    onChange={f('vehicle_no')}
                    placeholder="Enter vehicle no. (e.g. GJ-03-AB-1234)"
                    className="w-full uppercase font-mono text-[13px]"
                  />
                  <button
                    type="button"
                    onClick={() => { setIsCustomVehicle(false); setForm(prev => ({ ...prev, vehicle_no: vehicles[0]?.vehicle_no || '' })); }}
                    className="text-[11px] text-primary hover:underline"
                  >
                    Select from vehicle master
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <select
                    value={form.vehicle_no ?? ''}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setIsCustomVehicle(true);
                        setForm(prev => ({ ...prev, vehicle_no: '' }));
                      } else {
                        setForm(prev => ({ ...prev, vehicle_no: e.target.value }));
                      }
                    }}
                    className="w-full text-[13px] font-mono"
                  >
                    <option value="">None / Not Applicable</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.vehicle_no}>
                        {v.vehicle_no} {v.model ? `(${v.model})` : ''}
                      </option>
                    ))}
                    <option value="__custom__">+ Enter custom vehicle...</option>
                  </select>
                </div>
              )}
            </div>

            <TextField
              label="Trip / SR Reference (Optional)"
              value={form.trip_ref ?? ''}
              onChange={f('trip_ref')}
              placeholder="SR0001"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TextField
              label="Total Freight Amount (₹) (Optional)"
              type="number"
              value={form.freight_amount ?? ''}
              onChange={f('freight_amount')}
              placeholder="36063"
            />
            <div className="space-y-1">
              <label className="block text-[13px] font-bold text-positive">
                Received Amount (₹) *
              </label>
              <input
                type="number"
                value={form.received_amount ?? ''}
                onChange={f('received_amount')}
                placeholder="36063"
                className="w-full text-[16px] font-bold text-positive py-2"
                required
              />
              {form.freight_amount && Number(form.freight_amount) > 0 && (
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, received_amount: prev.freight_amount }))}
                  className="text-[11px] text-primary font-semibold hover:underline block"
                >
                  Pay Full Freight ({formatCurrency(Number(form.freight_amount))})
                </button>
              )}
            </div>
          </div>

          {computedBalance != null && (
            <div className={`rounded-xl p-3 border ${computedBalance > 0 ? 'border-amber-300 bg-amber-500/10' : 'border-positive/30 bg-positive/10'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] text-ink font-semibold">Remaining Balance After This Payment (બાકી રકમ)</p>
                  <p className="text-[11px] text-muted mt-0.5">Freight Amount minus Received Amount</p>
                </div>
                <p className={`text-[20px] font-extrabold ${computedBalance > 0 ? 'text-amber-800' : 'text-positive'}`}>
                  {formatCurrency(computedBalance)}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <SelectField
              label="Payment Mode *"
              value={form.payment_mode ?? 'bank_transfer'}
              onChange={f('payment_mode')}
              options={PAYMENT_OPTIONS}
            />

            <div>
              <label className="block text-[13px] font-medium text-ink mb-1.5">
                Deposited Into / Account (કયા ખાતામાં આવ્યા) *
              </label>

              {isCustomAccount ? (
                <div className="space-y-1">
                  <input
                    type="text"
                    value={customAccountText}
                    onChange={(e) => setCustomAccountText(e.target.value)}
                    placeholder="Enter account label or name..."
                    className="w-full text-[13px]"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomAccount(false);
                      setForm(prev => ({ ...prev, bank_account: accountLabels[0] || 'Jaymin - HDFC' }));
                    }}
                    className="text-[11px] text-primary hover:underline"
                  >
                    Select from bank accounts list
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <select
                    value={form.bank_account ?? (form.payment_mode === 'cash' ? 'Cash' : 'Jaymin - HDFC')}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setIsCustomAccount(true);
                        setCustomAccountText('');
                      } else {
                        setForm(prev => ({ ...prev, bank_account: e.target.value }));
                      }
                    }}
                    className="w-full text-[13px] font-medium"
                  >
                    {accountLabels.map(acc => (
                      <option key={acc} value={acc}>
                        {acc}
                      </option>
                    ))}
                    <option value="__custom__">+ Custom / Other Account...</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TextField
              label="Transaction / UTR Ref No. (Optional)"
              value={form.transaction_ref ?? ''}
              onChange={f('transaction_ref')}
              placeholder="UTR241700089123 or UPI Txn ID"
            />
            <TextField
              label="Note (Optional)"
              value={form.note ?? ''}
              onChange={f('note')}
              placeholder="e.g. Cheque clearance, partial balance, etc."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-line">
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editId ? 'Save Changes' : 'Record Payment'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
