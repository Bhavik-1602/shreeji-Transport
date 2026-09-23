// Diesel Management Data Store
import type { DieselEntry } from '@/types/database';
import {
  fetchSupabaseDiesel,
  upsertSupabaseDiesel,
  deleteSupabaseDiesel,
  generateUUID,
} from './supabase-service';

const STORAGE_KEY = 'shreeji_transport_diesel_v1';

export const initialDieselEntries: DieselEntry[] = [
  {
    id: '30000000-0000-0000-0000-000000000001',
    transport_id: 'a0000000-0000-0000-0000-000000000001',
    sr_no: 1,
    date: '2026-09-09',
    slip_no: '117',
    truck_no: 'GJ03CW9144',
    diesel_liter: 302.1,
    rate: 99.53,
    amount: 30068.01,
    driver_name: 'SANJAY',
    created_at: '2026-09-09T10:00:00Z',
  },
  {
    id: '30000000-0000-0000-0000-000000000002',
    transport_id: 'a0000000-0000-0000-0000-000000000001',
    sr_no: 2,
    date: '2026-09-10',
    slip_no: '122',
    truck_no: 'GJ03CW9144',
    diesel_liter: 207,
    rate: 99.53,
    amount: 20602.71,
    driver_name: 'SANJAY',
    created_at: '2026-09-10T10:00:00Z',
  },
  {
    id: '30000000-0000-0000-0000-000000000003',
    transport_id: 'a0000000-0000-0000-0000-000000000001',
    sr_no: 3,
    date: '2026-09-12',
    slip_no: '134',
    truck_no: 'GJ03CW9144',
    diesel_liter: 214.38,
    rate: 99.53,
    amount: 21337.24,
    driver_name: 'SEBAJ',
    created_at: '2026-09-12T10:00:00Z',
  },
  {
    id: '30000000-0000-0000-0000-000000000004',
    transport_id: 'a0000000-0000-0000-0000-000000000001',
    sr_no: 4,
    date: '2026-09-15',
    slip_no: '148',
    truck_no: 'GJ03CW9144',
    diesel_liter: 266.13,
    rate: 99.53,
    amount: 26487.92,
    driver_name: 'SEBAJ',
    created_at: '2026-09-15T10:00:00Z',
  },
  {
    id: '30000000-0000-0000-0000-000000000005',
    transport_id: 'a0000000-0000-0000-0000-000000000001',
    sr_no: 5,
    date: '2026-09-17',
    slip_no: '157',
    truck_no: 'GJ03CW9144',
    diesel_liter: 231.01,
    rate: 99.53,
    amount: 22992.43,
    driver_name: 'IQBAL',
    created_at: '2026-09-17T10:00:00Z',
  },
  {
    id: '30000000-0000-0000-0000-000000000006',
    transport_id: 'a0000000-0000-0000-0000-000000000001',
    sr_no: 6,
    date: '2026-09-20',
    slip_no: '169',
    truck_no: 'GJ03CW9144',
    diesel_liter: 250.04,
    rate: 99.53,
    amount: 24886.48,
    driver_name: 'SEBAJ',
    created_at: '2026-09-20T10:00:00Z',
  },
];

export function getStoredDiesel(): DieselEntry[] {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialDieselEntries));
      return initialDieselEntries;
    } catch {
      return initialDieselEntries;
    }
  }
  return initialDieselEntries;
}

export function saveDieselEntry(entry: Partial<DieselEntry> & { id?: string }): DieselEntry[] {
  const list = getStoredDiesel();
  const id = entry.id || generateUUID();
  const liter = Number(entry.diesel_liter) || 0;
  const rate = Number(entry.rate) || 0;
  const computedAmount = entry.amount != null ? Number(entry.amount) : Number((liter * rate).toFixed(2));

  // Auto assign next sr_no if not present
  let sr = entry.sr_no;
  if (!sr) {
    const maxSr = list.reduce((m, item) => Math.max(m, item.sr_no || 0), 0);
    sr = maxSr + 1;
  }

  const completeEntry: DieselEntry = {
    id,
    transport_id: 'a0000000-0000-0000-0000-000000000001',
    sr_no: sr,
    date: entry.date || new Date().toISOString().slice(0, 10),
    slip_no: entry.slip_no ? String(entry.slip_no).trim() : '',
    truck_no: entry.truck_no ? String(entry.truck_no).trim().toUpperCase() : '',
    diesel_liter: liter,
    rate: rate,
    amount: computedAmount,
    driver_name: entry.driver_name ? String(entry.driver_name).trim() : '',
    pump_name: entry.pump_name?.trim() || null,
    notes: entry.notes?.trim() || null,
    created_at: entry.created_at || new Date().toISOString(),
  };

  const idx = list.findIndex(item => item.id === id);
  let updated: DieselEntry[];
  if (idx >= 0) {
    updated = list.map(item => (item.id === id ? completeEntry : item));
  } else {
    updated = [completeEntry, ...list];
  }

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event('shreeji_diesel_updated'));
    } catch {}
  }

  upsertSupabaseDiesel(completeEntry).catch(() => {});
  return updated;
}

export function deleteDieselEntry(id: string): DieselEntry[] {
  const list = getStoredDiesel();
  const updated = list.filter(item => item.id !== id);

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event('shreeji_diesel_updated'));
    } catch {}
  }

  deleteSupabaseDiesel(id).catch(() => {});
  return updated;
}

export async function syncDieselFromSupabase(): Promise<DieselEntry[]> {
  const remote = await fetchSupabaseDiesel();
  if (remote !== null && remote.length > 0) {
    const local = getStoredDiesel();
    const remoteIds = new Set(remote.map(r => r.id));
    const localOnly = local.filter(l => !remoteIds.has(l.id));
    const merged = [...remote, ...localOnly];

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        window.dispatchEvent(new Event('shreeji_diesel_updated'));
      } catch {}
    }
    return merged;
  }
  return getStoredDiesel();
}

export function syncDieselFromTrips(trips: Array<{
  id: string;
  sr_number: string;
  date: string;
  vehicle_no: string;
  driver_name: string;
  loading_from?: string;
  loading_to?: string;
  diesel_litres?: number | null;
  diesel_rate?: number | null;
  diesel_cost?: number | null;
  is_return_leg?: boolean;
}>): DieselEntry[] {
  let list = getStoredDiesel();
  let changed = false;

  for (const t of trips) {
    let litres = t.diesel_litres != null ? Number(t.diesel_litres) : 0;
    const cost = t.diesel_cost != null ? Number(t.diesel_cost) : 0;
    const rate = t.diesel_rate != null && Number(t.diesel_rate) > 0
      ? Number(t.diesel_rate)
      : (litres > 0 && cost > 0 ? Number((cost / litres).toFixed(2)) : 99.53);

    // If litres is 0 but cost > 0, compute litres from cost and rate
    if (litres <= 0 && cost > 0 && rate > 0) {
      litres = Number((cost / rate).toFixed(2));
    }

    // Only sync if trip has diesel details
    if (litres > 0 || cost > 0) {
      const computedAmount = cost > 0 ? cost : Number((litres * rate).toFixed(2));
      const cleanSr = t.sr_number ? t.sr_number.trim() : '';
      const slipLabel = t.is_return_leg ? `${cleanSr} (Return)` : (cleanSr || 'TRIP-DIESEL');

      // Check if entry already exists by trip_id or matching slip_no/SR
      const existingIdx = list.findIndex(e =>
        (e.trip_id && e.trip_id === t.id) ||
        (cleanSr && e.slip_no && (e.slip_no.trim().toLowerCase() === cleanSr.toLowerCase() || e.slip_no.trim().toLowerCase() === slipLabel.toLowerCase()))
      );
      let keepId = '';

      if (existingIdx >= 0) {
        const existing = list[existingIdx];
        if (
          Number(existing.diesel_liter) !== Number(litres) ||
          Number(existing.amount) !== Number(computedAmount) ||
          Number(existing.rate) !== Number(rate) ||
          existing.truck_no !== t.vehicle_no ||
          existing.driver_name !== t.driver_name ||
          existing.trip_id !== t.id
        ) {
          const updatedItem: DieselEntry = {
            ...existing,
            trip_id: t.id,
            date: t.date || existing.date,
            slip_no: slipLabel,
            truck_no: t.vehicle_no || existing.truck_no,
            driver_name: t.driver_name || existing.driver_name,
            diesel_liter: litres,
            rate,
            amount: computedAmount,
            notes: existing.notes || `Trip ${cleanSr} (${t.loading_from || ''} to ${t.loading_to || ''})`,
          };
          list[existingIdx] = updatedItem;
          changed = true;
          upsertSupabaseDiesel(updatedItem).catch(() => {});
        }
        keepId = list[existingIdx].id;
      } else {
        const maxSr = list.reduce((m, item) => Math.max(m, item.sr_no || 0), 0);
        const newEntry: DieselEntry = {
          id: generateUUID(),
          transport_id: 'a0000000-0000-0000-0000-000000000001',
          trip_id: t.id,
          sr_no: maxSr + 1,
          date: t.date || new Date().toISOString().slice(0, 10),
          slip_no: slipLabel,
          truck_no: t.vehicle_no || '—',
          diesel_liter: litres,
          rate,
          amount: computedAmount,
          driver_name: t.driver_name || '—',
          notes: `Trip ${cleanSr} (${t.loading_from || ''} to ${t.loading_to || ''})`,
          created_at: new Date().toISOString(),
        };
        list.unshift(newEntry);
        changed = true;
        upsertSupabaseDiesel(newEntry).catch(() => {});
        keepId = newEntry.id;
      }

      const slipKey = slipLabel.trim().toLowerCase();
      const removedIds: string[] = [];
      list = list.filter(e => {
        const sameTrip = Boolean(t.id && e.trip_id && e.trip_id === t.id);
        const sameSlip = Boolean(slipKey && e.slip_no && e.slip_no.trim().toLowerCase() === slipKey);
        if (!sameTrip && !sameSlip) return true;
        if (e.id === keepId) return true;
        if (e.id) removedIds.push(e.id);
        return false;
      });
      if (removedIds.length > 0) {
        changed = true;
        removedIds.forEach(id => deleteSupabaseDiesel(id).catch(() => {}));
      }
    } else {
      // If diesel details removed from trip, clean up any existing diesel entry tied to this trip
      const existingIdx = list.findIndex(e => e.trip_id && e.trip_id === t.id);
      if (existingIdx >= 0) {
        const removed = list.splice(existingIdx, 1)[0];
        changed = true;
        if (removed && removed.id) {
          deleteSupabaseDiesel(removed.id).catch(() => {});
        }
      }
    }
  }

  if (changed) {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        window.dispatchEvent(new Event('shreeji_diesel_updated'));
      } catch {}
    }
  }

  return list;
}

export function recordOrUpdateDieselForTrip(trip: Partial<{
  id: string;
  sr_number: string;
  date: string;
  vehicle_no: string;
  driver_name: string;
  loading_from?: string;
  loading_to?: string;
  diesel_litres?: number | null;
  diesel_rate?: number | null;
  diesel_cost?: number | null;
  is_return_leg?: boolean;
}> & { id: string }): void {
  syncDieselFromTrips([trip as any]);
}

export function removeDieselForTrip(tripId: string): void {
  let list = getStoredDiesel();
  const existingIdx = list.findIndex(e => e.trip_id && e.trip_id === tripId);
  if (existingIdx >= 0) {
    const removed = list.splice(existingIdx, 1)[0];
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        window.dispatchEvent(new Event('shreeji_diesel_updated'));
      } catch {}
    }
    if (removed && removed.id) {
      deleteSupabaseDiesel(removed.id).catch(() => {});
    }
  }
}


