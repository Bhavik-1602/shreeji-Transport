'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { TextField, SelectField, TextareaField } from '@/components/Input';
import {
  getVehicles,
  getDrivers,
  getParties,
  getLocations,
  getBankAccounts,
  syncVehiclesFromSupabase,
  syncDriversFromSupabase,
  syncPartiesFromSupabase,
  syncLocationsFromSupabase,
  syncBankAccountsFromSupabase,
  getAllAccountOptions,
} from '@/lib/master-store';
import { saveTrip, deleteTrip, computeUnifiedCalculations, getNextSrNumber, getStoredTrips, syncTripsFromSupabase, type UnifiedTrip } from '@/lib/trip-store';
import { formatCurrency } from '@/lib/format';
import type { PaymentMode, PaymentStatus, Vehicle, Driver, Party, Location, BankAccount } from '@/types/database';
import { useToast } from '@/components/Toast';

const SUGGESTED_LOCATIONS = [
  // Gujarat Major Transport Hubs & Plants
  'Wakaner (Gujarat)',
  'Morbi (Gujarat)',
  'Kodinar (Gujarat)',
  'Ambuja (Kodinar)',
  'Ahmedabad (Gujarat)',
  'Bhavnagar (Gujarat)',
  'Rajkot (Gujarat)',
  'Porbandar (Gujarat)',
  'Jamnagar (Gujarat)',
  'Surat (Gujarat)',
  'Vadodara (Gujarat)',
  'Mundra Port (Gujarat)',
  'Kandla Port (Gujarat)',
  'Gandhidham (Gujarat)',
  'Rajula (Gujarat)',
  'Jafrabad (Gujarat)',
  'Veraval (Gujarat)',
  'Junagadh (Gujarat)',
  'Mehsana (Gujarat)',
  'Kadi (Gujarat)',
  'Chhatral (Gujarat)',
  'Kalol (Gujarat)',
  'Halol (Gujarat)',
  'Ankleshwar (Gujarat)',
  'Bharuch (Gujarat)',
  'Dahej (Gujarat)',
  'Vapi (Gujarat)',
  'Valsad (Gujarat)',
  'Himmatnagar (Gujarat)',
  'Palanpur (Gujarat)',
  'Bhuj (Gujarat)',
  'Anjar (Gujarat)',
  'Surendranagar (Gujarat)',
  'Pipavav Port (Gujarat)',
  'Shapar GIDC (Rajkot)',
  'Metoda GIDC (Rajkot)',
  // Maharashtra
  'Mumbai (Maharashtra)',
  'JNPT Port / Nhava Sheva (Maharashtra)',
  'Bhiwandi (Maharashtra)',
  'Pune (Maharashtra)',
  'Nagpur (Maharashtra)',
  'Nashik (Maharashtra)',
  'Kolhapur (Maharashtra)',
  'Aurangabad (Maharashtra)',
  // Rajasthan
  'Jaipur (Rajasthan)',
  'Jodhpur (Rajasthan)',
  'Udaipur (Rajasthan)',
  'Kota (Rajasthan)',
  'Kishangarh (Rajasthan)',
  'Bhilwara (Rajasthan)',
  'Alwar (Rajasthan)',
  'Bikaner (Rajasthan)',
  // Madhya Pradesh
  'Indore (Madhya Pradesh)',
  'Bhopal (Madhya Pradesh)',
  'Pithampur (Madhya Pradesh)',
  'Gwalior (Madhya Pradesh)',
  'Ujjain (Madhya Pradesh)',
  // North India & Other States
  'Delhi NCR',
  'Gurgaon (Haryana)',
  'Faridabad (Haryana)',
  'Panipat (Haryana)',
  'Ludhiana (Punjab)',
  'Jalandhar (Punjab)',
  'Kanpur (Uttar Pradesh)',
  'Ghaziabad (Uttar Pradesh)',
  'Bengaluru (Karnataka)',
  'Hyderabad (Telangana)',
  'Chennai (Tamil Nadu)',
  // State Search Matches
  'Gujarat (State)',
  'Maharashtra (State)',
  'Rajasthan (State)',
  'Madhya Pradesh (State)',
  'Haryana (State)',
  'Punjab (State)',
  'Delhi (State)',
  'Uttar Pradesh (State)',
  'Karnataka (State)',
  'Andhra Pradesh (State)',
  'Telangana (State)',
  'Tamil Nadu (State)',
];

const SUGGESTED_PARTIES = [
  'Ambuja Cement Ltd',
  'UltraTech Cement',
  'Sanghi Industries',
  'Saurashtra Cement',
  'Shree Cement Ltd',
  'ACC Limited',
  'Nirma Limited',
  'Tata Chemicals Ltd',
  'Adani Logistics Ltd',
  'Reliance Industries',
  'Asian Granito India Ltd',
  'Simpolo Ceramics',
  'Kajaria Ceramics',
  'Somany Ceramics',
  'Sun Ceramics',
  'L&T Construction',
];

export default function NewTripPage() {
  const router = useRouter();
  const toast = useToast();

  // Auto-Generated SR Number / Trip ID
  const [autoSrNumber, setAutoSrNumber] = useState<string>('');

  // STEP 1: Basic Trip Details (Onward Leg)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [vehicleNo, setVehicleNo] = useState('');
  const [customVehicleMode, setCustomVehicleMode] = useState(false);
  const [driverName, setDriverName] = useState('');
  const [customDriverMode, setCustomDriverMode] = useState(false);
  const [partyName, setPartyName] = useState('');
  const [loadingFrom, setLoadingFrom] = useState('');
  const [loadingTo, setLoadingTo] = useState('');

  // STEP 2: Return Leg State (Placed right below Basic Trip Details)
  const [hasReturnLeg, setHasReturnLeg] = useState(false);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [returnDriver, setReturnDriver] = useState('');
  const [returnParty, setReturnParty] = useState('');
  const [returnFrom, setReturnFrom] = useState('');
  const [returnTo, setReturnTo] = useState('');
  const [returnTon, setReturnTon] = useState('');
  const [returnUnloadTon, setReturnUnloadTon] = useState('');
  const [returnRate, setReturnRate] = useState('');
  const [isReturnManualFreight, setIsReturnManualFreight] = useState(false);
  const [returnManualFreight, setReturnManualFreight] = useState('');
  const [returnReceivedAmount, setReturnReceivedAmount] = useState('');
  const [returnPaymentMethod, setReturnPaymentMethod] = useState<PaymentMode>('Jaymin - HDFC');
  const [returnPaymentStatus, setReturnPaymentStatus] = useState<PaymentStatus>('pending');
  const [returnStatusManuallyChanged, setReturnStatusManuallyChanged] = useState(false);

  // Return Silik
  const [returnSilikDate, setReturnSilikDate] = useState(new Date().toISOString().slice(0, 10));
  const [returnDriverSilik, setReturnDriverSilik] = useState('');
  const [returnSilikPaymentMode, setReturnSilikPaymentMode] = useState<PaymentMode>('Cash');

  // Return Diesel
  const [returnDieselKmStart, setReturnDieselKmStart] = useState('');
  const [returnDieselKmEnd, setReturnDieselKmEnd] = useState('');
  const [returnDieselLitres, setReturnDieselLitres] = useState('');
  const [returnDieselRate, setReturnDieselRate] = useState('99.50');
  const [returnDieselCostManual, setReturnDieselCostManual] = useState('');

  // Return Toll & Other Expenses
  const [returnToll, setReturnToll] = useState('');
  const [returnOtherExpense, setReturnOtherExpense] = useState('');
  const [returnNotes, setReturnNotes] = useState('');

  // STEP 3: Onward Trip / Freight & Payment Details
  const [ton, setTon] = useState('');
  const [unloadTon, setUnloadTon] = useState('');
  const [ratePerTon, setRatePerTon] = useState('');
  const [isManualFreight, setIsManualFreight] = useState(false);
  const [manualTotalFreight, setManualTotalFreight] = useState('');
  const [receivedAmount, setReceivedAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMode>('Jaymin - HDFC');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('pending');
  const [statusManuallyChanged, setStatusManuallyChanged] = useState(false);

  // STEP 4: Onward Driver / Silik Details
  const [silikDate, setSilikDate] = useState(new Date().toISOString().slice(0, 10));
  const [driverSilik, setDriverSilik] = useState('');
  const [silikPaymentMode, setSilikPaymentMode] = useState<PaymentMode>('Cash');

  // STEP 5: Onward Diesel Details
  const [dieselKmStart, setDieselKmStart] = useState('');
  const [dieselKmEnd, setDieselKmEnd] = useState('');
  const [dieselLitres, setDieselLitres] = useState('');
  const [dieselRate, setDieselRate] = useState('99.50');
  const [dieselCostManual, setDieselCostManual] = useState('');

  // STEP 6: Onward Toll / Fastag / Other Expenses
  const [toll, setToll] = useState('');
  const [otherExpense, setOtherExpense] = useState('');

  // Notes & saving state
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formErrorBanner, setFormErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [returnEditId, setReturnEditId] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [returnCreatedAt, setReturnCreatedAt] = useState<string | null>(null);

  // Active master options loaded dynamically from master-store
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  const numText = (value: number | null | undefined) => (value == null ? '' : String(value));

  const applyTripPair = (list: UnifiedTrip[], id: string) => {
    const found = list.find(t => t.id === id);
    if (!found) return;
    const onward = found.is_return_leg && found.return_leg_for
      ? (list.find(t => t.id === found.return_leg_for) || found)
      : found;
    const ret = found.is_return_leg
      ? (onward.id === found.id ? null : found)
      : (list.find(t => t.is_return_leg && t.return_leg_for === onward.id) || null);

    const fillOnward = (trip: UnifiedTrip) => {
      const freight = Number(trip.total_freight) || 0;
      const autoFreight = (Number(trip.ton) || 0) * (Number(trip.rate_per_ton) || 0);
      const manual = freight > 0 && Math.abs(freight - autoFreight) > 0.49;
      setEditId(trip.id);
      setCreatedAt(trip.created_at || null);
      setAutoSrNumber(trip.sr_number || '');
      setDate(trip.date || new Date().toISOString().slice(0, 10));
      setVehicleNo(trip.vehicle_no || '');
      setDriverName(trip.driver_name || '');
      setPartyName(trip.party_name || '');
      setLoadingFrom(trip.loading_from || '');
      setLoadingTo(trip.loading_to || '');
      setTon(numText(trip.ton));
      setUnloadTon(numText(trip.unload_ton));
      setRatePerTon(numText(trip.rate_per_ton));
      setIsManualFreight(manual);
      setManualTotalFreight(manual ? String(freight) : '');
      setReceivedAmount(trip.received_amount == null ? '' : String(trip.received_amount));
      setPaymentMethod((trip.payment_mode || 'Jaymin - HDFC') as PaymentMode);
      setPaymentStatus(trip.payment_status || 'pending');
      setStatusManuallyChanged(true);
      setSilikDate(trip.silik_date || trip.date || new Date().toISOString().slice(0, 10));
      setDriverSilik(numText(trip.driver_silik));
      setDieselKmStart(numText(trip.diesel_km_start));
      setDieselKmEnd(numText(trip.diesel_km_end));
      setDieselLitres(numText(trip.diesel_litres));
      setDieselRate(trip.diesel_rate == null ? '99.50' : String(trip.diesel_rate));
      setToll(numText(trip.toll));
      setOtherExpense(numText(trip.other_expense));
      setNotes(trip.notes || '');
    };

    const fillReturn = (trip: UnifiedTrip) => {
      const freight = Number(trip.total_freight) || 0;
      const autoFreight = (Number(trip.ton) || 0) * (Number(trip.rate_per_ton) || 0);
      const manual = freight > 0 && Math.abs(freight - autoFreight) > 0.49;
      setHasReturnLeg(true);
      setReturnEditId(trip.id);
      setReturnCreatedAt(trip.created_at || null);
      setReturnDate(trip.date || '');
      setReturnDriver(trip.driver_name || '');
      setReturnParty(trip.party_name || '');
      setReturnFrom(trip.loading_from || '');
      setReturnTo(trip.loading_to || '');
      setReturnTon(numText(trip.ton));
      setReturnUnloadTon(numText(trip.unload_ton));
      setReturnRate(numText(trip.rate_per_ton));
      setIsReturnManualFreight(manual);
      setReturnManualFreight(manual ? String(freight) : '');
      setReturnReceivedAmount(trip.received_amount == null ? '' : String(trip.received_amount));
      setReturnPaymentMethod((trip.payment_mode || 'Jaymin - HDFC') as PaymentMode);
      setReturnPaymentStatus(trip.payment_status || 'pending');
      setReturnStatusManuallyChanged(true);
      setReturnSilikDate(trip.silik_date || trip.date || '');
      setReturnDriverSilik(numText(trip.driver_silik));
      setReturnDieselKmStart(numText(trip.diesel_km_start));
      setReturnDieselKmEnd(numText(trip.diesel_km_end));
      setReturnDieselLitres(numText(trip.diesel_litres));
      setReturnDieselRate(trip.diesel_rate == null ? '99.50' : String(trip.diesel_rate));
      setReturnToll(numText(trip.toll));
      setReturnOtherExpense(numText(trip.other_expense));
      setReturnNotes(trip.notes || '');
    };

    fillOnward(onward);
    if (ret) fillReturn(ret);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const viewing = params.get('view') === '1';
    setViewMode(viewing);

    if (!id) {
      setAutoSrNumber(getNextSrNumber());
    } else {
      applyTripPair(getStoredTrips(), id);
    }

    syncTripsFromSupabase().then((remote) => {
      const list = remote && remote.length > 0 ? remote : getStoredTrips();
      if (id) applyTripPair(list, id);
      else setAutoSrNumber(getNextSrNumber());
    }).catch(() => {});
    const v = getVehicles();
    setVehicles(v || []);
    const d = getDrivers();
    setDrivers(d || []);
    setParties(getParties());
    setLocations(getLocations());
    const ba = getBankAccounts();
    setBankAccounts(ba || []);

    syncVehiclesFromSupabase().then(remVehicles => {
      if (remVehicles && remVehicles.length > 0) setVehicles(remVehicles);
    }).catch(() => {});

    syncDriversFromSupabase().then(remDrivers => {
      if (remDrivers && remDrivers.length > 0) setDrivers(remDrivers);
    }).catch(() => {});

    syncPartiesFromSupabase().then(remParties => {
      if (remParties && remParties.length > 0) setParties(remParties);
    }).catch(() => {});

    syncLocationsFromSupabase().then(remLocations => {
      if (remLocations && remLocations.length > 0) setLocations(remLocations);
    }).catch(() => {});

    syncBankAccountsFromSupabase().then(remAccounts => {
      if (remAccounts && remAccounts.length > 0) setBankAccounts(remAccounts);
    }).catch(() => {});
  }, []);

  const activeVehicles = vehicles.filter(v => v.is_active !== false);
  const activeDrivers = drivers.filter(d => d.is_active !== false);

  useEffect(() => {
    if (!editId || !vehicleNo || vehicles.length === 0) return;
    if (!vehicles.some(v => v.vehicle_no === vehicleNo)) setCustomVehicleMode(true);
  }, [editId, vehicleNo, vehicles]);

  useEffect(() => {
    if (!editId || !driverName || drivers.length === 0) return;
    if (!drivers.some(d => d.name === driverName)) setCustomDriverMode(true);
  }, [editId, driverName, drivers]);

  // Bank Accounts / Payment Methods list with user-specified priority order (All 12 Accounts)
  const bankAccountOptions = useMemo(() => {
    return getAllAccountOptions(bankAccounts);
  }, [bankAccounts]);

  // ─── Onward Computed Freight & Payment ──────────────────────────────────────
  const computedFreight = useMemo(() => {
    if (isManualFreight && manualTotalFreight !== '') {
      return Number(manualTotalFreight) || 0;
    }
    const t = ton ? Number(ton) : 0;
    const r = ratePerTon ? Number(ratePerTon) : 0;
    return t * r;
  }, [isManualFreight, manualTotalFreight, ton, ratePerTon]);

  const computedReceived = useMemo(() => {
    return receivedAmount !== '' ? Math.max(0, Number(receivedAmount) || 0) : 0;
  }, [receivedAmount]);

  const computedBalance = useMemo(() => {
    return Math.max(0, computedFreight - computedReceived);
  }, [computedFreight, computedReceived]);

  useEffect(() => {
    if (!statusManuallyChanged) {
      if (computedFreight > 0 && computedReceived >= computedFreight) {
        setPaymentStatus('received');
      } else if (computedReceived > 0) {
        setPaymentStatus('partial');
      } else {
        setPaymentStatus('pending');
      }
    }
  }, [computedReceived, computedFreight, statusManuallyChanged]);

  const computed = useMemo(() => {
    return computeUnifiedCalculations({
      total_freight: computedFreight,
      received_amount: computedReceived,
      diesel_km_start: dieselKmStart ? Number(dieselKmStart) : null,
      diesel_km_end: dieselKmEnd ? Number(dieselKmEnd) : null,
      diesel_litres: dieselLitres ? Number(dieselLitres) : null,
      diesel_rate: dieselRate ? Number(dieselRate) : null,
      diesel_cost: dieselCostManual ? Number(dieselCostManual) : null,
      toll: toll ? Number(toll) : null,
      driver_silik: driverSilik ? Number(driverSilik) : null,
      other_expense: otherExpense ? Number(otherExpense) : null,
    });
  }, [computedFreight, computedReceived, dieselKmStart, dieselKmEnd, dieselLitres, dieselRate, dieselCostManual, toll, driverSilik, otherExpense]);

  // ─── Return Computed Freight & Payment ──────────────────────────────────────
  const computedReturnFreight = useMemo(() => {
    if (isReturnManualFreight && returnManualFreight !== '') {
      return Number(returnManualFreight) || 0;
    }
    const t = returnTon ? Number(returnTon) : 0;
    const r = returnRate ? Number(returnRate) : 0;
    return t * r;
  }, [isReturnManualFreight, returnManualFreight, returnTon, returnRate]);

  const computedReturnReceived = useMemo(() => {
    return returnReceivedAmount !== '' ? Math.max(0, Number(returnReceivedAmount) || 0) : 0;
  }, [returnReceivedAmount]);

  const computedReturnBalance = useMemo(() => {
    return Math.max(0, computedReturnFreight - computedReturnReceived);
  }, [computedReturnFreight, computedReturnReceived]);

  useEffect(() => {
    if (!returnStatusManuallyChanged) {
      if (computedReturnFreight > 0 && computedReturnReceived >= computedReturnFreight) {
        setReturnPaymentStatus('received');
      } else if (computedReturnReceived > 0) {
        setReturnPaymentStatus('partial');
      } else {
        setReturnPaymentStatus('pending');
      }
    }
  }, [computedReturnReceived, computedReturnFreight, returnStatusManuallyChanged]);

  const returnComputed = useMemo(() => {
    return computeUnifiedCalculations({
      total_freight: computedReturnFreight,
      received_amount: computedReturnReceived,
      diesel_km_start: returnDieselKmStart ? Number(returnDieselKmStart) : null,
      diesel_km_end: returnDieselKmEnd ? Number(returnDieselKmEnd) : null,
      diesel_litres: returnDieselLitres ? Number(returnDieselLitres) : null,
      diesel_rate: returnDieselRate ? Number(returnDieselRate) : null,
      diesel_cost: returnDieselCostManual ? Number(returnDieselCostManual) : null,
      toll: returnToll ? Number(returnToll) : null,
      driver_silik: returnDriverSilik ? Number(returnDriverSilik) : null,
      other_expense: returnOtherExpense ? Number(returnOtherExpense) : null,
    });
  }, [computedReturnFreight, computedReturnReceived, returnDieselKmStart, returnDieselKmEnd, returnDieselLitres, returnDieselRate, returnDieselCostManual, returnToll, returnDriverSilik, returnOtherExpense]);

  // Combined Round Trip Stats
  const combinedStats = useMemo(() => {
    if (!hasReturnLeg) return null;
    const roundFreight = computedFreight + computedReturnFreight;
    const roundReceived = computedReceived + computedReturnReceived;
    const roundBalance = computedBalance + computedReturnBalance;
    const roundExpense = computed.total_expense + returnComputed.total_expense;
    const roundProfit = computed.profit + returnComputed.profit;
    return {
      roundFreight,
      roundReceived,
      roundBalance,
      roundExpense,
      roundProfit,
    };
  }, [hasReturnLeg, computedFreight, computedReturnFreight, computedReceived, computedReturnReceived, computedBalance, computedReturnBalance, computed.total_expense, returnComputed.total_expense, computed.profit, returnComputed.profit]);

  // Validation
  const validate = (): boolean => {
    const err: Record<string, string> = {};
    const missing: string[] = [];

    if (!date) {
      err.date = 'Select date';
      missing.push('Date');
    }
    if (!vehicleNo || !vehicleNo.trim()) {
      err.vehicleNo = 'Select or enter vehicle number';
      missing.push('Vehicle No.');
    }
    if (!driverName || !driverName.trim()) {
      err.driverName = 'Select or enter driver name';
      missing.push('Driver Name');
    }
    if (!loadingFrom || !loadingFrom.trim()) {
      err.loadingFrom = 'Enter or select loading location';
      missing.push('Loading From');
    }
    if (!loadingTo || !loadingTo.trim()) {
      err.loadingTo = 'Enter or select destination';
      missing.push('Loading To');
    }
    if (loadingFrom && loadingTo && loadingFrom.trim().toLowerCase() === loadingTo.trim().toLowerCase()) {
      err.loadingTo = 'Destination must be different from loading location';
      missing.push('Loading To (must be different from Loading From)');
    }
    if (dieselKmStart && dieselKmEnd && Number(dieselKmEnd) < Number(dieselKmStart)) {
      err.dieselKmEnd = 'End KM must be greater than or equal to Start KM';
      missing.push('Diesel End KM (must be >= Start KM)');
    }

    if (hasReturnLeg) {
      if (!returnFrom || !returnFrom.trim()) {
        missing.push('Return Loading From');
      }
      if (!returnTo || !returnTo.trim()) {
        missing.push('Return Loading To');
      }
      if (returnDieselKmStart && returnDieselKmEnd && Number(returnDieselKmEnd) < Number(returnDieselKmStart)) {
        missing.push('Return Diesel End KM (must be >= Start KM)');
      }
    }

    setErrors(err);

    if (missing.length > 0) {
      setFormErrorBanner(`These details are missing or invalid: ${missing.join(', ')}`);
      toast.error('Please check the trip details', {
        message: missing.length > 3 ? `${missing.slice(0, 3).join(', ')} and ${missing.length - 3} more` : missing.join(', '),
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return false;
    }

    setFormErrorBanner(null);
    return true;
  };

  const handleSave = async () => {
    if (viewMode) return;
    if (!validate()) return;
    setSaving(true);
    setFormErrorBanner(null);

    try {
      await syncTripsFromSupabase().catch(() => {});
      const generatedSr = editId ? (autoSrNumber || getNextSrNumber()) : getNextSrNumber();
      if (!editId) setAutoSrNumber(generatedSr);

      // 1. Save main onward trip
      const saved = saveTrip({
        id: editId || undefined,
        created_at: createdAt || undefined,
        sr_number: generatedSr,
        date,
        vehicle_no: vehicleNo.trim(),
        driver_name: driverName.trim(),
        party_name: partyName.trim(),
        loading_from: loadingFrom.trim(),
        loading_to: loadingTo.trim(),
        ton: ton ? Number(ton) : null,
        unload_ton: unloadTon ? Number(unloadTon) : null,
        rate_per_ton: ratePerTon ? Number(ratePerTon) : null,
        total_freight: computedFreight,
        received_amount: computedReceived,
        balance_amount: computedBalance,
        silik_date: silikDate,
        driver_silik: driverSilik ? Number(driverSilik) : null,
        silik_payment_mode: silikPaymentMode,
        payment_mode: paymentMethod,
        diesel_km_start: dieselKmStart ? Number(dieselKmStart) : null,
        diesel_km_end: dieselKmEnd ? Number(dieselKmEnd) : null,
        diesel_litres: dieselLitres ? Number(dieselLitres) : null,
        diesel_rate: dieselRate ? Number(dieselRate) : null,
        diesel_cost: computed.diesel_cost,
        toll: toll ? Number(toll) : null,
        other_expense: otherExpense ? Number(otherExpense) : null,
        payment_status: paymentStatus,
        notes: notes.trim() || null,
      });

      // Diesel / Fastag / Payment / Driver Summary sync happens inside saveTrip()

      // 2. Save full Return Leg trip if enabled (with all return fields)
      // Note: Return leg shares the SAME parent sr_number (e.g. SR0001) and does not consume a new serial number.
      if (!hasReturnLeg && returnEditId) {
        deleteTrip(returnEditId);
      }

      if (hasReturnLeg && returnFrom && returnTo) {
        saveTrip({
          id: returnEditId || undefined,
          created_at: returnCreatedAt || undefined,
          sr_number: generatedSr,
          date: returnDate || date,
          vehicle_no: vehicleNo.trim(),
          driver_name: (returnDriver || driverName).trim(),
          party_name: (returnParty || partyName).trim(),
          loading_from: returnFrom.trim(),
          loading_to: returnTo.trim(),
          ton: returnTon ? Number(returnTon) : null,
          unload_ton: returnUnloadTon ? Number(returnUnloadTon) : null,
          rate_per_ton: returnRate ? Number(returnRate) : null,
          total_freight: computedReturnFreight,
          received_amount: computedReturnReceived,
          balance_amount: computedReturnBalance,
          silik_date: returnSilikDate,
          driver_silik: returnDriverSilik ? Number(returnDriverSilik) : null,
          silik_payment_mode: returnSilikPaymentMode,
          payment_mode: returnPaymentMethod,
          diesel_km_start: returnDieselKmStart ? Number(returnDieselKmStart) : null,
          diesel_km_end: returnDieselKmEnd ? Number(returnDieselKmEnd) : null,
          diesel_litres: returnDieselLitres ? Number(returnDieselLitres) : null,
          diesel_rate: returnDieselRate ? Number(returnDieselRate) : null,
          diesel_cost: returnComputed.diesel_cost,
          toll: returnToll ? Number(returnToll) : null,
          other_expense: returnOtherExpense ? Number(returnOtherExpense) : null,
          payment_status: returnPaymentStatus,
          is_return_leg: true,
          return_leg_for: saved.id,
          notes: returnNotes.trim() || `Return leg of ${saved.sr_number}`,
        });
      }

      const verb = editId ? 'updated' : 'saved';
      const msg = hasReturnLeg
        ? `Round trip ${saved.sr_number} (onward and return) was ${verb} successfully.`
        : `Trip ${saved.sr_number} was ${verb} successfully.`;

      setSuccessBanner(`${msg} Opening the trips page...`);
      toast.success(editId ? 'Trip updated' : 'Trip saved', { message: msg, afterReload: true });

      setTimeout(() => {
        window.location.href = '/trips';
      }, 400);
    } catch (err) {
      console.error('Error saving trip:', err);
      setFormErrorBanner('The trip could not be saved. Please try again.');
      toast.error('Trip could not be saved', { message: 'Please try again.' });
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-ink">{viewMode ? 'View Trip' : editId ? 'Edit Trip' : 'Add Trip'}</h1>
          <p className="text-[13px] text-muted mt-0.5">
            {viewMode
              ? 'Saved trip details. Fields are locked.'
              : editId
                ? 'Update this trip. The same SR number is kept.'
                : 'Record complete trip and round-trip return details with accounting.'}
          </p>
        </div>
        <Button variant="secondary" onClick={() => router.push('/trips')} className="w-full sm:w-auto">
          {viewMode ? 'Back' : 'Cancel'}
        </Button>
      </div>

      {/* Validation Error Banner Top */}
      {formErrorBanner && (
        <div className="p-4 rounded-xl bg-negative/10 border border-negative/30 text-negative flex items-start gap-3 animate-in fade-in duration-200">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-negative" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
            <h4 className="text-[14px] font-bold">The trip could not be saved. Please check the required details:</h4>
            <p className="text-[13px] mt-1 text-negative/90 leading-relaxed font-medium">
              {formErrorBanner}
            </p>
          </div>
        </div>
      )}

      {/* Success Banner Top */}
      {successBanner && (
        <div className="p-4 rounded-xl bg-positive/10 border border-positive/30 text-positive flex items-center gap-3 animate-in fade-in duration-200">
          <svg className="w-5 h-5 flex-shrink-0 text-positive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-[14px] font-bold">{successBanner}</p>
        </div>
      )}

      <fieldset disabled={viewMode} className="space-y-6 border-0 p-0 m-0 min-w-0">
      {/* STEP 1 – Basic Trip Details (Onward Leg) */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[12px] font-bold">1</span>
          <h2 className="text-base font-semibold text-ink">Basic Trip Details (Onward Leg)</h2>
        </div>

        {/* Prominent Auto-Generated SR Number Card */}
        <div className="mb-5 bg-gradient-to-r from-primary/[0.08] via-primary/[0.04] to-paper border border-primary/25 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-sm shadow-sm">
              ID
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold text-muted uppercase tracking-wider">Trip ID / SR No.</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-positive/15 text-positive border border-positive/30 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                  Auto-Created
                </span>
              </div>
              <p className="text-[20px] font-extrabold text-primary font-mono tracking-tight mt-0.5">
                {autoSrNumber || 'SR0001'}
              </p>
            </div>
          </div>
          <div className="text-right sm:block hidden">
            <span className="inline-block text-[12px] font-medium text-muted bg-paper px-3 py-1.5 rounded-lg border border-line">
              🔒 Auto-Generated ID • Read Only
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <TextField
            label="Date"
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              if (hasReturnLeg && !returnDate) setReturnDate(e.target.value);
            }}
            error={errors.date}
            required
          />

          {/* Vehicle No with toggle for custom vehicle */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-[13px] font-medium text-muted">
                Vehicle No. <span className="text-negative">*</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setCustomVehicleMode(!customVehicleMode);
                  setVehicleNo('');
                }}
                className="text-[11px] text-primary hover:underline font-medium"
              >
                {customVehicleMode ? '← Select from master' : '+ Enter custom vehicle'}
              </button>
            </div>
            {customVehicleMode ? (
              <input
                type="text"
                placeholder="e.g. GJ-03-XX-9999"
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                className={`px-3 py-2 rounded-lg border bg-paper text-[14px] ${errors.vehicleNo ? 'border-negative ring-1 ring-negative/20' : 'border-line'}`}
              />
            ) : (
              <select
                value={vehicleNo}
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    setCustomVehicleMode(true);
                    setVehicleNo('');
                  } else {
                    setVehicleNo(e.target.value);
                  }
                }}
                className={`px-3 py-2 rounded-lg border bg-paper text-[14px] ${errors.vehicleNo ? 'border-negative ring-1 ring-negative/20' : 'border-line'}`}
              >
                <option value="">Select vehicle from master</option>
                {activeVehicles.map(v => (
                  <option key={v.id} value={v.vehicle_no}>
                    {v.vehicle_no} {((v as any).type || (v as any).model) ? `(${((v as any).type || (v as any).model)})` : ''}
                  </option>
                ))}
                <option value="__custom__">+ Enter custom vehicle...</option>
              </select>
            )}
            {errors.vehicleNo && (
              <span className="text-[12px] text-negative font-medium">{errors.vehicleNo}</span>
            )}
          </div>

          {/* Driver with toggle for custom driver */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-[13px] font-medium text-muted">
                Driver <span className="text-negative">*</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setCustomDriverMode(!customDriverMode);
                  setDriverName('');
                }}
                className="text-[11px] text-primary hover:underline font-medium"
              >
                {customDriverMode ? '← Select from master' : '+ Enter custom driver'}
              </button>
            </div>
            {customDriverMode ? (
              <input
                type="text"
                placeholder="Driver full name..."
                value={driverName}
                onChange={(e) => {
                  setDriverName(e.target.value);
                  if (hasReturnLeg && !returnDriver) setReturnDriver(e.target.value);
                }}
                className={`px-3 py-2 rounded-lg border bg-paper text-[14px] ${errors.driverName ? 'border-negative ring-1 ring-negative/20' : 'border-line'}`}
              />
            ) : (
              <select
                value={driverName}
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    setCustomDriverMode(true);
                    setDriverName('');
                  } else {
                    setDriverName(e.target.value);
                    if (hasReturnLeg && !returnDriver) setReturnDriver(e.target.value);
                  }
                }}
                className={`px-3 py-2 rounded-lg border bg-paper text-[14px] ${errors.driverName ? 'border-negative ring-1 ring-negative/20' : 'border-line'}`}
              >
                <option value="">Select driver from master</option>
                {activeDrivers.map(d => (
                  <option key={d.id} value={d.name}>
                    {d.name} ({d.phone || 'Driver'})
                  </option>
                ))}
                <option value="__custom__">+ Enter custom driver...</option>
              </select>
            )}
            {errors.driverName && (
              <span className="text-[12px] text-negative font-medium">{errors.driverName}</span>
            )}
          </div>

          <TextField
            label="Party / Customer Name"
            list="party-suggestions"
            value={partyName}
            onChange={(e) => setPartyName(e.target.value)}
            placeholder="Type or search party name..."
            hint="Type manually or search"
          />

          <TextField
            label="Loading From"
            list="location-suggestions"
            value={loadingFrom}
            onChange={(e) => {
              setLoadingFrom(e.target.value);
              if (hasReturnLeg && !returnTo) setReturnTo(e.target.value);
            }}
            placeholder="Type or search city / state / hub..."
            error={errors.loadingFrom}
            required
            hint="Type any city/location manually"
          />

          <TextField
            label="Loading To"
            list="location-suggestions"
            value={loadingTo}
            onChange={(e) => {
              setLoadingTo(e.target.value);
              if (hasReturnLeg && !returnFrom) setReturnFrom(e.target.value);
            }}
            placeholder="Type or search destination city / state..."
            error={errors.loadingTo}
            required
            hint="Type any destination manually"
          />
        </div>
      </Card>

      {/* STEP 2 – Onward Freight and Payment Details */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[12px] font-bold">2</span>
            <div>
              <h2 className="text-base font-semibold text-ink">Onward Freight & Payment Details</h2>
              <p className="text-[12px] text-muted">Total freight, amount received, and remaining balance</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsManualFreight(!isManualFreight);
              if (!isManualFreight) {
                setManualTotalFreight(String(computedFreight || ''));
              }
            }}
            className="text-[12px] text-primary hover:underline font-medium"
          >
            {isManualFreight ? '← Auto calculate from Ton × Rate' : '✏️ Enter Freight Manually (Lumpsum)'}
          </button>
        </div>

        {/* Load / Rate Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <TextField
            label="Load Ton"
            type="number"
            step="0.01"
            placeholder="40.07"
            value={ton}
            onChange={(e) => setTon(e.target.value)}
            required={!isManualFreight}
          />
          <TextField
            label="Unload Ton (optional)"
            type="number"
            step="0.01"
            placeholder="40.07"
            value={unloadTon}
            onChange={(e) => setUnloadTon(e.target.value)}
          />
          <TextField
            label="Rate / Ton (₹)"
            type="number"
            step="0.01"
            placeholder="900"
            value={ratePerTon}
            onChange={(e) => setRatePerTon(e.target.value)}
            required={!isManualFreight}
          />
        </div>

        {/* Payment breakdown: total freight, received, and balance */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-paper rounded-xl border border-line mb-4">
          {/* Total Freight Input */}
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-semibold text-ink flex items-center justify-between">
              <span>Total Freight / Payment (₹)</span>
              {isManualFreight && (
                <span className="text-[11px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-normal">Manual</span>
              )}
            </label>
            {isManualFreight ? (
              <input
                type="number"
                step="1"
                placeholder="36000"
                value={manualTotalFreight}
                onChange={(e) => setManualTotalFreight(e.target.value)}
                className="px-3 py-2 rounded-lg border border-primary bg-panel text-[15px] font-bold text-ink focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            ) : (
              <div className="px-3 py-2 rounded-lg border border-line bg-panel text-[16px] font-bold text-ink flex items-center justify-between">
                <span>{formatCurrency(computedFreight)}</span>
                <span className="text-[11px] text-muted font-normal">Auto: Ton × Rate</span>
              </div>
            )}
            <span className="text-[11px] text-muted">Onward freight amount</span>
          </div>

          {/* Received amount */}
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-semibold text-positive flex items-center justify-between">
              <span>Received (₹)</span>
              <span className="text-[11px] font-normal text-muted">Enter manually</span>
            </label>
            <input
              type="number"
              step="1"
              placeholder="e.g. 20000"
              value={receivedAmount}
              onChange={(e) => setReceivedAmount(e.target.value)}
              className="px-3 py-2 rounded-lg border border-positive/40 bg-panel text-[16px] font-bold text-positive placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-positive/20"
            />
            <span className="text-[11px] text-muted">Jitna payment party se receive ho gaya</span>
          </div>

          {/* Remaining balance */}
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-semibold text-amber-700 flex items-center justify-between">
              <span>Balance (₹)</span>
              <span className="text-[11px] font-normal text-muted">Auto computed</span>
            </label>
            <div className={`px-3 py-2 rounded-lg border flex items-center justify-between text-[16px] font-extrabold ${
              computedBalance > 0 ? 'border-amber-400/50 bg-amber-500/10 text-amber-800' : 'border-line bg-panel text-positive'
            }`}>
              <span>{formatCurrency(computedBalance)}</span>
              <span className="text-[11px] font-medium">
                {computedBalance === 0 && computedFreight > 0 ? '✓ Paid Full' : 'Pending'}
              </span>
            </div>
            <span className="text-[11px] text-muted">Total Freight − Received Amount</span>
          </div>
        </div>

        {/* Payment Method & Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectField
            label="Payment Method / Bank Account"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMode)}
            options={bankAccountOptions}
          />
          <SelectField
            label="Freight Payment Status"
            value={paymentStatus}
            onChange={(e) => {
              setStatusManuallyChanged(true);
              setPaymentStatus(e.target.value as PaymentStatus);
            }}
            options={[
              { value: 'pending', label: 'Pending (nothing received)' },
              { value: 'partial', label: 'Partial (some amount received)' },
              { value: 'received', label: 'Received (paid in full)' },
              { value: 'overdue', label: 'Overdue (Payment Delay)' },
            ]}
          />
        </div>
      </Card>

      {/* STEP 3 – Onward Driver / Silik Details */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[12px] font-bold">3</span>
          <h2 className="text-base font-semibold text-ink">Onward Driver / Silik Details</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <TextField
            label="Silik Date"
            type="date"
            value={silikDate}
            onChange={(e) => setSilikDate(e.target.value)}
          />
          <TextField
            label="Driver Silik / Advance (₹)"
            type="number"
            placeholder="3600"
            value={driverSilik}
            onChange={(e) => setDriverSilik(e.target.value)}
          />
          <SelectField
            label="Silik Payment Mode"
            value={silikPaymentMode}
            onChange={(e) => setSilikPaymentMode(e.target.value as PaymentMode)}
            options={bankAccountOptions}
          />
        </div>
      </Card>

      {/* STEP 4 – Onward Diesel Details */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[12px] font-bold">4</span>
          <h2 className="text-base font-semibold text-ink">Onward Diesel Details</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <TextField
            label="Diesel KM Start"
            type="number"
            placeholder="2612"
            value={dieselKmStart}
            onChange={(e) => setDieselKmStart(e.target.value)}
          />
          <TextField
            label="Diesel KM End"
            type="number"
            placeholder="3200"
            value={dieselKmEnd}
            onChange={(e) => {
              setDieselKmEnd(e.target.value);
              if (hasReturnLeg && !returnDieselKmStart) setReturnDieselKmStart(e.target.value);
            }}
            error={errors.dieselKmEnd}
          />
          <TextField
            label="Diesel Litres"
            type="number"
            step="0.01"
            placeholder="207"
            value={dieselLitres}
            onChange={(e) => setDieselLitres(e.target.value)}
          />
          <TextField
            label="Diesel Rate (₹/L)"
            type="number"
            step="0.01"
            placeholder="99.50"
            value={dieselRate}
            onChange={(e) => setDieselRate(e.target.value)}
          />
        </div>
        <div className="mt-4 grid grid-cols-1 min-[481px]:grid-cols-3 gap-3 p-3 bg-paper rounded-lg border border-line text-[13px]">
          <div>
            <span className="text-muted block text-[11px] uppercase">Total KM</span>
            <strong className="text-ink text-[14px]">{computed.total_km > 0 ? `${computed.total_km} km` : '—'}</strong>
          </div>
          <div>
            <span className="text-muted block text-[11px] uppercase">Average KM/L</span>
            <strong className="text-ink text-[14px]">{computed.average_kmpl > 0 ? `${computed.average_kmpl} km/l` : '—'}</strong>
          </div>
          <div>
            <span className="text-muted block text-[11px] uppercase">Diesel Cost (₹)</span>
            <strong className="text-negative text-[14px]">{formatCurrency(computed.diesel_cost)}</strong>
          </div>
        </div>
      </Card>

      {/* STEP 5 – Onward Toll / Fastag / Other Expenses */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[12px] font-bold">5</span>
          <h2 className="text-base font-semibold text-ink">Onward Toll / Fastag / Other Expenses</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField
            label="Toll / FASTag (₹)"
            type="number"
            placeholder="3235"
            value={toll}
            onChange={(e) => setToll(e.target.value)}
          />
          <TextField
            label="Other Expense (₹)"
            type="number"
            placeholder="0"
            value={otherExpense}
            onChange={(e) => setOtherExpense(e.target.value)}
          />
        </div>
      </Card>

      {/* STEP 6 – Total Accounting Summary & Net Profit */}
      <Card className="border-primary/40 bg-primary/[0.02]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[12px] font-bold">6</span>
            <h2 className="text-base font-bold text-primary flex items-center gap-2">
              Trip Accounting Summary
              <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">Live Calculation</span>
            </h2>
          </div>
          {hasReturnLeg && (
            <span className="text-[12px] font-bold text-primary px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/25">
              Round Trip (Onward + Return)
            </span>
          )}
        </div>

        {/* If Return Leg is active, show both individual legs + round trip combined */}
        {hasReturnLeg && combinedStats ? (
          <div className="space-y-3">
            {/* Overall Round Trip Highlight */}
            <div className="grid grid-cols-1 min-[481px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-3.5 bg-panel rounded-xl border-2 border-primary/30 shadow-xs">
              <div>
                <p className="text-[11px] font-bold text-muted uppercase">Round Trip Freight</p>
                <p className="text-[17px] font-black text-ink mt-0.5">{formatCurrency(combinedStats.roundFreight)}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-positive uppercase">Round Trip Received</p>
                <p className="text-[17px] font-black text-positive mt-0.5">{formatCurrency(combinedStats.roundReceived)}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-amber-700 uppercase">Round Trip Balance</p>
                <p className="text-[17px] font-black text-amber-700 mt-0.5">{formatCurrency(combinedStats.roundBalance)}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-negative uppercase">Total Expenses</p>
                <p className="text-[17px] font-black text-negative mt-0.5">{formatCurrency(combinedStats.roundExpense)}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-primary uppercase">Total Net Profit</p>
                <p className={`text-[17px] font-black mt-0.5 ${combinedStats.roundProfit >= 0 ? 'text-positive' : 'text-negative'}`}>
                  {formatCurrency(combinedStats.roundProfit)}
                </p>
              </div>
            </div>

            {/* Split row breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
              <div className="p-3 bg-paper rounded-lg border border-line">
                <span className="font-bold text-ink block mb-1">Onward Leg:</span>
                <span className="text-muted">Freight: </span><strong>{formatCurrency(computedFreight)}</strong> | 
                <span className="text-positive"> Received: </span><strong>{formatCurrency(computedReceived)}</strong> | 
                <span className="text-amber-700"> Balance: </span><strong>{formatCurrency(computedBalance)}</strong> | 
                <span className="text-muted"> Profit: </span><strong className={computed.profit >= 0 ? 'text-positive' : 'text-negative'}>{formatCurrency(computed.profit)}</strong>
              </div>
              <div className="p-3 bg-paper rounded-lg border border-line">
                <span className="font-bold text-ink block mb-1">Return Leg:</span>
                <span className="text-muted">Freight: </span><strong>{formatCurrency(computedReturnFreight)}</strong> | 
                <span className="text-positive"> Received: </span><strong>{formatCurrency(computedReturnReceived)}</strong> | 
                <span className="text-amber-700"> Balance: </span><strong>{formatCurrency(computedReturnBalance)}</strong> | 
                <span className="text-muted"> Profit: </span><strong className={returnComputed.profit >= 0 ? 'text-positive' : 'text-negative'}>{formatCurrency(returnComputed.profit)}</strong>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 min-[481px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3 bg-panel rounded-xl border border-line">
              <p className="text-[11px] font-semibold text-muted uppercase">Total Freight</p>
              <p className="text-[16px] font-bold text-ink mt-1">{formatCurrency(computedFreight)}</p>
            </div>
            <div className="p-3 bg-panel rounded-xl border border-positive/30">
              <p className="text-[11px] font-semibold text-positive uppercase">Received</p>
              <p className="text-[16px] font-bold text-positive mt-1">{formatCurrency(computedReceived)}</p>
            </div>
            <div className="p-3 bg-panel rounded-xl border border-amber-300">
              <p className="text-[11px] font-semibold text-amber-700 uppercase">Balance</p>
              <p className="text-[16px] font-bold text-amber-700 mt-1">{formatCurrency(computedBalance)}</p>
            </div>
            <div className="p-3 bg-panel rounded-xl border border-line">
              <p className="text-[11px] font-semibold text-muted uppercase">Diesel Cost</p>
              <p className="text-[16px] font-bold text-negative mt-1">{formatCurrency(computed.diesel_cost)}</p>
            </div>
            <div className="p-3 bg-panel rounded-xl border border-line">
              <p className="text-[11px] font-semibold text-muted uppercase">Total Expense</p>
              <p className="text-[16px] font-bold text-negative mt-1">{formatCurrency(computed.total_expense)}</p>
            </div>
            <div className="p-3 bg-panel rounded-xl border border-line">
              <p className="text-[11px] font-semibold text-muted uppercase">Net Profit</p>
              <p className={`text-[16px] font-bold mt-1 ${computed.profit >= 0 ? 'text-positive' : 'text-negative'}`}>
                {formatCurrency(computed.profit)}
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* STEP 7 – Notes */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[12px] font-bold">7</span>
          <h2 className="text-base font-semibold text-ink">Trip Notes</h2>
        </div>
        <TextareaField
          label="Trip Notes (optional)"
          placeholder="Any instructions, loading notes or remarks..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Card>

      {/* STEP 8 – Return Leg / Return Trip */}
      <Card className={`transition-all duration-200 ${hasReturnLeg ? 'border-2 border-primary/50 bg-paper shadow-md' : 'border-dashed border-primary/40 bg-paper'}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[12px] font-bold shrink-0">8</span>
            <div>
              <h2 className="text-base font-semibold text-ink flex items-center gap-2">
                Return Leg / Return Trip
                {hasReturnLeg ? (
                  <span className="text-[11px] font-bold bg-primary text-white px-2 py-0.5 rounded-full shadow-xs">
                    Return trip included
                  </span>
                ) : (
                  <span className="text-[11px] font-medium bg-paper border border-line text-muted px-2 py-0.5 rounded-full">
                    Optional
                  </span>
                )}
              </h2>
              <p className="text-[12px] text-muted">Optional return trip: route, freight, received amount, balance, driver advance, diesel, and expenses</p>
            </div>
          </div>
          <Button
            type="button"
            variant={hasReturnLeg ? 'secondary' : 'primary'}
            size="sm"
            onClick={() => {
              const next = !hasReturnLeg;
              setHasReturnLeg(next);
              if (next) {
                if (!returnFrom && loadingTo) setReturnFrom(loadingTo);
                if (!returnTo && loadingFrom) setReturnTo(loadingFrom);
                if (!returnDriver && driverName) setReturnDriver(driverName);
                if (!returnDate && date) setReturnDate(date);
                if (!returnDieselKmStart && dieselKmEnd) setReturnDieselKmStart(dieselKmEnd);
              }
            }}
          >
            {hasReturnLeg ? '✕ Remove Return Leg' : '+ Add Return Leg (Full Entry)'}
          </Button>
        </div>

        {hasReturnLeg && (
          <div className="mt-5 pt-4 border-t border-line space-y-6 animate-in fade-in duration-200">
            {/* 2.1 Return Basic Route & Party */}
            <div>
              <h3 className="text-[14px] font-bold text-ink mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                Return Route & Party Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <TextField
                  label="Return Date"
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  required
                />
                <TextField
                  label="Return Loading From"
                  list="location-suggestions"
                  value={returnFrom}
                  onChange={(e) => setReturnFrom(e.target.value)}
                  placeholder="Type return origin..."
                  hint="Defaults to onward destination"
                  required
                />
                <TextField
                  label="Return Loading To"
                  list="location-suggestions"
                  value={returnTo}
                  onChange={(e) => setReturnTo(e.target.value)}
                  placeholder="Type return destination..."
                  hint="Defaults to onward origin"
                  required
                />
                <TextField
                  label="Return Party / Customer"
                  list="party-suggestions"
                  value={returnParty}
                  onChange={(e) => setReturnParty(e.target.value)}
                  placeholder="Type return party name..."
                />
                <TextField
                  label="Return Driver"
                  value={returnDriver || driverName}
                  onChange={(e) => setReturnDriver(e.target.value)}
                  placeholder="Driver name..."
                  hint="Pre-filled from onward trip"
                />
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] font-medium text-muted">Return Vehicle</label>
                  <input
                    type="text"
                    value={vehicleNo || 'Same Vehicle'}
                    readOnly
                    className="px-3 py-2 rounded-lg border border-line bg-paper/60 text-[14px] font-medium text-ink cursor-not-allowed"
                  />
                  <span className="text-[11px] text-muted">Same vehicle returning</span>
                </div>
              </div>
            </div>

            {/* Return freight and payment */}
            <div className="p-4 rounded-xl bg-panel border border-line space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-bold text-ink flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-positive" />
                  Return Freight and Payment
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setIsReturnManualFreight(!isReturnManualFreight);
                    if (!isReturnManualFreight) {
                      setReturnManualFreight(String(computedReturnFreight || ''));
                    }
                  }}
                  className="text-[11px] text-primary hover:underline font-medium"
                >
                  {isReturnManualFreight ? '← Auto calculate (Ton × Rate)' : '✏️ Enter Return Freight Manually (Lumpsum)'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <TextField
                  label="Return Load Ton"
                  type="number"
                  step="0.01"
                  placeholder="38.50"
                  value={returnTon}
                  onChange={(e) => setReturnTon(e.target.value)}
                />
                <TextField
                  label="Return Unload Ton (optional)"
                  type="number"
                  step="0.01"
                  placeholder="38.50"
                  value={returnUnloadTon}
                  onChange={(e) => setReturnUnloadTon(e.target.value)}
                />
                <TextField
                  label="Return Rate / Ton (₹)"
                  type="number"
                  step="0.01"
                  placeholder="850"
                  value={returnRate}
                  onChange={(e) => setReturnRate(e.target.value)}
                />
              </div>

              {/* Return payment breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-paper rounded-lg border border-line">
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-semibold text-ink">Return Total Freight (₹)</label>
                  {isReturnManualFreight ? (
                    <input
                      type="number"
                      step="1"
                      placeholder="32000"
                      value={returnManualFreight}
                      onChange={(e) => setReturnManualFreight(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-primary bg-panel text-[14px] font-bold text-ink"
                    />
                  ) : (
                    <div className="px-3 py-1.5 rounded-lg border border-line bg-panel text-[15px] font-bold text-ink">
                      {formatCurrency(computedReturnFreight)}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-semibold text-positive">Return Received (₹)</label>
                  <input
                    type="number"
                    step="1"
                    placeholder="e.g. 15000"
                    value={returnReceivedAmount}
                    onChange={(e) => setReturnReceivedAmount(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-positive/40 bg-panel text-[15px] font-bold text-positive focus:outline-none focus:ring-1 focus:ring-positive"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-semibold text-amber-700">Return Balance (₹)</label>
                  <div className={`px-3 py-1.5 rounded-lg border font-bold text-[15px] flex items-center justify-between ${
                    computedReturnBalance > 0 ? 'border-amber-300 bg-amber-500/10 text-amber-800' : 'border-line bg-panel text-positive'
                  }`}>
                    <span>{formatCurrency(computedReturnBalance)}</span>
                    <span className="text-[10px]">{computedReturnBalance === 0 && computedReturnFreight > 0 ? 'Paid' : 'Pending'}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SelectField
                  label="Return Payment Method / Bank"
                  value={returnPaymentMethod}
                  onChange={(e) => setReturnPaymentMethod(e.target.value as PaymentMode)}
                  options={bankAccountOptions}
                />
                <SelectField
                  label="Return Payment Status"
                  value={returnPaymentStatus}
                  onChange={(e) => {
                    setReturnStatusManuallyChanged(true);
                    setReturnPaymentStatus(e.target.value as PaymentStatus);
                  }}
                  options={[
                    { value: 'pending', label: 'Pending' },
                    { value: 'partial', label: 'Partial' },
                    { value: 'received', label: 'Received (Paid)' },
                    { value: 'overdue', label: 'Overdue' },
                  ]}
                />
              </div>
            </div>

            {/* 2.3 Return Driver Silik & Return Diesel & Return Toll */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Return Driver Silik */}
              <div className="p-3.5 rounded-xl bg-panel border border-line space-y-3">
                <h4 className="text-[13px] font-bold text-ink">Return Driver Silik / Advance</h4>
                <div className="grid grid-cols-1 min-[481px]:grid-cols-2 gap-3">
                  <TextField
                    label="Silik Date"
                    type="date"
                    value={returnSilikDate}
                    onChange={(e) => setReturnSilikDate(e.target.value)}
                  />
                  <TextField
                    label="Return Silik (₹)"
                    type="number"
                    placeholder="2000"
                    value={returnDriverSilik}
                    onChange={(e) => setReturnDriverSilik(e.target.value)}
                  />
                </div>
                <SelectField
                  label="Silik Payment Mode"
                  value={returnSilikPaymentMode}
                  onChange={(e) => setReturnSilikPaymentMode(e.target.value as PaymentMode)}
                  options={bankAccountOptions}
                />
              </div>

              {/* Return Toll & Other Expense */}
              <div className="p-3.5 rounded-xl bg-panel border border-line space-y-3">
                <h4 className="text-[13px] font-bold text-ink">Return Toll & Other Expenses</h4>
                <div className="grid grid-cols-1 min-[481px]:grid-cols-2 gap-3">
                  <TextField
                    label="Return Toll (₹)"
                    type="number"
                    placeholder="2500"
                    value={returnToll}
                    onChange={(e) => setReturnToll(e.target.value)}
                  />
                  <TextField
                    label="Return Other (₹)"
                    type="number"
                    placeholder="0"
                    value={returnOtherExpense}
                    onChange={(e) => setReturnOtherExpense(e.target.value)}
                  />
                </div>
                <TextField
                  label="Return Notes"
                  placeholder="Instructions or return notes..."
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                />
              </div>
            </div>

            {/* 2.4 Return Diesel */}
            <div className="p-3.5 rounded-xl bg-panel border border-line space-y-3">
              <h4 className="text-[13px] font-bold text-ink">Return Diesel Details (Optional if filled on return)</h4>
              <div className="grid grid-cols-1 min-[481px]:grid-cols-2 lg:grid-cols-4 gap-3">
                <TextField
                  label="Return KM Start"
                  type="number"
                  placeholder="3200"
                  value={returnDieselKmStart}
                  onChange={(e) => setReturnDieselKmStart(e.target.value)}
                />
                <TextField
                  label="Return KM End"
                  type="number"
                  placeholder="3750"
                  value={returnDieselKmEnd}
                  onChange={(e) => setReturnDieselKmEnd(e.target.value)}
                />
                <TextField
                  label="Return Litres"
                  type="number"
                  step="0.01"
                  placeholder="180"
                  value={returnDieselLitres}
                  onChange={(e) => setReturnDieselLitres(e.target.value)}
                />
                <TextField
                  label="Diesel Rate (₹/L)"
                  type="number"
                  step="0.01"
                  placeholder="99.50"
                  value={returnDieselRate}
                  onChange={(e) => setReturnDieselRate(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 min-[481px]:grid-cols-3 gap-3 p-2.5 bg-paper rounded-lg border border-line text-[12px]">
                <div>
                  <span className="text-muted block text-[10px] uppercase">Return Total KM</span>
                  <strong className="text-ink">{returnComputed.total_km > 0 ? `${returnComputed.total_km} km` : '—'}</strong>
                </div>
                <div>
                  <span className="text-muted block text-[10px] uppercase">Return Avg KM/L</span>
                  <strong className="text-ink">{returnComputed.average_kmpl > 0 ? `${returnComputed.average_kmpl} km/l` : '—'}</strong>
                </div>
                <div>
                  <span className="text-muted block text-[10px] uppercase">Return Diesel Cost</span>
                  <strong className="text-negative">{formatCurrency(returnComputed.diesel_cost)}</strong>
                </div>
              </div>
            </div>

            {/* 2.5 Return Leg Accounting Summary Card */}
            <div className="p-3 bg-paper rounded-xl border border-primary/30 flex flex-wrap items-center justify-between gap-3 text-[13px]">
              <div>
                <span className="text-[11px] font-semibold text-muted uppercase block">Return Freight</span>
                <strong className="text-ink font-bold text-[15px]">{formatCurrency(computedReturnFreight)}</strong>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-positive uppercase block">Return Received</span>
                <strong className="text-positive font-bold text-[15px]">{formatCurrency(computedReturnReceived)}</strong>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-amber-700 uppercase block">Return Balance</span>
                <strong className="text-amber-700 font-bold text-[15px]">{formatCurrency(computedReturnBalance)}</strong>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-muted uppercase block">Return Expenses</span>
                <strong className="text-negative font-bold text-[15px]">{formatCurrency(returnComputed.total_expense)}</strong>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-muted uppercase block">Return Profit</span>
                <strong className={`font-bold text-[15px] ${returnComputed.profit >= 0 ? 'text-positive' : 'text-negative'}`}>
                  {formatCurrency(returnComputed.profit)}
                </strong>
              </div>
            </div>
          </div>
        )}
      </Card>


      </fieldset>

      {/* Bottom Feedback Banner */}
      {formErrorBanner && (
        <div className="p-3.5 rounded-xl bg-negative/10 border border-negative/30 text-negative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-[13px] font-semibold">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{formErrorBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="text-primary hover:underline text-[12px] whitespace-nowrap font-medium"
          >
            ↑ Check fields at top
          </button>
        </div>
      )}

      {successBanner && (
        <div className="p-3.5 rounded-xl bg-positive/10 border border-positive/30 text-positive flex items-center gap-2 text-[13px] font-bold">
          <span>✅</span>
          <span>{successBanner}</span>
        </div>
      )}

      {/* Save Action Buttons */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
        <Button variant="secondary" onClick={() => router.push('/trips')} className="w-full sm:w-auto">
          {viewMode ? 'Back' : 'Cancel'}
        </Button>
        {!viewMode && (
          <Button onClick={handleSave} loading={saving} size="lg" className="w-full sm:w-auto">
            {saving
              ? 'Saving Trip...'
              : editId
                ? (hasReturnLeg ? 'Update Round Trip (Onward + Return)' : 'Update Trip')
                : (hasReturnLeg ? 'Save Round Trip (Onward + Return)' : 'Save Trip')}
          </Button>
        )}
      </div>

      {/* Autocomplete Datalists for Location & Party suggestions */}
      <datalist id="location-suggestions">
        {locations.map((loc) => (
          <option key={`m-loc-${loc.id}`} value={loc.name} />
        ))}
        {SUGGESTED_LOCATIONS.map((loc) => (
          <option key={loc} value={loc} />
        ))}
      </datalist>
      <datalist id="party-suggestions">
        {parties.map((p) => (
          <option key={`m-party-${p.id}`} value={p.name} />
        ))}
        {SUGGESTED_PARTIES.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
    </div>
  );
}
