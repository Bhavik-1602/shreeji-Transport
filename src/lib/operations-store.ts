// Operations & Reports Data Store with LocalStorage persistence so newly added or edited
// Maintenance, Fastag, Payment, Investment, and Driver Summary records persist across the entire ERP.

import type {
  Maintenance,
  Fastag,
  Payment,
  PaymentMode,
  Investment,
  DriverSummary,
} from '@/types/database';
import {
  fetchSupabasePayments,
  upsertSupabasePayment,
  deleteSupabasePayment,
  fetchSupabaseMaintenance,
  upsertSupabaseMaintenance,
  deleteSupabaseMaintenance,
  fetchSupabaseFastag,
  upsertSupabaseFastag,
  deleteSupabaseFastag,
  fetchSupabaseInvestments,
  upsertSupabaseInvestment,
  deleteSupabaseInvestment,
  fetchSupabaseDriverSummaries,
  upsertSupabaseDriverSummary,
  deleteSupabaseDriverSummary,
  generateUUID,
} from './supabase-service';

const initialMaintenance: Maintenance[] = [];
const initialFastag: Fastag[] = [];
const initialPayments: Payment[] = [];
const initialInvestments: Investment[] = [];
const initialDriverSummaries: DriverSummary[] = [];

const KEYS = {
  maintenance: 'shreeji_transport_maintenance_v6',
  fastag: 'shreeji_transport_fastag_v6',
  payment: 'shreeji_transport_payment_v6',
  investment: 'shreeji_transport_investment_v6',
  driverSummary: 'shreeji_transport_driver_summary_v6',
};

function getStored<T>(key: string, defaultData: T[] = []): T[] {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn(`Error reading ${key}:`, e);
    }
  }
  return defaultData;
}

function saveStored<T>(key: string, data: T[]) {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      window.dispatchEvent(new Event('shreeji_operations_updated'));
    } catch (e) {
      console.warn(`Error saving ${key}:`, e);
    }
  }
}

// ─── Maintenance ────────────────────────────────────────
export function getStoredMaintenance(): Maintenance[] {
  return getStored<Maintenance>(KEYS.maintenance, initialMaintenance);
}

export function saveMaintenance(entry: Maintenance): Maintenance[] {
  const list = getStoredMaintenance();
  const idx = list.findIndex(m => m.id === entry.id);
  let updated: Maintenance[];
  if (idx >= 0) {
    updated = list.map(m => (m.id === entry.id ? entry : m));
  } else {
    updated = [entry, ...list];
  }
  saveStored(KEYS.maintenance, updated);
  upsertSupabaseMaintenance(entry).catch(() => {});
  return updated;
}

export function deleteMaintenance(id: string): Maintenance[] {
  const list = getStoredMaintenance();
  const updated = list.filter(m => m.id !== id);
  saveStored(KEYS.maintenance, updated);
  deleteSupabaseMaintenance(id).catch(() => {});
  return updated;
}

export async function syncMaintenanceFromSupabase(): Promise<Maintenance[]> {
  const remote = await fetchSupabaseMaintenance();
  if (remote !== null && remote.length > 0) {
    saveStored(KEYS.maintenance, remote);
    return remote;
  }
  return getStoredMaintenance();
}

// ─── Fastag ─────────────────────────────────────────────
export function getStoredFastag(): Fastag[] {
  return getStored<Fastag>(KEYS.fastag, initialFastag);
}

export function getNextFastagNo(vehicle_no?: string): string {
  const list = getStoredFastag();
  if (vehicle_no && vehicle_no.trim()) {
    const cleanVeh = vehicle_no.replace(/[^A-Za-z0-9]/g, '');
    return `FT-${cleanVeh}`;
  }
  let maxSeq = 0;
  for (const item of list) {
    if (item.fastag_no) {
      const match = item.fastag_no.match(/FT-(\d+)$/i) || item.fastag_no.match(/(\d+)$/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (!isNaN(n) && n < 10000 && n > maxSeq) {
          maxSeq = n;
        }
      }
    }
  }
  const next = maxSeq > 0 ? maxSeq + 1 : list.length + 1;
  return `FT-${String(next).padStart(4, '0')}`;
}

export function saveFastag(entry: Fastag): Fastag[] {
  const list = getStoredFastag();
  const idx = list.findIndex(f => f.id === entry.id);
  let updated: Fastag[];
  if (idx >= 0) {
    updated = list.map(f => (f.id === entry.id ? entry : f));
  } else {
    updated = [entry, ...list];
  }
  saveStored(KEYS.fastag, updated);
  upsertSupabaseFastag(entry).catch(() => {});
  return updated;
}

export function deleteFastag(id: string): Fastag[] {
  const list = getStoredFastag();
  const updated = list.filter(f => f.id !== id);
  saveStored(KEYS.fastag, updated);
  deleteSupabaseFastag(id).catch(() => {});
  return updated;
}

export async function syncFastagFromSupabase(): Promise<Fastag[]> {
  const remote = await fetchSupabaseFastag();
  if (remote !== null && remote.length > 0) {
    // Keep local trip-synced rows that are not yet on remote
    const local = getStoredFastag();
    const remoteIds = new Set(remote.map(r => r.id));
    const localOnly = local.filter(l => !remoteIds.has(l.id));
    const merged = [...remote, ...localOnly];
    saveStored(KEYS.fastag, merged);
    return merged;
  }
  return getStoredFastag();
}

/** True when a note cites this SR, without letting SR-000001 match SR-0000010. */
function noteMentionsSr(note: string, sr: string): boolean {
  const key = sr.trim().toLowerCase();
  if (!key) return false;
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}(?!\\d)`, 'i').test(note);
}

function tripFastagNote(sr: string, isReturn?: boolean, from?: string, to?: string): string {
  const leg = isReturn ? 'Return' : 'Onward';
  const route = from || to ? ` (${from || '—'} to ${to || '—'})` : '';
  return `Trip ${sr} ${leg} Toll/FASTag${route}`;
}

/** Sync trip toll / other road expenses into Fastag module */
export function syncFastagFromTrips(trips: Array<{
  id: string;
  sr_number: string;
  date: string;
  vehicle_no: string;
  payment_mode?: PaymentMode | null;
  toll?: number | null;
  other_expense?: number | null;
  loading_from?: string;
  loading_to?: string;
  is_return_leg?: boolean;
}>): Fastag[] {
  let list = getStoredFastag();
  let changed = false;
  const DEFAULT_TRANSPORT_ID = 'a0000000-0000-0000-0000-000000000001';

  for (const t of trips) {
    const toll = Number(t.toll) || 0;
    const other = Number(t.other_expense) || 0;
    const amount = toll + other;
    const note = tripFastagNote(t.sr_number, t.is_return_leg, t.loading_from, t.loading_to);
    const matchIndexes: number[] = [];
    list.forEach((f, idx) => {
      const n = f.note || '';
      if (!noteMentionsSr(n, t.sr_number || '')) return;
      const lower = n.toLowerCase();
      const isReturnNote = lower.includes('return');
      const isThisLeg = t.is_return_leg
        ? isReturnNote
        : !isReturnNote && (lower.includes('toll') || lower.includes('other expense'));
      if (isThisLeg) matchIndexes.push(idx);
    });
    const existingIdx = matchIndexes[0] ?? -1;

    if (amount > 0) {
      const mode = (t.payment_mode || 'upi') as PaymentMode;
      if (existingIdx >= 0) {
        const existing = list[existingIdx];
        if (
          Number(existing.recharge_amount) !== Number(amount) ||
          existing.vehicle_no !== (t.vehicle_no || null) ||
          existing.date !== t.date
        ) {
          const updated: Fastag = {
            ...existing,
            date: t.date || existing.date,
            recharge_amount: amount,
            payment_mode: mode,
            vehicle_no: t.vehicle_no || existing.vehicle_no,
            note: other > 0 && toll > 0
              ? `${note} | Toll ₹${toll} + Other ₹${other}`
              : other > 0 && toll <= 0
                ? `${note.replace('Toll/FASTag', 'Other Expense')} | ₹${other}`
                : note,
          };
          list[existingIdx] = updated;
          changed = true;
          upsertSupabaseFastag(updated).catch(() => {});
        }
      } else {
        const entry: Fastag = {
          id: generateUUID(),
          transport_id: DEFAULT_TRANSPORT_ID,
          fastag_no: getNextFastagNo(t.vehicle_no),
          date: t.date || new Date().toISOString().slice(0, 10),
          recharge_amount: amount,
          payment_mode: mode,
          vehicle_no: t.vehicle_no || null,
          note: other > 0 && toll > 0
            ? `${note} | Toll ₹${toll} + Other ₹${other}`
            : other > 0 && toll <= 0
              ? `Trip ${t.sr_number} ${t.is_return_leg ? 'Return' : 'Onward'} Other Expense (${t.loading_from || '—'} to ${t.loading_to || '—'}) | ₹${other}`
              : note,
          created_at: new Date().toISOString(),
        };
        // Avoid duplicate FT numbers when adding multiple in one sync loop
        list = [entry, ...list];
        changed = true;
        upsertSupabaseFastag(entry).catch(() => {});
      }

      const extraIds = matchIndexes.slice(1).map(idx => list[idx]?.id).filter(Boolean) as string[];
      if (extraIds.length > 0) {
        list = list.filter(f => !extraIds.includes(f.id));
        changed = true;
        extraIds.forEach(id => deleteSupabaseFastag(id).catch(() => {}));
      }
    } else if (existingIdx >= 0) {
      const removedIds = matchIndexes.map(idx => list[idx]?.id).filter(Boolean) as string[];
      list = list.filter(f => !removedIds.includes(f.id));
      changed = true;
      removedIds.forEach(id => deleteSupabaseFastag(id).catch(() => {}));
    }
  }

  if (changed) {
    saveStored(KEYS.fastag, list);
  }
  return list;
}

export function recordOrUpdateFastagForTrip(trip: {
  id: string;
  sr_number: string;
  date: string;
  vehicle_no: string;
  payment_mode?: PaymentMode | null;
  toll?: number | null;
  other_expense?: number | null;
  loading_from?: string;
  loading_to?: string;
  is_return_leg?: boolean;
}): void {
  syncFastagFromTrips([trip]);
}

// ─── Payment ────────────────────────────────────────────
export function getStoredPayments(): Payment[] {
  return getStored<Payment>(KEYS.payment, initialPayments);
}

export function savePayment(entry: Payment): Payment[] {
  const list = getStoredPayments();
  const idx = list.findIndex(p => p.id === entry.id);
  let updated: Payment[];
  if (idx >= 0) {
    updated = list.map(p => (p.id === entry.id ? entry : p));
  } else {
    updated = [entry, ...list];
  }
  saveStored(KEYS.payment, updated);
  upsertSupabasePayment(entry).catch(() => {});
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new Event('shreeji_trips_updated'));
      window.dispatchEvent(new Event('shreeji_payments_updated'));
    } catch {}
  }
  return updated;
}

export function deletePayment(id: string): Payment[] {
  const list = getStoredPayments();
  const updated = list.filter(p => p.id !== id);
  saveStored(KEYS.payment, updated);
  deleteSupabasePayment(id).catch(() => {});
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new Event('shreeji_trips_updated'));
      window.dispatchEvent(new Event('shreeji_payments_updated'));
    } catch {}
  }
  return updated;
}

export async function syncPaymentsFromSupabase(): Promise<Payment[]> {
  const remote = await fetchSupabasePayments();
  if (remote !== null && remote.length > 0) {
    // Merge: remote is source of truth, but also keep any local-only payments not yet in Supabase
    const local = getStoredPayments();
    const remoteIds = new Set(remote.map(r => r.id));
    const localOnlyPayments = local.filter(p => !remoteIds.has(p.id));
    const merged = [...remote, ...localOnlyPayments];
    saveStored(KEYS.payment, merged);
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new Event('shreeji_trips_updated'));
      } catch {}
    }
    return merged;
  }
  return getStoredPayments();

}

function paymentRefKey(ref: string | null | undefined): string {
  return (ref || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function recordOrUpdatePaymentForTrip(
  tripRef: string,
  paymentData: {
    date?: string;
    party_name: string;
    vehicle_no?: string | null;
    freight_amount?: number | null;
    received_amount: number;
    balance?: number | null;
    payment_mode?: PaymentMode;
    bank_account?: string | null;
    transaction_ref?: string | null;
    note?: string | null;
  }
): Payment {
  const list = getStoredPayments();
  const refKey = paymentRefKey(tripRef);
  const matches = refKey
    ? list.filter(p => p.trip_ref && paymentRefKey(p.trip_ref) === refKey)
    : [];
  const existing = matches[0];
  const duplicateIds = matches.slice(1).map(p => p.id);
  
  const rawAccount = (paymentData.bank_account || paymentData.payment_mode || 'Jaymin - HDFC').trim();
  let resolvedAccount = rawAccount;
  const rawLower = rawAccount.toLowerCase();
  let resolvedMode: PaymentMode = paymentData.payment_mode || 'bank_transfer';

  if (rawLower === 'cash' || rawLower === 'case') {
    resolvedAccount = 'Cash';
    resolvedMode = 'cash';
  } else if (rawLower === 'online' || rawLower === 'upi' || rawLower === 'online / upi') {
    resolvedAccount = 'Online / UPI';
    resolvedMode = 'upi';
  } else if (rawLower === 'bank_transfer') {
    resolvedAccount = 'Jaymin - HDFC';
    resolvedMode = 'bank_transfer';
  } else {
    resolvedAccount = rawAccount;
    if (rawLower.includes('cash') || rawLower.includes('case')) {
      resolvedMode = 'cash';
    } else if (rawLower.includes('online') || rawLower.includes('upi')) {
      resolvedMode = 'upi';
    } else {
      resolvedMode = 'bank_transfer';
    }
  }

  const DEFAULT_TRANSPORT_ID = 'a0000000-0000-0000-0000-000000000001';
  const entry: Payment = {
    id: existing ? existing.id : generateUUID(),
    transport_id: DEFAULT_TRANSPORT_ID,
    date: paymentData.date || new Date().toISOString().slice(0, 10),
    party_name: paymentData.party_name,
    vehicle_no: paymentData.vehicle_no || null,
    trip_ref: tripRef,
    freight_amount: paymentData.freight_amount != null ? Number(paymentData.freight_amount) : null,
    received_amount: Number(paymentData.received_amount),
    balance: paymentData.balance != null ? Number(paymentData.balance) : null,
    payment_mode: resolvedMode,
    bank_account: resolvedAccount,
    transaction_ref: paymentData.transaction_ref || null,
    note: paymentData.note || null,
    created_at: existing ? existing.created_at : new Date().toISOString(),
  };

  const unchanged = existing && duplicateIds.length === 0
    && Number(existing.received_amount) === Number(entry.received_amount)
    && Number(existing.freight_amount || 0) === Number(entry.freight_amount || 0)
    && Number(existing.balance || 0) === Number(entry.balance || 0)
    && (existing.party_name || '') === (entry.party_name || '')
    && (existing.vehicle_no || '') === (entry.vehicle_no || '')
    && (existing.trip_ref || '') === (entry.trip_ref || '')
    && (existing.bank_account || '') === (entry.bank_account || '')
    && (existing.payment_mode || '') === (entry.payment_mode || '')
    && (existing.note || '') === (entry.note || '')
    && (existing.date || '') === (entry.date || '');
  if (unchanged) return existing;

  if (duplicateIds.length > 0) {
    const pruned = getStoredPayments().filter(p => !duplicateIds.includes(p.id));
    saveStored(KEYS.payment, pruned);
    duplicateIds.forEach(id => deleteSupabasePayment(id).catch(() => {}));
  }

  savePayment(entry);
  return entry;
}

export function removePaymentForTrip(tripRef: string): Payment[] {
  const list = getStoredPayments();
  const target = list.find(p => p.trip_ref && p.trip_ref.trim().toLowerCase() === tripRef.trim().toLowerCase());
  if (target) {
    return deletePayment(target.id);
  }
  return list;
}

export function syncPaymentsFromTrips(trips: Array<{
  id?: string;
  sr_number: string;
  date: string;
  party_name: string;
  vehicle_no: string;
  total_freight: number | null;
  received_amount?: number | null;
  balance_amount?: number | null;
  payment_mode?: PaymentMode | null;
  payment_status?: string;
  notes?: string | null;
  is_return_leg?: boolean;
}>) {
  for (const t of trips) {
    const tf = t.total_freight != null ? Number(t.total_freight) : 0;
    const rec = t.received_amount != null
      ? Number(t.received_amount)
      : (t.payment_status === 'received' ? tf : 0);
    // Show on Payment page when freight or received amount was filled on the trip
    if (tf > 0 || rec > 0) {
      const tripRef = t.is_return_leg ? `${t.sr_number} (Return)` : t.sr_number;
      const bal = t.balance_amount != null ? Number(t.balance_amount) : Math.max(0, tf - rec);
      recordOrUpdatePaymentForTrip(tripRef, {
        date: t.date,
        party_name: t.party_name,
        vehicle_no: t.vehicle_no,
        freight_amount: tf,
        received_amount: rec,
        balance: bal,
        payment_mode: t.payment_mode || 'Jaymin - HDFC',
        bank_account: t.payment_mode || 'Jaymin - HDFC',
        note: t.notes || `Freight collection for ${tripRef}`,
      });
    }
  }
}


// ─── Investment ─────────────────────────────────────────
export function getStoredInvestments(): Investment[] {
  return getStored<Investment>(KEYS.investment, initialInvestments);
}

export function saveInvestment(entry: Investment): Investment[] {
  const list = getStoredInvestments();
  const idx = list.findIndex(i => i.id === entry.id);
  let updated: Investment[];
  if (idx >= 0) {
    updated = list.map(i => (i.id === entry.id ? entry : i));
  } else {
    updated = [entry, ...list];
  }
  saveStored(KEYS.investment, updated);
  upsertSupabaseInvestment(entry).catch(() => {});
  return updated;
}

export function deleteInvestment(id: string): Investment[] {
  const list = getStoredInvestments();
  const updated = list.filter(i => i.id !== id);
  saveStored(KEYS.investment, updated);
  deleteSupabaseInvestment(id).catch(() => {});
  return updated;
}

export async function syncInvestmentsFromSupabase(): Promise<Investment[]> {
  const remote = await fetchSupabaseInvestments();
  if (remote !== null && remote.length > 0) {
    saveStored(KEYS.investment, remote);
    return remote;
  }
  return getStoredInvestments();
}

// ─── Driver Summary ─────────────────────────────────────
export function getStoredDriverSummaries(): DriverSummary[] {
  return getStored<DriverSummary>(KEYS.driverSummary, initialDriverSummaries);
}

export function saveDriverSummary(entry: DriverSummary): DriverSummary[] {
  const list = getStoredDriverSummaries();
  const idx = list.findIndex(d => d.id === entry.id);
  let updated: DriverSummary[];
  if (idx >= 0) {
    updated = list.map(d => (d.id === entry.id ? entry : d));
  } else {
    updated = [entry, ...list];
  }
  saveStored(KEYS.driverSummary, updated);
  upsertSupabaseDriverSummary(entry).catch(() => {});
  return updated;
}

export function deleteDriverSummary(id: string): DriverSummary[] {
  const list = getStoredDriverSummaries();
  const updated = list.filter(d => d.id !== id);
  saveStored(KEYS.driverSummary, updated);
  deleteSupabaseDriverSummary(id).catch(() => {});
  return updated;
}

export async function syncDriverSummariesFromSupabase(): Promise<DriverSummary[]> {
  const remote = await fetchSupabaseDriverSummaries();
  if (remote !== null && remote.length > 0) {
    const local = getStoredDriverSummaries();
    const remoteIds = new Set(remote.map(r => r.id));
    const localOnly = local.filter(l => !remoteIds.has(l.id));
    const merged = [...remote, ...localOnly];
    saveStored(KEYS.driverSummary, merged);
    return merged;
  }
  return getStoredDriverSummaries();
}

function tripSilikNote(sr: string, isReturn?: boolean, from?: string, to?: string, mode?: string | null): string {
  const route = from || to ? ` (${from || '—'} to ${to || '—'})` : '';
  const base = isReturn ? `Return leg advance for ${sr}${route}` : `Trip advance for ${sr}${route}`;
  return mode ? `${base} | Silik via ${mode}` : base;
}

/** Sync trip driver silik into Driver Summary module */
export function syncDriverSummariesFromTrips(trips: Array<{
  id: string;
  sr_number: string;
  date: string;
  silik_date?: string | null;
  vehicle_no: string;
  driver_name: string;
  driver_silik?: number | null;
  silik_payment_mode?: string | null;
  loading_from?: string;
  loading_to?: string;
  is_return_leg?: boolean;
}>): DriverSummary[] {
  let list = getStoredDriverSummaries();
  let changed = false;
  const DEFAULT_TRANSPORT_ID = 'a0000000-0000-0000-0000-000000000001';

  for (const t of trips) {
    const silik = Number(t.driver_silik) || 0;
    const matchIndexes: number[] = [];
    list.forEach((d, idx) => {
      const n = d.note || '';
      if (!noteMentionsSr(n, t.sr_number || '')) return;
      const isReturnNote = n.toLowerCase().includes('return');
      if (t.is_return_leg ? isReturnNote : !isReturnNote) matchIndexes.push(idx);
    });
    const existingIdx = matchIndexes[0] ?? -1;

    if (silik > 0) {
      let note = tripSilikNote(t.sr_number, t.is_return_leg, t.loading_from, t.loading_to, t.silik_payment_mode);
      if (!t.silik_payment_mode && existingIdx >= 0) {
        const prevMode = (list[existingIdx].note || '').match(/\|\s*Silik via\s+.+$/);
        if (prevMode) note = `${note} ${prevMode[0]}`;
      }
      const entryDate = t.silik_date || t.date || new Date().toISOString().slice(0, 10);
      if (existingIdx >= 0) {
        const existing = list[existingIdx];
        if (
          Number(existing.silik_amount) !== Number(silik) ||
          existing.driver_name !== t.driver_name ||
          existing.vehicle_no !== t.vehicle_no ||
          existing.date !== entryDate ||
          existing.note !== note
        ) {
          const updated: DriverSummary = {
            ...existing,
            date: entryDate,
            vehicle_no: t.vehicle_no || existing.vehicle_no,
            driver_name: t.driver_name || existing.driver_name,
            silik_amount: silik,
            note,
          };
          list[existingIdx] = updated;
          changed = true;
          upsertSupabaseDriverSummary(updated).catch(() => {});
        }
      } else {
        const entry: DriverSummary = {
          id: generateUUID(),
          transport_id: DEFAULT_TRANSPORT_ID,
          date: entryDate,
          vehicle_no: t.vehicle_no || '—',
          driver_name: t.driver_name || '—',
          silik_amount: silik,
          note,
          created_at: new Date().toISOString(),
        };
        list = [entry, ...list];
        changed = true;
        upsertSupabaseDriverSummary(entry).catch(() => {});
      }

      const extraIds = matchIndexes.slice(1).map(idx => list[idx]?.id).filter(Boolean) as string[];
      if (extraIds.length > 0) {
        list = list.filter(d => !extraIds.includes(d.id));
        changed = true;
        extraIds.forEach(id => deleteSupabaseDriverSummary(id).catch(() => {}));
      }
    } else if (existingIdx >= 0) {
      const removedIds = matchIndexes.map(idx => list[idx]?.id).filter(Boolean) as string[];
      list = list.filter(d => !removedIds.includes(d.id));
      changed = true;
      removedIds.forEach(id => deleteSupabaseDriverSummary(id).catch(() => {}));
    }
  }

  if (changed) {
    saveStored(KEYS.driverSummary, list);
  }
  return list;
}

export function recordOrUpdateDriverSilikForTrip(trip: {
  id: string;
  sr_number: string;
  date: string;
  silik_date?: string | null;
  vehicle_no: string;
  driver_name: string;
  driver_silik?: number | null;
  silik_payment_mode?: string | null;
  loading_from?: string;
  loading_to?: string;
  is_return_leg?: boolean;
}): void {
  syncDriverSummariesFromTrips([trip]);
}

