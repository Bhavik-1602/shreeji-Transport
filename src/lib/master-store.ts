// Master Data Store with LocalStorage persistence so newly added or edited
// Vehicles, Drivers, Parties, Locations, Pumps, and Bank Accounts persist across the entire ERP.
// No mock data: all records load from Supabase or user additions.

import type {
  Vehicle,
  Driver,
  Party,
  Location,
  Pump,
  BankAccount,
} from '@/types/database';
import {
  fetchSupabaseBankAccounts,
  upsertSupabaseBankAccount,
  deleteSupabaseBankAccount,
  fetchSupabaseVehicles,
  upsertSupabaseVehicle,
  deleteSupabaseVehicle,
  fetchSupabaseDrivers,
  upsertSupabaseDriver,
  deleteSupabaseDriver,
  fetchSupabaseParties,
  upsertSupabaseParty,
  deleteSupabaseParty,
  fetchSupabaseLocations,
  upsertSupabaseLocation,
  deleteSupabaseLocation,
  fetchSupabasePumps,
  upsertSupabasePump,
  deleteSupabasePump,
} from './supabase-service';

const KEYS = {
  vehicles: 'shreeji_transport_vehicles_v5',
  drivers: 'shreeji_transport_drivers_v5',
  parties: 'shreeji_transport_parties_v5',
  locations: 'shreeji_transport_locations_v5',
  pumps: 'shreeji_transport_pumps_v5',
  bankAccounts: 'shreeji_transport_bank_accounts_v5',
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
      window.dispatchEvent(new Event('shreeji_masters_updated'));
    } catch (e) {
      console.warn(`Error saving ${key}:`, e);
    }
  }
}

// ─── Vehicles ──────────────────────────────────────────
export function getVehicles(): Vehicle[] {
  return getStored<Vehicle>(KEYS.vehicles, []);
}

export function saveVehicle(vehicle: Vehicle): Vehicle[] {
  const list = getVehicles();
  const idx = list.findIndex(v => v.id === vehicle.id);
  let updated: Vehicle[];
  if (idx >= 0) {
    updated = list.map(v => (v.id === vehicle.id ? vehicle : v));
  } else {
    updated = [vehicle, ...list];
  }
  saveStored(KEYS.vehicles, updated);
  upsertSupabaseVehicle(vehicle).catch(() => {});
  return updated;
}

export function deleteVehicle(id: string): Vehicle[] {
  const list = getVehicles();
  const updated = list.filter(v => v.id !== id);
  saveStored(KEYS.vehicles, updated);
  deleteSupabaseVehicle(id).catch(() => {});
  return updated;
}

export function toggleVehicleActive(id: string): Vehicle[] {
  const list = getVehicles();
  const target = list.find(v => v.id === id);
  if (target) {
    const updatedVehicle = { ...target, is_active: !target.is_active };
    upsertSupabaseVehicle(updatedVehicle).catch(() => {});
  }
  const updated = list.map(v => (v.id === id ? { ...v, is_active: !v.is_active } : v));
  saveStored(KEYS.vehicles, updated);
  return updated;
}

export async function syncVehiclesFromSupabase(): Promise<Vehicle[]> {
  const remote = await fetchSupabaseVehicles();
  if (remote !== null && remote.length > 0) {
    saveStored(KEYS.vehicles, remote);
    return remote;
  }
  return getVehicles();
}

// ─── Drivers ───────────────────────────────────────────
export function getDrivers(): Driver[] {
  return getStored<Driver>(KEYS.drivers, []);
}

export function saveDriver(driver: Driver): Driver[] {
  const list = getDrivers();
  const idx = list.findIndex(d => d.id === driver.id);
  let updated: Driver[];
  if (idx >= 0) {
    updated = list.map(d => (d.id === driver.id ? driver : d));
  } else {
    updated = [driver, ...list];
  }
  saveStored(KEYS.drivers, updated);
  upsertSupabaseDriver(driver).catch(() => {});
  return updated;
}

export function deleteDriver(id: string): Driver[] {
  const list = getDrivers();
  const updated = list.filter(d => d.id !== id);
  saveStored(KEYS.drivers, updated);
  deleteSupabaseDriver(id).catch(() => {});
  return updated;
}

export function toggleDriverActive(id: string): Driver[] {
  const list = getDrivers();
  const target = list.find(d => d.id === id);
  if (target) {
    const updatedDriver = { ...target, is_active: !target.is_active };
    upsertSupabaseDriver(updatedDriver).catch(() => {});
  }
  const updated = list.map(d => (d.id === id ? { ...d, is_active: !d.is_active } : d));
  saveStored(KEYS.drivers, updated);
  return updated;
}

export async function syncDriversFromSupabase(): Promise<Driver[]> {
  const remote = await fetchSupabaseDrivers();
  if (remote !== null && remote.length > 0) {
    saveStored(KEYS.drivers, remote);
    return remote;
  }
  return getDrivers();
}

// ─── Parties ───────────────────────────────────────────
export function getParties(): Party[] {
  return getStored<Party>(KEYS.parties, []);
}

export function saveParty(party: Party): Party[] {
  const list = getParties();
  const idx = list.findIndex(p => p.id === party.id);
  let updated: Party[];
  if (idx >= 0) {
    updated = list.map(p => (p.id === party.id ? party : p));
  } else {
    updated = [party, ...list];
  }
  saveStored(KEYS.parties, updated);
  upsertSupabaseParty(party).catch(() => {});
  return updated;
}

export function deleteParty(id: string): Party[] {
  const list = getParties();
  const updated = list.filter(p => p.id !== id);
  saveStored(KEYS.parties, updated);
  deleteSupabaseParty(id).catch(() => {});
  return updated;
}

export function togglePartyActive(id: string): Party[] {
  const list = getParties();
  const target = list.find(p => p.id === id);
  if (target) {
    const updatedParty = { ...target, is_active: !target.is_active };
    upsertSupabaseParty(updatedParty).catch(() => {});
  }
  const updated = list.map(p => (p.id === id ? { ...p, is_active: !p.is_active } : p));
  saveStored(KEYS.parties, updated);
  return updated;
}

export async function syncPartiesFromSupabase(): Promise<Party[]> {
  const remote = await fetchSupabaseParties();
  if (remote !== null && remote.length > 0) {
    saveStored(KEYS.parties, remote);
    return remote;
  }
  return getParties();
}

// ─── Locations ─────────────────────────────────────────
export function getLocations(): Location[] {
  return getStored<Location>(KEYS.locations, []);
}

export function saveLocation(location: Location): Location[] {
  const list = getLocations();
  const idx = list.findIndex(l => l.id === location.id);
  let updated: Location[];
  if (idx >= 0) {
    updated = list.map(l => (l.id === location.id ? location : l));
  } else {
    updated = [location, ...list];
  }
  saveStored(KEYS.locations, updated);
  upsertSupabaseLocation(location).catch(() => {});
  return updated;
}

export function deleteLocation(id: string): Location[] {
  const list = getLocations();
  const updated = list.filter(l => l.id !== id);
  saveStored(KEYS.locations, updated);
  deleteSupabaseLocation(id).catch(() => {});
  return updated;
}

export function toggleLocationActive(id: string): Location[] {
  const list = getLocations();
  const target = list.find(l => l.id === id);
  if (target) {
    const updatedLoc = { ...target, is_active: !target.is_active };
    upsertSupabaseLocation(updatedLoc).catch(() => {});
  }
  const updated = list.map(l => (l.id === id ? { ...l, is_active: !l.is_active } : l));
  saveStored(KEYS.locations, updated);
  return updated;
}

export async function syncLocationsFromSupabase(): Promise<Location[]> {
  const remote = await fetchSupabaseLocations();
  if (remote !== null && remote.length > 0) {
    saveStored(KEYS.locations, remote);
    return remote;
  }
  return getLocations();
}

// ─── Pumps ─────────────────────────────────────────────
export function getPumps(): Pump[] {
  return getStored<Pump>(KEYS.pumps, []);
}

export function savePump(pump: Pump): Pump[] {
  const list = getPumps();
  const idx = list.findIndex(p => p.id === pump.id);
  let updated: Pump[];
  if (idx >= 0) {
    updated = list.map(p => (p.id === pump.id ? pump : p));
  } else {
    updated = [pump, ...list];
  }
  saveStored(KEYS.pumps, updated);
  upsertSupabasePump(pump).catch(() => {});
  return updated;
}

export function deletePump(id: string): Pump[] {
  const list = getPumps();
  const updated = list.filter(p => p.id !== id);
  saveStored(KEYS.pumps, updated);
  deleteSupabasePump(id).catch(() => {});
  return updated;
}

export function togglePumpActive(id: string): Pump[] {
  const list = getPumps();
  const target = list.find(p => p.id === id);
  if (target) {
    const updatedPump = { ...target, is_active: !target.is_active };
    upsertSupabasePump(updatedPump).catch(() => {});
  }
  const updated = list.map(p => (p.id === id ? { ...p, is_active: !p.is_active } : p));
  saveStored(KEYS.pumps, updated);
  return updated;
}

export async function syncPumpsFromSupabase(): Promise<Pump[]> {
  const remote = await fetchSupabasePumps();
  if (remote !== null && remote.length > 0) {
    saveStored(KEYS.pumps, remote);
    return remote;
  }
  return getPumps();
}

// ─── Bank Accounts ─────────────────────────────────────
export interface StandardPaymentAccount {
  label: string;
  bank_name: string;
  type: 'bank' | 'cash';
}

export const STANDARD_PAYMENT_ACCOUNTS: StandardPaymentAccount[] = [
  { label: 'Jaymin - HDFC', bank_name: 'HDFC Bank', type: 'bank' },
  { label: 'Shreeji - ICICI', bank_name: 'ICICI Bank', type: 'bank' },
  { label: 'Vijay - HDFC', bank_name: 'HDFC Bank', type: 'bank' },
  { label: 'Jaymin - IDFC', bank_name: 'IDFC Bank', type: 'bank' },
  { label: 'Jaymin - Cash', bank_name: 'Cash Handover', type: 'cash' },
  { label: 'Jaymin - Online', bank_name: 'UPI / Online', type: 'bank' },
  { label: 'Vijay - Cash', bank_name: 'Cash Handover', type: 'cash' },
  { label: 'Vijay - Online', bank_name: 'UPI / Online', type: 'bank' },
  { label: 'Shreeji - Cash', bank_name: 'Cash Handover', type: 'cash' },
  { label: 'Shreeji - Online', bank_name: 'UPI / Online', type: 'bank' },
  { label: 'Cash', bank_name: 'Cash Counter', type: 'cash' },
  { label: 'Online / UPI', bank_name: 'QR / UPI', type: 'bank' },
];

export function getAllAccountOptions(customAccounts: BankAccount[] = []): Array<{ value: string; label: string }> {
  const seen = new Set<string>();
  const list: Array<{ value: string; label: string }> = [];

  for (const acc of STANDARD_PAYMENT_ACCOUNTS) {
    if (!seen.has(acc.label.toLowerCase())) {
      seen.add(acc.label.toLowerCase());
      list.push({
        value: acc.label,
        label: `${acc.label} (${acc.bank_name})`,
      });
    }
  }

  for (const ca of customAccounts) {
    if (ca && ca.label && !seen.has(ca.label.toLowerCase())) {
      seen.add(ca.label.toLowerCase());
      list.push({
        value: ca.label,
        label: `${ca.label} (${ca.bank_name || 'Bank'})`,
      });
    }
  }

  return list;
}

export function getBankAccounts(): BankAccount[] {
  return getStored<BankAccount>(KEYS.bankAccounts, []);
}

export function saveBankAccount(account: BankAccount): BankAccount[] {
  const list = getBankAccounts();
  const idx = list.findIndex(a => a.id === account.id);
  let updated: BankAccount[];
  if (idx >= 0) {
    updated = list.map(a => (a.id === account.id ? account : a));
  } else {
    updated = [account, ...list];
  }
  saveStored(KEYS.bankAccounts, updated);
  upsertSupabaseBankAccount(account).catch(() => {});
  return updated;
}

export function deleteBankAccount(id: string): BankAccount[] {
  const list = getBankAccounts();
  const updated = list.filter(a => a.id !== id);
  saveStored(KEYS.bankAccounts, updated);
  deleteSupabaseBankAccount(id).catch(() => {});
  return updated;
}

export async function syncBankAccountsFromSupabase(): Promise<BankAccount[]> {
  const remote = await fetchSupabaseBankAccounts();
  if (remote !== null && remote.length > 0) {
    saveStored(KEYS.bankAccounts, remote);
    return remote;
  }
  return getBankAccounts();
}

// ─── Unified Sync All Masters ──────────────────────────
export async function syncAllMastersFromSupabase(): Promise<void> {
  await Promise.allSettled([
    syncVehiclesFromSupabase(),
    syncDriversFromSupabase(),
    syncPartiesFromSupabase(),
    syncLocationsFromSupabase(),
    syncPumpsFromSupabase(),
    syncBankAccountsFromSupabase(),
  ]);
}
