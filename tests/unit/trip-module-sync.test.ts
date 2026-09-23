/**
 * Verifies that saveTrip pushes filled trip details into
 * Diesel, Fastag, Payment, and Driver Summary stores.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const store: Record<string, string> = {};

vi.stubGlobal('window', {
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
  localStorage: {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
  },
});

vi.stubGlobal('localStorage', (globalThis as any).window.localStorage);

vi.mock('@/lib/supabase-service', () => ({
  generateUUID: () => `00000000-0000-4000-8000-${String(Math.floor(Math.random() * 1e12)).padStart(12, '0')}`,
  isValidUUID: () => true,
  fetchSupabaseTrips: async () => null,
  fetchSupabasePayments: async () => null,
  upsertSupabaseTrip: async () => true,
  deleteSupabaseTrip: async () => true,
  upsertSupabasePayment: async () => true,
  deleteSupabasePayment: async () => true,
  upsertSupabaseFastag: async () => true,
  deleteSupabaseFastag: async () => true,
  upsertSupabaseDriverSummary: async () => true,
  deleteSupabaseDriverSummary: async () => true,
  upsertSupabaseDiesel: async () => true,
  deleteSupabaseDiesel: async () => true,
  fetchSupabaseDiesel: async () => null,
  fetchSupabaseFastag: async () => null,
  fetchSupabaseDriverSummaries: async () => null,
}));

describe('trip → module sync', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    // Empty diesel store (avoid mock seed) and other modules
    store['shreeji_transport_diesel_v1'] = '[]';
    store['shreeji_transport_unified_trips_v8'] = '[]';
    store['shreeji_transport_fastag_v6'] = '[]';
    store['shreeji_transport_payment_v6'] = '[]';
    store['shreeji_transport_driver_summary_v6'] = '[]';
  });

  it('syncs diesel, fastag, payment and driver silik when trip fields are filled', async () => {
    const { saveTrip } = await import('@/lib/trip-store');
    const { getStoredDiesel } = await import('@/lib/diesel-store');
    const { getStoredFastag, getStoredPayments, getStoredDriverSummaries } = await import('@/lib/operations-store');

    const trip = saveTrip({
      sr_number: 'SR-TEST01',
      date: '2026-09-23',
      vehicle_no: 'GJ03CW9144',
      driver_name: 'TEST DRIVER',
      party_name: 'TEST PARTY',
      loading_from: 'Morbi (Gujarat)',
      loading_to: 'Ahmedabad (Gujarat)',
      ton: 20,
      rate_per_ton: 1500,
      total_freight: 30000,
      received_amount: 10000,
      payment_mode: 'Jaymin - HDFC',
      payment_status: 'partial',
      diesel_km_start: 1000,
      diesel_km_end: 1450,
      diesel_litres: 50,
      diesel_rate: 99.5,
      toll: 3235,
      other_expense: 200,
      driver_silik: 5000,
      silik_date: '2026-09-23',
    });

    expect(trip.sr_number).toBe('SR-TEST01');

    const diesel = getStoredDiesel();
    expect(diesel.some(d => d.truck_no === 'GJ03CW9144' && d.diesel_liter === 50)).toBe(true);

    const fastag = getStoredFastag();
    expect(fastag.some(f => f.recharge_amount === 3435 && (f.note || '').includes('SR-TEST01'))).toBe(true);

    const payments = getStoredPayments();
    expect(payments.some(p => p.trip_ref === 'SR-TEST01' && p.received_amount === 10000 && p.freight_amount === 30000)).toBe(true);

    const silik = getStoredDriverSummaries();
    expect(silik.some(s => s.driver_name === 'TEST DRIVER' && s.silik_amount === 5000)).toBe(true);
  });

  it('does not create module rows when optional details are empty', async () => {
    const { saveTrip } = await import('@/lib/trip-store');
    const { getStoredDiesel } = await import('@/lib/diesel-store');
    const { getStoredFastag, getStoredPayments, getStoredDriverSummaries } = await import('@/lib/operations-store');

    saveTrip({
      sr_number: 'SR-EMPTY1',
      date: '2026-09-23',
      vehicle_no: 'GJ03CW9144',
      driver_name: 'EMPTY DRIVER',
      party_name: 'EMPTY PARTY',
      loading_from: 'A',
      loading_to: 'B',
    });

    expect(getStoredDiesel().some(d => (d.notes || '').includes('SR-EMPTY1') || d.slip_no.includes('SR-EMPTY1'))).toBe(false);
    expect(getStoredFastag().some(f => (f.note || '').includes('SR-EMPTY1'))).toBe(false);
    expect(getStoredPayments().some(p => p.trip_ref === 'SR-EMPTY1')).toBe(false);
    expect(getStoredDriverSummaries().some(s => (s.note || '').includes('SR-EMPTY1'))).toBe(false);
  });
});
