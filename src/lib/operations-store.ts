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
    saveStored(KEYS.fastag, remote);
    return remote;
  }
  return getStoredFastag();
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
  const cleanRef = tripRef.trim().toLowerCase();
  const cleanAlnum = cleanRef.replace(/[^a-z0-9]/g, '');
  const existingIndex = list.findIndex(p => {
    if (!p.trip_ref) return false;
    const pRef = p.trip_ref.trim().toLowerCase();
    if (pRef === cleanRef) return true;
    const pAlnum = pRef.replace(/[^a-z0-9]/g, '');
    return cleanAlnum.length > 0 && pAlnum === cleanAlnum;
  });
  
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
    id: existingIndex >= 0 ? list[existingIndex].id : generateUUID(),
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
    created_at: existingIndex >= 0 ? list[existingIndex].created_at : new Date().toISOString(),
  };

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
}>) {
  const list = getStoredPayments();
  let changed = false;

  for (const t of trips) {
    const rec = t.received_amount != null ? Number(t.received_amount) : (t.payment_status === 'received' ? (t.total_freight ?? 0) : 0);
    if (rec > 0) {
      const existing = list.find(p => p.trip_ref && p.trip_ref.trim().toLowerCase() === t.sr_number.trim().toLowerCase());
      if (!existing) {
        const rawAccount = (t.payment_mode || 'Jaymin - HDFC').trim();
        let resolvedAccount = rawAccount;
        const rawLower = rawAccount.toLowerCase();
        let resolvedMode: PaymentMode = 'bank_transfer';

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

        const tf = t.total_freight ?? 0;
        const bal = t.balance_amount != null ? Number(t.balance_amount) : Math.max(0, tf - rec);

        const newPay: Payment = {
          id: generateUUID(),
          transport_id: 'a0000000-0000-0000-0000-000000000001',
          date: t.date || new Date().toISOString().slice(0, 10),
          party_name: t.party_name,
          vehicle_no: t.vehicle_no || null,
          trip_ref: t.sr_number,
          freight_amount: tf,
          received_amount: rec,
          balance: bal,
          payment_mode: resolvedMode,
          bank_account: resolvedAccount,
          transaction_ref: null,
          note: `Freight collection for ${t.sr_number}`,
          created_at: new Date().toISOString(),
        };
        list.push(newPay);
        changed = true;
        upsertSupabasePayment(newPay).catch(() => {});
      }
    }
  }

  if (changed) {
    saveStored(KEYS.payment, list);
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
    saveStored(KEYS.driverSummary, remote);
    return remote;
  }
  return getStoredDriverSummaries();
}

