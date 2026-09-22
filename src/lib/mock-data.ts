// Empty initial fallback arrays (Mock data removed).
// All data is dynamically loaded from Supabase.

import type {
  Vehicle, Driver, Party, Location, Pump, BankAccount, Trip,
} from '@/types/database';

export const mockVehicles: Vehicle[] = [];
export const mockDrivers: Driver[] = [];
export const mockParties: Party[] = [];
export const mockLocations: Location[] = [];
export const mockPumps: Pump[] = [];
export const mockBankAccounts: BankAccount[] = [];
export const mockTrips: Trip[] = [];

export function getDashboardSummary() {
  return {
    totalTrips: 0,
    activeVehicles: 0,
    totalFreight: 0,
    totalExpense: 0,
    totalProfit: 0,
    pendingPayments: 0,
    overduePayments: 0,
    receivedAmount: 0,
    pendingAmount: 0,
  };
}
