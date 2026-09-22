// Types matching the data model in docs/ARCHITECTURE.md
// These will eventually be generated from the Supabase schema.

export type UserRole = 'super_admin' | 'owner' | 'staff';
export type PaymentMode =
  | 'cash'
  | 'upi'
  | 'online'
  | 'bank_transfer'
  | 'Jaymin - HDFC'
  | 'Shreeji - ICICI'
  | 'Vijay - HDFC'
  | 'Jaymin - IDFC'
  | 'Jaymin - Cash'
  | 'Jaymin - Online'
  | 'Vijay - Cash'
  | 'Vijay - Online'
  | 'Shreeji - Cash'
  | 'Shreeji - Online'
  | 'Cash'
  | 'Online / UPI'
  | string;
export type PaymentStatus = 'pending' | 'received' | 'overdue' | 'partial';
export type TransportStatus = 'active' | 'suspended';
export type BankAccountType = 'bank' | 'cash';
export type LedgerDirection = 'credit' | 'debit';

export interface Transport {
  id: string;
  name: string;
  owner_name: string;
  phone: string | null;
  city: string | null;
  status: TransportStatus;
  created_at: string;
}

export interface User {
  id: string;
  transport_id: string | null;
  email: string;
  name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface Vehicle {
  id: string;
  transport_id: string;
  vehicle_no: string;
  model: string | null;
  owner_name: string | null;
  purchase_date: string | null;
  is_active: boolean;
}

export interface Driver {
  id: string;
  transport_id: string;
  name: string;
  phone: string | null;
  licence_no: string | null;
  opening_balance: number;
  is_active: boolean;
}

export interface Party {
  id: string;
  transport_id: string;
  name: string;
  gstin: string | null;
  address: string | null;
  phone: string | null;
  is_active: boolean;
}

export interface Location {
  id: string;
  transport_id: string;
  name: string;
  district: string | null;
  is_active: boolean;
}

export interface Pump {
  id: string;
  transport_id: string;
  name: string;
  phone: string | null;
  opening_balance: number;
  is_active: boolean;
}

export interface BankAccount {
  id: string;
  transport_id: string;
  label: string;
  bank_name: string | null;
  account_holder: string | null;
  type: BankAccountType;
}

export interface Trip {
  id: string;
  transport_id: string;
  round_trip_id: string | null;
  sr_number: string;
  trip_date: string;
  vehicle_id: string;
  driver_id: string;
  party_id: string;
  from_location_id: string;
  to_location_id: string;
  load_ton: number | null;
  unload_ton: number | null;
  rate_per_ton: number | null;
  driver_advance: number | null;
  advance_date: string | null;
  advance_mode: PaymentMode | null;
  km_start: number | null;
  km_end: number | null;
  diesel_litre: number | null;
  diesel_rate: number | null;
  toll_amount: number | null;
  other_expense: number | null;
  bill_submitted_on: string | null;
  payment_status: PaymentStatus;
  received_amount?: number | null;
  balance_amount?: number | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Derived (computed by calc.ts)
  shortage_ton?: number | null;
  total_freight?: number | null;
  total_km?: number | null;
  average_kmpl?: number | null;
  diesel_amount?: number | null;
  total_expense?: number | null;
  profit?: number | null;
  // Joined fields for display
  vehicle?: Vehicle;
  driver?: Driver;
  party?: Party;
  from_location?: Location;
  to_location?: Location;
}

// ─── Daily Hisab ───────────────────────────────────────────────────────────────
// Mirrors the "Daily Hisab" Excel sheet columns exactly.
export interface DailyHisab {
  id: string;
  transport_id: string;
  date: string;                       // Date
  vehicle_no: string;                 // Vehicle No.
  loading_from: string;               // Loading From
  loading_to: string;                 // Loading To
  ton: number | null;                 // Ton
  rate_per_ton: number | null;        // Rate / Ton
  total_freight: number | null;       // Total Freight (computed: ton × rate_per_ton)
  driver_name: string;                // Driver Name
  silik_date: string | null;          // Silik Date (driver advance date)
  driver_silik: number | null;        // Driver Silik (advance amount)
  payment_mode: PaymentMode | null;   // UPI / Cash
  diesel_km_start: number | null;     // Diesel KM Start
  diesel_km_end: number | null;       // Diesel KM End
  total_km: number | null;            // Total KM (computed)
  diesel_litres: number | null;       // Diesel Litres
  average_kmpl: number | null;        // Average KM/L (computed)
  diesel_cost: number | null;         // Diesel Cost
  toll: number | null;                // Toll
  total_expense: number | null;       // Total Expense (computed)
  profit: number | null;              // Profit (computed)
  created_at: string;
}

// ─── Maintenance ───────────────────────────────────────────────────────────────
export interface Maintenance {
  id: string;
  transport_id: string;
  date: string;                       // Date
  vehicle_no: string;                 // Vehicle No.
  work_part: string;                  // Maintenance Work / Part
  amount: number;                     // Amount
  paid_to: string | null;             // Paid To
  payment_method: PaymentMode | null; // Payment Method
  bill_receipt_no: string | null;     // Bill / Receipt No.
  note: string | null;                // Note
  created_at: string;
}

// ─── Fastag ────────────────────────────────────────────────────────────────────
export interface Fastag {
  id: string;
  transport_id: string;
  fastag_no: string;                  // No.
  date: string;                       // Date
  recharge_amount: number;            // Recharge Amount
  payment_mode: PaymentMode;          // UPI / Cash
  vehicle_no: string | null;          // Associated vehicle (optional)
  note: string | null;
  created_at: string;
}

// ─── Driver Summary ────────────────────────────────────────────────────────────
export interface DriverSummary {
  id: string;
  transport_id: string;
  date: string;                       // Date
  vehicle_no: string;                 // Vehicle No.
  driver_name: string;                // Driver Name
  silik_amount: number | null;        // Silik Amount
  note: string | null;                // Note
  created_at: string;
}

// ─── Payment ───────────────────────────────────────────────────────────────────
export interface Payment {
  id: string;
  transport_id: string;
  date: string;                       // Payment Date
  party_name: string;                 // Party / Customer Name
  vehicle_no: string | null;          // Vehicle No. (optional)
  trip_ref: string | null;            // Trip / SR Reference
  freight_amount: number | null;      // Total Freight Amount
  received_amount: number;            // Amount Received
  balance: number | null;             // Remaining Balance (computed)
  payment_mode: PaymentMode;          // UPI / Cash / Bank Transfer
  bank_account: string | null;        // Bank Account / UPI ID
  transaction_ref: string | null;     // Transaction / UTR Ref No.
  note: string | null;                // Note
  created_at: string;
}

// ─── Investment ────────────────────────────────────────────────────────────────
export type InvestmentCategory =
  | 'vehicle_purchase'
  | 'vehicle_insurance'
  | 'vehicle_fitness'
  | 'vehicle_permit'
  | 'tyre'
  | 'battery'
  | 'tool_equipment'
  | 'office_expense'
  | 'other';

export interface Investment {
  id: string;
  transport_id: string;
  date: string;                       // Date
  category: InvestmentCategory;       // Category of investment
  description: string;                // Description / Item
  vehicle_no: string | null;          // Vehicle No. (if vehicle-related)
  amount: number;                     // Amount Invested
  payment_mode: PaymentMode;          // Payment Mode
  paid_to: string | null;             // Paid To / Vendor
  bill_receipt_no: string | null;     // Bill / Receipt No.
  note: string | null;                // Note
  created_at: string;
}

// ─── Diesel ────────────────────────────────────────────────────────────────────
export interface DieselEntry {
  id: string;
  transport_id: string;
  trip_id?: string | null;
  sr_no?: number | null;
  date: string;
  slip_no: string;
  truck_no: string;
  diesel_liter: number;
  rate: number;
  amount: number;
  driver_name: string;
  pump_name?: string | null;
  notes?: string | null;
  created_at: string;
}

