// Unified Trip & Daily Hisab data store.
// Keeps Daily Hisab, Trips, and Dashboard 100% synchronized so the exact same data appears everywhere.

import type { PaymentMode, PaymentStatus } from '@/types/database';
import {
  fetchSupabaseTrips,
  upsertSupabaseTrip,
  deleteSupabaseTrip,
  generateUUID,
} from './supabase-service';
import {
  recordOrUpdatePaymentForTrip,
  removePaymentForTrip,
  getStoredPayments,
  recordOrUpdateFastagForTrip,
  recordOrUpdateDriverSilikForTrip,
} from './operations-store';
import type { Payment } from '@/types/database';
import { recordOrUpdateDieselForTrip, removeDieselForTrip } from './diesel-store';

export interface UnifiedTrip {
  id: string;
  sr_number: string;
  date: string;
  vehicle_no: string;
  driver_name: string;
  party_name: string;
  loading_from: string;
  loading_to: string;
  ton: number | null;
  unload_ton: number | null;
  rate_per_ton: number | null;
  total_freight: number | null;
  received_amount?: number | null; // Ketlu Aavyu (₹)
  balance_amount?: number | null;  // Ketlu Baki (₹)
  silik_date: string | null;
  driver_silik: number | null;
  payment_mode: PaymentMode | null;
  diesel_km_start: number | null;
  diesel_km_end: number | null;
  total_km: number | null;
  diesel_litres: number | null;
  diesel_rate: number | null;
  average_kmpl: number | null;
  diesel_cost: number | null;
  toll: number | null;
  other_expense: number | null;
  total_expense: number | null;
  profit: number | null;
  payment_status: PaymentStatus;
  notes: string | null;
  is_return_leg?: boolean;
  return_leg_for?: string | null;
  created_at: string;
}

const STORAGE_KEY = 'shreeji_transport_unified_trips_v8';

// Empty initial trips array (No mock data: trips load dynamically from Supabase)
export const canonicalInitialTrips: UnifiedTrip[] = [];

let memoryTrips: UnifiedTrip[] = [];
const listeners: Array<(trips: UnifiedTrip[]) => void> = [];

// Match SR variants only (SR0001, SR-0001, SR-000001). Do not match unrelated
// values that merely end with the same digits — that was summing the wrong
// payments into a trip and inflating received amounts.
function srIdentity(value: string): string | null {
  let s = value.trim().toLowerCase();
  s = s.replace(/\(return\)/g, ' ');
  s = s.replace(/\breturn\b/g, ' ');
  s = s.replace(/[^a-z0-9]/g, '');
  const match = s.match(/^sr0*(\d+)$/);
  if (!match) return null;
  return `sr${parseInt(match[1], 10)}`;
}

export function isSrNumberMatch(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const cleanA = a.trim().toLowerCase();
  const cleanB = b.trim().toLowerCase();
  if (cleanA === cleanB) return true;

  const alphaA = cleanA.replace(/[^a-z0-9]/g, '');
  const alphaB = cleanB.replace(/[^a-z0-9]/g, '');
  if (alphaA.length > 0 && alphaA === alphaB) return true;

  const idA = srIdentity(a);
  const idB = srIdentity(b);
  return Boolean(idA && idB && idA === idB);
}

// Distinguishes whether a payment belongs to a specific trip, especially
// when onward and return legs share the exact same SR number.
export function isPaymentForTrip(payment: Payment, trip: UnifiedTrip, allTrips?: UnifiedTrip[]): boolean {
  if (!payment || !trip) return false;

  // 1. Direct ID match
  if (payment.trip_ref && payment.trip_ref === trip.id) {
    return true;
  }

  // 2. Check if payment explicitly mentions 'return'
  const payRef = (payment.trip_ref || '').toLowerCase();
  const payNote = (payment.note || '').toLowerCase();
  const isReturnPayment = payRef.includes('return') || payRef.includes('-r') || payNote.includes('return');

  // Check if SR matches
  const srMatches = isSrNumberMatch(payment.trip_ref, trip.sr_number);
  if (!srMatches) {
    if (!payment.trip_ref && payment.party_name && trip.party_name) {
      const pMatches = payment.party_name.trim().toLowerCase() === trip.party_name.trim().toLowerCase();
      if (pMatches) {
        if (isReturnPayment) return Boolean(trip.is_return_leg);
        return !trip.is_return_leg;
      }
    }
    return false;
  }

  // At this point, SR number matches.
  // Check if there are other sibling trips sharing this same SR number (onward leg + return leg)
  const hasSiblings = allTrips && allTrips.some(
    other => other.id !== trip.id && isSrNumberMatch(other.sr_number, trip.sr_number)
  );

  if (hasSiblings) {
    // There are multiple trips with the same SR number!
    // 1. Return flag in payment
    if (isReturnPayment) {
      return Boolean(trip.is_return_leg);
    }

    // 2. Party Name comparison
    if (payment.party_name && trip.party_name) {
      const payParty = payment.party_name.trim().toLowerCase();
      const tripParty = trip.party_name.trim().toLowerCase();
      if (payParty.length > 0 && tripParty.length > 0) {
        if (payParty === tripParty) {
          return true;
        }
        // If this trip's party doesn't match, check if sibling trip's party matches
        const siblingMatchesParty = allTrips!.some(
          other => other.id !== trip.id &&
                   isSrNumberMatch(other.sr_number, trip.sr_number) &&
                   other.party_name &&
                   other.party_name.trim().toLowerCase() === payParty
        );
        if (siblingMatchesParty) {
          // The payment was meant for the other trip!
          return false;
        }
      }
    }

    // 3. If payment doesn't specify return, and party couldn't differentiate,
    // onward trip gets non-return payment by default
    if (trip.is_return_leg) {
      return false;
    }
    return true;
  }

  return true;
}

// Reconciles trips with payment collection records so received_amount and balance_amount
// are never 0 when payments exist in the payments table / store, and never bleed between onward and return legs
export function reconcileTripsWithPayments(trips: UnifiedTrip[], payments: Payment[]): UnifiedTrip[] {
  if (!Array.isArray(trips) || trips.length === 0) return trips;
  const payList = Array.isArray(payments) ? payments : [];

  return trips.map(trip => {
    // Find all payment records that match this specific trip
    const matchingPayments = payList.filter(p => isPaymentForTrip(p, trip, trips));

    const sumPayments = matchingPayments.reduce((sum, p) => sum + (Number(p.received_amount) || 0), 0);
    
    // Check if sibling trips with same SR have payments in payList
    const anyPaymentForThisSr = payList.some(p => isSrNumberMatch(p.trip_ref, trip.sr_number) || p.trip_ref === trip.id);
    const hasSiblingWithSameSr = trips.some(other => other.id !== trip.id && isSrNumberMatch(other.sr_number, trip.sr_number));

    const tripRec = trip.received_amount != null && !isNaN(Number(trip.received_amount))
      ? Number(trip.received_amount)
      : 0;

    let effectiveRec: number;
    if (tripRec > 0) {
      // Amount entered on the trip is the source of truth. Summing every
      // matching payment row double-counts duplicates and inflates the figure.
      effectiveRec = tripRec;
    } else if (matchingPayments.length > 0) {
      effectiveRec = sumPayments;
    } else if (hasSiblingWithSameSr && anyPaymentForThisSr) {
      // Sibling got the payment, so this leg did NOT get it!
      effectiveRec = 0;
    } else {
      effectiveRec = trip.received_amount != null && Number(trip.received_amount) > 0
        ? Number(trip.received_amount)
        : (trip.payment_status === 'received' ? (trip.total_freight ?? 0) : 0);
    }

    const totalFreight = trip.total_freight ?? 0;
    const balance = Math.max(0, totalFreight - effectiveRec);

    let status = trip.payment_status;
    if (totalFreight > 0 && effectiveRec >= totalFreight) {
      status = 'received';
    } else if (effectiveRec > 0) {
      status = 'partial';
    } else if (totalFreight > 0 && effectiveRec === 0) {
      status = 'pending';
    }

    const latestPayment = matchingPayments[matchingPayments.length - 1];
    const mode = latestPayment?.bank_account || latestPayment?.payment_mode || trip.payment_mode;

    return {
      ...trip,
      received_amount: effectiveRec,
      balance_amount: balance,
      payment_status: status,
      payment_mode: (mode as any) || trip.payment_mode,
    };
  });
}

// Helper to order trips so return legs always sit directly underneath their parent trip
export function organizeTripsWithReturns(tripList: UnifiedTrip[]): UnifiedTrip[] {
  const result: UnifiedTrip[] = [];
  const returnLegsByParent = new Map<string, UnifiedTrip[]>();
  const returnLegsBySr = new Map<string, UnifiedTrip[]>();

  for (const t of tripList) {
    if (t.is_return_leg) {
      if (t.return_leg_for) {
        const list = returnLegsByParent.get(t.return_leg_for) || [];
        list.push(t);
        returnLegsByParent.set(t.return_leg_for, list);
      }
      if (t.sr_number) {
        const srKey = t.sr_number.trim().toLowerCase();
        const list = returnLegsBySr.get(srKey) || [];
        list.push(t);
        returnLegsBySr.set(srKey, list);
      }
    }
  }

  const addedReturnIds = new Set<string>();

  for (const t of tripList) {
    if (!t.is_return_leg) {
      result.push(t);

      // 1. Check matching return legs by parent ID
      const returnsById = returnLegsByParent.get(t.id) || [];
      for (const ret of returnsById) {
        if (!addedReturnIds.has(ret.id)) {
          result.push(ret);
          addedReturnIds.add(ret.id);
        }
      }

      // 2. Check matching return legs by same SR number
      if (t.sr_number) {
        const srKey = t.sr_number.trim().toLowerCase();
        const returnsBySr = returnLegsBySr.get(srKey) || [];
        for (const ret of returnsBySr) {
          if (!addedReturnIds.has(ret.id)) {
            result.push(ret);
            addedReturnIds.add(ret.id);
          }
        }
      }
    }
  }

  for (const t of tripList) {
    if (t.is_return_leg && !addedReturnIds.has(t.id)) {
      result.push(t);
      addedReturnIds.add(t.id);
    }
  }

  return result;
}

export function computeUnifiedCalculations(input: Partial<UnifiedTrip>) {
  const ton = Number(input.ton) || 0;
  const rate = Number(input.rate_per_ton) || 0;
  
  // Total freight: allow manual override if entered > 0, otherwise ton * rate
  const total_freight = input.total_freight != null && Number(input.total_freight) > 0
    ? Number(input.total_freight)
    : ton * rate;

  // Received amount (Ketlu Aavyu): user entered amount
  const received_amount = input.received_amount != null && !isNaN(Number(input.received_amount))
    ? Math.max(0, Number(input.received_amount))
    : (input.payment_status === 'received' ? total_freight : 0);

  // Balance amount (Ketlu Baki): Total Freight - Received Amount
  const balance_amount = Math.max(0, total_freight - received_amount);

  const km_start = Number(input.diesel_km_start) || 0;
  const km_end = Number(input.diesel_km_end) || 0;
  const total_km = km_end > km_start ? km_end - km_start : 0;

  const litres = Number(input.diesel_litres) || 0;
  const diesel_rate = Number(input.diesel_rate) || 0;
  const average_kmpl = litres > 0 ? Number((total_km / litres).toFixed(2)) : 0;

  const diesel_cost = input.diesel_cost != null && Number(input.diesel_cost) > 0
    ? Number(input.diesel_cost)
    : (litres > 0 && diesel_rate > 0 ? Number((litres * diesel_rate).toFixed(0)) : 0);

  const toll = Number(input.toll) || 0;
  const silik = Number(input.driver_silik) || 0;
  const other = Number(input.other_expense) || 0;
  const total_expense = diesel_cost + toll + silik + other;

  const profit = total_freight - total_expense;

  return {
    total_freight,
    received_amount,
    balance_amount,
    total_km,
    average_kmpl,
    diesel_cost,
    total_expense,
    profit,
  };
}

export function getStoredTrips(): UnifiedTrip[] {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const payments = getStoredPayments();
          memoryTrips = reconcileTripsWithPayments(parsed, payments);
          return memoryTrips;
        }
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(canonicalInitialTrips));
      memoryTrips = [...canonicalInitialTrips];
    } catch (e) {
      console.warn('LocalStorage read error:', e);
    }
  }
  return memoryTrips;
}

export function getNextSrNumber(): string {
  const trips = getStoredTrips();
  let maxSeq = 0;
  let useHyphenFormat = false;

  for (const t of trips) {
    // Only count onward trips for the serial sequence - return legs do not advance sequence
    if (t && t.sr_number && !t.is_return_leg) {
      if (t.sr_number.includes('-')) useHyphenFormat = true;
      const match = t.sr_number.match(/SR-?(\d+)/i) || t.sr_number.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }
  }
  const nextSeq = maxSeq > 0 ? maxSeq + 1 : 1;
  return useHyphenFormat
    ? `SR-${String(nextSeq).padStart(6, '0')}`
    : `SR${String(nextSeq).padStart(4, '0')}`;
}

function notifyListeners() {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryTrips));
      window.dispatchEvent(new Event('shreeji_trips_updated'));
    } catch (e) {
      console.warn('LocalStorage write error:', e);
    }
  }
  listeners.forEach(fn => fn(memoryTrips));
}

export function subscribeTrips(fn: (trips: UnifiedTrip[]) => void): () => void {
  listeners.push(fn);
  if (typeof window !== 'undefined') {
    const handleStorage = () => fn(getStoredTrips());
    window.addEventListener('shreeji_trips_updated', handleStorage);
    window.addEventListener('storage', handleStorage);
    return () => {
      const idx = listeners.indexOf(fn);
      if (idx !== -1) listeners.splice(idx, 1);
      window.removeEventListener('shreeji_trips_updated', handleStorage);
      window.removeEventListener('storage', handleStorage);
    };
  }
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

export function saveTrip(entry: Partial<UnifiedTrip> & { id?: string; silik_payment_mode?: string | null }): UnifiedTrip {
  const trips = getStoredTrips();
  const calcs = computeUnifiedCalculations(entry);

  // Auto-determine payment status if not explicitly specified
  let status = entry.payment_status;
  if (!status) {
    if (calcs.total_freight > 0 && calcs.received_amount >= calcs.total_freight) {
      status = 'received';
    } else if (calcs.received_amount > 0) {
      status = 'partial';
    } else {
      status = 'pending';
    }
  }

  const finalEntry: UnifiedTrip = {
    id: entry.id || generateUUID(),
    sr_number: entry.sr_number || getNextSrNumber(),
    date: entry.date || new Date().toISOString().slice(0, 10),
    vehicle_no: entry.vehicle_no || '',
    driver_name: entry.driver_name || '',
    party_name: entry.party_name || '',
    loading_from: entry.loading_from || '',
    loading_to: entry.loading_to || '',
    ton: entry.ton != null && entry.ton !== ('' as unknown as number) ? Number(entry.ton) : null,
    unload_ton: entry.unload_ton != null && entry.unload_ton !== ('' as unknown as number) ? Number(entry.unload_ton) : null,
    rate_per_ton: entry.rate_per_ton != null && entry.rate_per_ton !== ('' as unknown as number) ? Number(entry.rate_per_ton) : null,
    total_freight: calcs.total_freight,
    received_amount: calcs.received_amount,
    balance_amount: calcs.balance_amount,
    silik_date: entry.silik_date || null,
    driver_silik: entry.driver_silik != null && entry.driver_silik !== ('' as unknown as number) ? Number(entry.driver_silik) : null,
    payment_mode: entry.payment_mode || 'Jaymin - HDFC',
    diesel_km_start: entry.diesel_km_start != null && entry.diesel_km_start !== ('' as unknown as number) ? Number(entry.diesel_km_start) : null,
    diesel_km_end: entry.diesel_km_end != null && entry.diesel_km_end !== ('' as unknown as number) ? Number(entry.diesel_km_end) : null,
    total_km: calcs.total_km,
    diesel_litres: entry.diesel_litres != null && entry.diesel_litres !== ('' as unknown as number) ? Number(entry.diesel_litres) : null,
    diesel_rate: entry.diesel_rate != null && entry.diesel_rate !== ('' as unknown as number) ? Number(entry.diesel_rate) : null,
    average_kmpl: calcs.average_kmpl,
    diesel_cost: calcs.diesel_cost,
    toll: entry.toll != null && entry.toll !== ('' as unknown as number) ? Number(entry.toll) : null,
    other_expense: entry.other_expense != null && entry.other_expense !== ('' as unknown as number) ? Number(entry.other_expense) : null,
    total_expense: calcs.total_expense,
    profit: calcs.profit,
    payment_status: status,
    notes: entry.notes || null,
    is_return_leg: entry.is_return_leg || false,
    return_leg_for: entry.return_leg_for || null,
    created_at: entry.created_at || new Date().toISOString(),
  };

  const existingIndex = trips.findIndex(t => t.id === finalEntry.id);
  if (existingIndex >= 0) {
    trips[existingIndex] = finalEntry;
  } else {
    trips.unshift(finalEntry);
  }

  memoryTrips = [...trips];
  notifyListeners();
  upsertSupabaseTrip(finalEntry).catch(() => {});

  const tripRefForPayment = finalEntry.is_return_leg
    ? `${finalEntry.sr_number} (Return)`
    : finalEntry.sr_number;

  // Sync freight / payment accounting to Payment module when freight or received is filled
  if ((finalEntry.total_freight && finalEntry.total_freight > 0) || (finalEntry.received_amount && finalEntry.received_amount > 0)) {
    try {
      recordOrUpdatePaymentForTrip(tripRefForPayment, {
        date: finalEntry.date,
        party_name: finalEntry.party_name,
        vehicle_no: finalEntry.vehicle_no,
        freight_amount: finalEntry.total_freight,
        received_amount: finalEntry.received_amount ?? 0,
        balance: finalEntry.balance_amount,
        payment_mode: finalEntry.payment_mode || 'Jaymin - HDFC',
        bank_account: finalEntry.payment_mode || 'Jaymin - HDFC',
        note: finalEntry.notes || `Freight collection for ${tripRefForPayment}`,
      });
    } catch (e) {
      console.warn('Could not sync trip payment to operations-store:', e);
    }
  }

  // Sync diesel details to Diesel module if entered
  if ((finalEntry.diesel_litres && Number(finalEntry.diesel_litres) > 0) || (finalEntry.diesel_cost && Number(finalEntry.diesel_cost) > 0)) {
    try {
      recordOrUpdateDieselForTrip(finalEntry);
    } catch (e) {
      console.warn('Could not sync trip diesel to diesel-store:', e);
    }
  }

  // Sync toll / Fastag / other expenses to Fastag module
  if ((finalEntry.toll && Number(finalEntry.toll) > 0) || (finalEntry.other_expense && Number(finalEntry.other_expense) > 0)) {
    try {
      recordOrUpdateFastagForTrip(finalEntry);
    } catch (e) {
      console.warn('Could not sync trip toll/fastag to operations-store:', e);
    }
  }

  // Sync driver silik to Driver Summary module
  if (finalEntry.driver_silik && Number(finalEntry.driver_silik) > 0) {
    try {
      const silikMode = (entry as { silik_payment_mode?: string | null }).silik_payment_mode;
      recordOrUpdateDriverSilikForTrip({
        ...finalEntry,
        silik_payment_mode: silikMode || null,
      });
    } catch (e) {
      console.warn('Could not sync trip silik to driver summary:', e);
    }
  }

  return finalEntry;
}

export function updateTripPayment(
  id: string,
  received_amount: number,
  payment_mode?: PaymentMode,
  payment_status?: PaymentStatus,
  options?: {
    date?: string;
    bank_account?: string | null;
    transaction_ref?: string | null;
    note?: string | null;
  }
): UnifiedTrip | null {
  const trips = getStoredTrips();
  const tripIndex = trips.findIndex(t => t.id === id);
  if (tripIndex === -1) return null;

  const trip = trips[tripIndex];
  const totalFreight = trip.total_freight ?? 0;
  const received = Math.max(0, Number(received_amount) || 0);
  const balance = Math.max(0, totalFreight - received);

  let status: PaymentStatus = payment_status || trip.payment_status;
  if (!payment_status) {
    if (totalFreight > 0 && received >= totalFreight) {
      status = 'received';
    } else if (received > 0) {
      status = 'partial';
    } else {
      status = 'pending';
    }
  }

  const updated: UnifiedTrip = {
    ...trip,
    received_amount: received,
    balance_amount: balance,
    payment_status: status,
    payment_mode: payment_mode || trip.payment_mode,
  };

  trips[tripIndex] = updated;
  memoryTrips = [...trips];
  notifyListeners();
  upsertSupabaseTrip(updated).catch(() => {});

  // Sync to operations-store so Payment page reflects this instantly
  const tripRefForPayment = trip.is_return_leg ? `${trip.sr_number} (Return)` : trip.sr_number;
  if (received > 0) {
    try {
      recordOrUpdatePaymentForTrip(tripRefForPayment, {
        date: options?.date || new Date().toISOString().slice(0, 10),
        party_name: trip.party_name,
        vehicle_no: trip.vehicle_no,
        freight_amount: totalFreight,
        received_amount: received,
        balance: balance,
        payment_mode: payment_mode || trip.payment_mode || 'Jaymin - HDFC',
        bank_account: options?.bank_account || payment_mode || trip.payment_mode || 'Jaymin - HDFC',
        transaction_ref: options?.transaction_ref || null,
        note: options?.note || `Freight collection for ${tripRefForPayment}`,
      });
    } catch (e) {
      console.warn('Could not sync trip payment update to operations-store:', e);
    }
  } else {
    try {
      removePaymentForTrip(tripRefForPayment);
    } catch (e) {
      console.warn('Could not remove payment for trip in operations-store:', e);
    }
  }

  return updated;
}

export function deleteTrip(id: string): UnifiedTrip[] {
  const trips = getStoredTrips();
  memoryTrips = trips.filter(t => t.id !== id);
  notifyListeners();
  deleteSupabaseTrip(id).catch(() => {});
  try {
    removeDieselForTrip(id);
  } catch (e) {
    console.warn('Could not remove diesel for trip:', e);
  }
  return memoryTrips;
}

export async function syncTripsFromSupabase(): Promise<UnifiedTrip[]> {
  const remote = await fetchSupabaseTrips();
  if (remote && remote.length > 0) {
    const localPayments = getStoredPayments();
    const reconciled = reconcileTripsWithPayments(remote, localPayments);
    memoryTrips = [...reconciled];
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryTrips));
      } catch (e) {
        console.warn('LocalStorage write error:', e);
      }
    }
    notifyListeners();

    // Module pages sync Diesel / Fastag / Payment / Driver Summary after both
    // trip and module rows have loaded. Doing it here raced with those fetches
    // and left duplicate or inflated rows in the database.
    return memoryTrips;
  }
  return getStoredTrips();
}
