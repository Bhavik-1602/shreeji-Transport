// Direct Supabase data service for fetching and persisting ERP records.
// Automatically connects to Supabase when environment variables are set in .env.local.

import { getSupabaseBrowserClient, isSupabaseConfigured } from './supabase-browser';
import type {
  Vehicle,
  Driver,
  Party,
  Location,
  Pump,
  BankAccount,
  Payment,
  Maintenance,
  Fastag,
  Investment,
  DriverSummary,
  DieselEntry,
} from '@/types/database';
import type { UnifiedTrip } from './trip-store';

export { isSupabaseConfigured };

const DEFAULT_TRANSPORT_ID = 'a0000000-0000-0000-0000-000000000001';

// ─── Bank Accounts ────────────────────────────────────────────────────────────
export async function fetchSupabaseBankAccounts(): Promise<BankAccount[] | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Supabase fetch error (bank_accounts):', error.message);
      return null;
    }
    return data as BankAccount[];
  } catch (err) {
    console.warn('Supabase network error (bank_accounts):', err);
    return null;
  }
}

export async function upsertSupabaseBankAccount(account: BankAccount): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  try {
    const payload = {
      ...account,
      id: isValidUUID(account.id) ? account.id : generateUUID(),
      transport_id: account.transport_id && isValidUUID(account.transport_id) ? account.transport_id : DEFAULT_TRANSPORT_ID,
    };
    const { error } = await supabase.from('bank_accounts').upsert(payload);
    if (error) console.warn('Supabase upsert error (bank_accounts):', error.message);
    return !error;
  } catch (err) {
    console.warn('Supabase error (bank_accounts):', err);
    return false;
  }
}

export async function deleteSupabaseBankAccount(id: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase.from('bank_accounts').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

// ─── Payments (Freight Collections) ───────────────────────────────────────────
export async function fetchSupabasePayments(): Promise<Payment[] | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      console.warn('Supabase fetch error (payments):', error.message);
      return null;
    }
    return data as Payment[];
  } catch (err) {
    console.warn('Supabase network error (payments):', err);
    return null;
  }
}

export async function upsertSupabasePayment(payment: Payment): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  try {
    const payload = {
      ...payment,
      id: isValidUUID(payment.id) ? payment.id : generateUUID(),
      transport_id: payment.transport_id && isValidUUID(payment.transport_id) ? payment.transport_id : DEFAULT_TRANSPORT_ID,
    };
    const { error } = await supabase.from('payments').upsert(payload);
    if (error) console.warn('Supabase upsert error (payments):', error.message);
    return !error;
  } catch (err) {
    console.warn('Supabase error (payments):', err);
    return false;
  }
}

export async function deleteSupabasePayment(id: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase.from('payments').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

// ─── Trips ────────────────────────────────────────────────────────────────────
export async function fetchSupabaseTrips(): Promise<UnifiedTrip[] | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .order('date', { ascending: true });

    if (error) {
      console.warn('Supabase fetch error (trips):', error.message);
      return null;
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Sort chronologically by date and creation time
    const sorted = [...(data as any[])].sort((a, b) => {
      const cmpDate = (a.date || '').localeCompare(b.date || '');
      if (cmpDate !== 0) return cmpDate;
      return (a.created_at || '').localeCompare(b.created_at || '');
    });

    // Detect return trips when the same sr_number appears twice:
    // First occurrence = Onward trip. Second occurrence = Return trip!
    const seenOnwardBySr = new Map<string, any>();
    const pendingDbUpdates: { id: string; parentId: string }[] = [];

    const tripsWithReturns = sorted.map((raw) => {
      const sr = (raw.sr_number || '').trim();
      let isReturn = Boolean(raw.is_return_leg);
      let returnFor = raw.return_leg_for || null;

      if (sr && seenOnwardBySr.has(sr)) {
        // Double SR number detected: this is the return journey!
        const parent = seenOnwardBySr.get(sr);
        isReturn = true;
        returnFor = parent.id;
        if (!raw.is_return_leg || !raw.return_leg_for) {
          pendingDbUpdates.push({ id: raw.id, parentId: parent.id });
        }
      } else if (sr && !isReturn) {
        seenOnwardBySr.set(sr, raw);
      }

      // Smart party fallback if party_name is blank
      let party = raw.party_name;
      if (!party || party.trim() === '') {
        const dest = (raw.loading_to || '').toUpperCase();
        if (dest.includes('AMBUJA')) party = 'Ambuja Cement Ltd';
        else if (dest.includes('JAFRABAD')) party = 'UltraTech Cement';
        else if (dest.includes('RAJULA')) party = 'Sanghi Industries';
        else if (dest.includes('MORASHA')) party = 'Saurashtra Cement';
        else if (dest.includes('SUTRAPADA')) party = 'GHCL / Sutrapada';
        else party = raw.loading_to ? `${raw.loading_to} Party` : '—';
      }

      const ton = raw.ton != null ? Number(raw.ton) : null;
      const rate = raw.rate_per_ton != null ? Number(raw.rate_per_ton) : null;
      const tf = raw.total_freight != null && Number(raw.total_freight) > 0
        ? Number(raw.total_freight)
        : (ton && rate ? ton * rate : null);

      const rec = raw.received_amount != null && Number(raw.received_amount) > 0
        ? Number(raw.received_amount)
        : (raw.payment_status === 'received' ? (tf || 0) : 0);

      const bal = raw.balance_amount != null
        ? Number(raw.balance_amount)
        : Math.max(0, (tf || 0) - rec);

      return {
        ...raw,
        is_return_leg: isReturn,
        return_leg_for: returnFor,
        party_name: party,
        total_freight: tf,
        received_amount: rec,
        balance_amount: bal,
      } as UnifiedTrip;
    });

    // Asynchronously update Supabase database flags for return legs if needed
    if (pendingDbUpdates.length > 0) {
      Promise.all(
        pendingDbUpdates.map(u =>
          supabase.from('trips').update({ is_return_leg: true, return_leg_for: u.parentId }).eq('id', u.id)
        )
      ).catch(() => {});
    }

    return tripsWithReturns;
  } catch (err) {
    console.warn('Supabase network error (trips):', err);
    return null;
  }
}

export async function upsertSupabaseTrip(trip: UnifiedTrip): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  try {
    const payload: any = {
      ...trip,
      id: isValidUUID(trip.id) ? trip.id : generateUUID(),
      transport_id: DEFAULT_TRANSPORT_ID,
      return_leg_for: isValidUUID(trip.return_leg_for) ? trip.return_leg_for : null,
    };
    let { error } = await supabase.from('trips').upsert(payload);
    
    // If Supabase table doesn't have received_amount or balance_amount columns yet, retry with base columns
    if (error && (error.message.includes('received_amount') || error.message.includes('balance_amount'))) {
      const { received_amount, balance_amount, ...safePayload } = payload;
      const retry = await supabase.from('trips').upsert(safePayload);
      error = retry.error;
    }

    if (error) console.warn('Supabase upsert error (trips):', error.message);
    return !error;
  } catch (err) {
    console.warn('Supabase error (trips):', err);
    return false;
  }
}

export async function deleteSupabaseTrip(id: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase.from('trips').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

// ─── UUID Helper ──────────────────────────────────────────────────────────────
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function isValidUUID(id: string | null | undefined): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

// ─── Vehicles ─────────────────────────────────────────────────────────────────
export async function fetchSupabaseVehicles(): Promise<Vehicle[] | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.from('vehicles').select('*').order('created_at', { ascending: true });
    if (error) {
      console.warn('Supabase fetch error (vehicles):', error.message);
      return null;
    }
    return data as Vehicle[];
  } catch (err) {
    console.warn('Supabase network error (vehicles):', err);
    return null;
  }
}

export async function upsertSupabaseVehicle(vehicle: Vehicle): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  try {
    const payload = {
      ...vehicle,
      id: isValidUUID(vehicle.id) ? vehicle.id : generateUUID(),
      transport_id: vehicle.transport_id && isValidUUID(vehicle.transport_id) ? vehicle.transport_id : DEFAULT_TRANSPORT_ID,
    };
    const { error } = await supabase.from('vehicles').upsert(payload);
    if (error) console.warn('Supabase upsert error (vehicles):', error.message);
    return !error;
  } catch (err) {
    console.warn('Supabase error (vehicles):', err);
    return false;
  }
}

export async function deleteSupabaseVehicle(id: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase.from('vehicles').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

// ─── Drivers ──────────────────────────────────────────────────────────────────
export async function fetchSupabaseDrivers(): Promise<Driver[] | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.from('drivers').select('*').order('name', { ascending: true });
    if (error) {
      console.warn('Supabase fetch error (drivers):', error.message);
      return null;
    }
    return data as Driver[];
  } catch (err) {
    console.warn('Supabase network error (drivers):', err);
    return null;
  }
}

export async function upsertSupabaseDriver(driver: Driver): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  try {
    const payload = {
      ...driver,
      id: isValidUUID(driver.id) ? driver.id : generateUUID(),
      transport_id: driver.transport_id && isValidUUID(driver.transport_id) ? driver.transport_id : DEFAULT_TRANSPORT_ID,
    };
    const { error } = await supabase.from('drivers').upsert(payload);
    if (error) console.warn('Supabase upsert error (drivers):', error.message);
    return !error;
  } catch (err) {
    console.warn('Supabase error (drivers):', err);
    return false;
  }
}

export async function deleteSupabaseDriver(id: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase.from('drivers').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

// ─── Parties ──────────────────────────────────────────────────────────────────
export async function fetchSupabaseParties(): Promise<Party[] | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.from('parties').select('*').order('name', { ascending: true });
    if (error) {
      console.warn('Supabase fetch error (parties):', error.message);
      return null;
    }
    return data as Party[];
  } catch (err) {
    console.warn('Supabase network error (parties):', err);
    return null;
  }
}

export async function upsertSupabaseParty(party: Party): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  try {
    const payload = {
      ...party,
      id: isValidUUID(party.id) ? party.id : generateUUID(),
      transport_id: party.transport_id && isValidUUID(party.transport_id) ? party.transport_id : DEFAULT_TRANSPORT_ID,
    };
    const { error } = await supabase.from('parties').upsert(payload);
    if (error) console.warn('Supabase upsert error (parties):', error.message);
    return !error;
  } catch (err) {
    console.warn('Supabase error (parties):', err);
    return false;
  }
}

export async function deleteSupabaseParty(id: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase.from('parties').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

// ─── Locations ────────────────────────────────────────────────────────────────
export async function fetchSupabaseLocations(): Promise<Location[] | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.from('locations').select('*').order('name', { ascending: true });
    if (error) {
      console.warn('Supabase fetch error (locations):', error.message);
      return null;
    }
    return data as Location[];
  } catch (err) {
    console.warn('Supabase network error (locations):', err);
    return null;
  }
}

export async function upsertSupabaseLocation(loc: Location): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  try {
    const payload = {
      ...loc,
      id: isValidUUID(loc.id) ? loc.id : generateUUID(),
      transport_id: loc.transport_id && isValidUUID(loc.transport_id) ? loc.transport_id : DEFAULT_TRANSPORT_ID,
    };
    const { error } = await supabase.from('locations').upsert(payload);
    return !error;
  } catch {
    return false;
  }
}

export async function deleteSupabaseLocation(id: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase.from('locations').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

// ─── Pumps ────────────────────────────────────────────────────────────────────
export async function fetchSupabasePumps(): Promise<Pump[] | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.from('pumps').select('*').order('name', { ascending: true });
    if (error) {
      console.warn('Supabase fetch error (pumps):', error.message);
      return null;
    }
    return data as Pump[];
  } catch (err) {
    console.warn('Supabase network error (pumps):', err);
    return null;
  }
}

export async function upsertSupabasePump(pump: Pump): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  try {
    const payload = {
      ...pump,
      id: isValidUUID(pump.id) ? pump.id : generateUUID(),
      transport_id: pump.transport_id && isValidUUID(pump.transport_id) ? pump.transport_id : DEFAULT_TRANSPORT_ID,
    };
    const { error } = await supabase.from('pumps').upsert(payload);
    return !error;
  } catch {
    return false;
  }
}

export async function deleteSupabasePump(id: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase.from('pumps').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

// ─── Maintenance ──────────────────────────────────────────────────────────────
export async function fetchSupabaseMaintenance(): Promise<Maintenance[] | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.from('maintenance').select('*').order('date', { ascending: false });
    if (error) {
      console.warn('Supabase fetch error (maintenance):', error.message);
      return null;
    }
    return data as Maintenance[];
  } catch (err) {
    console.warn('Supabase network error (maintenance):', err);
    return null;
  }
}

export async function upsertSupabaseMaintenance(item: Maintenance): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  try {
    const payload = {
      ...item,
      id: isValidUUID(item.id) ? item.id : generateUUID(),
      transport_id: item.transport_id && isValidUUID(item.transport_id) ? item.transport_id : DEFAULT_TRANSPORT_ID,
    };
    const { error } = await supabase.from('maintenance').upsert(payload);
    if (error) console.warn('Supabase upsert error (maintenance):', error.message);
    return !error;
  } catch (err) {
    console.warn('Supabase error (maintenance):', err);
    return false;
  }
}

export async function deleteSupabaseMaintenance(id: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase.from('maintenance').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

// ─── FASTag ───────────────────────────────────────────────────────────────────
export async function fetchSupabaseFastag(): Promise<Fastag[] | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.from('fastag').select('*').order('date', { ascending: false });
    if (error) {
      console.warn('Supabase fetch error (fastag):', error.message);
      return null;
    }
    return data as Fastag[];
  } catch (err) {
    console.warn('Supabase network error (fastag):', err);
    return null;
  }
}

export async function upsertSupabaseFastag(item: Fastag): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  try {
    const payload = {
      ...item,
      id: isValidUUID(item.id) ? item.id : generateUUID(),
      transport_id: item.transport_id && isValidUUID(item.transport_id) ? item.transport_id : DEFAULT_TRANSPORT_ID,
    };
    const { error } = await supabase.from('fastag').upsert(payload);
    if (error) console.warn('Supabase upsert error (fastag):', error.message);
    return !error;
  } catch (err) {
    console.warn('Supabase error (fastag):', err);
    return false;
  }
}

export async function deleteSupabaseFastag(id: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase.from('fastag').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

// ─── Investments ──────────────────────────────────────────────────────────────
export async function fetchSupabaseInvestments(): Promise<Investment[] | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.from('investments').select('*').order('date', { ascending: false });
    if (error) return null;
    return data as Investment[];
  } catch {
    return null;
  }
}

export async function upsertSupabaseInvestment(item: Investment): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  try {
    const payload = {
      ...item,
      id: isValidUUID(item.id) ? item.id : generateUUID(),
      transport_id: item.transport_id && isValidUUID(item.transport_id) ? item.transport_id : DEFAULT_TRANSPORT_ID,
    };
    const { error } = await supabase.from('investments').upsert(payload);
    return !error;
  } catch {
    return false;
  }
}

export async function deleteSupabaseInvestment(id: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase.from('investments').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

// ─── Driver Summaries ─────────────────────────────────────────────────────────
export async function fetchSupabaseDriverSummaries(): Promise<DriverSummary[] | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.from('driver_summaries').select('*').order('date', { ascending: false });
    if (error) return null;
    return data as DriverSummary[];
  } catch {
    return null;
  }
}

export async function upsertSupabaseDriverSummary(item: DriverSummary): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  try {
    const payload = {
      ...item,
      id: isValidUUID(item.id) ? item.id : generateUUID(),
      transport_id: item.transport_id && isValidUUID(item.transport_id) ? item.transport_id : DEFAULT_TRANSPORT_ID,
    };
    const { error } = await supabase.from('driver_summaries').upsert(payload);
    return !error;
  } catch {
    return false;
  }
}

export async function deleteSupabaseDriverSummary(id: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase.from('driver_summaries').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

// ─── Diesel ───────────────────────────────────────────────────────────────────
export async function fetchSupabaseDiesel(): Promise<DieselEntry[] | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.from('diesel').select('*').order('date', { ascending: false });
    if (error) return null;
    return data as DieselEntry[];
  } catch {
    return null;
  }
}

export async function upsertSupabaseDiesel(item: DieselEntry): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  try {
    const payload = {
      ...item,
      id: isValidUUID(item.id) ? item.id : generateUUID(),
      transport_id: item.transport_id && isValidUUID(item.transport_id) ? item.transport_id : DEFAULT_TRANSPORT_ID,
      trip_id: item.trip_id && isValidUUID(item.trip_id) ? item.trip_id : null,
    };
    let { error } = await supabase.from('diesel').upsert(payload);
    if (error && error.message.includes('trip_id')) {
      const { trip_id, ...safePayload } = payload;
      const retry = await supabase.from('diesel').upsert(safePayload);
      error = retry.error;
    }
    return !error;
  } catch {
    return false;
  }
}

export async function deleteSupabaseDiesel(id: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase.from('diesel').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}


