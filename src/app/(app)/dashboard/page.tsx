'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import Card, { StatCard } from '@/components/Card';
import StatusPill from '@/components/StatusPill';
import { getStoredTrips, subscribeTrips, syncTripsFromSupabase, type UnifiedTrip } from '@/lib/trip-store';
import { formatCurrency, formatDate } from '@/lib/format';

export default function DashboardPage() {
  const [trips, setTrips] = useState<UnifiedTrip[]>([]);

  useEffect(() => {
    setTrips(getStoredTrips());
    syncTripsFromSupabase().then((remote) => {
      if (remote && remote.length > 0) setTrips([...remote]);
    });
    return subscribeTrips((updated) => setTrips([...updated]));
  }, []);

  const summary = useMemo(() => {
    const totalTrips = trips.length;
    const totalFreight = trips.reduce((s, t) => s + (t.total_freight ?? 0), 0);
    const totalExpense = trips.reduce((s, t) => s + (t.total_expense ?? 0), 0);
    const totalProfit = trips.reduce((s, t) => s + (t.profit ?? 0), 0);
    const receivedTrips = trips.filter(t => t.payment_status === 'received');
    const pendingTrips = trips.filter(t => t.payment_status === 'pending' || t.payment_status === 'partial');
    const overdueTrips = trips.filter(t => t.payment_status === 'overdue');
    const receivedAmount = trips.reduce((s, t) => {
      const tf = t.total_freight ?? 0;
      const rec = t.received_amount != null ? Number(t.received_amount) : (t.payment_status === 'received' ? tf : 0);
      return s + rec;
    }, 0);
    const pendingAmount = trips.reduce((s, t) => {
      const tf = t.total_freight ?? 0;
      const rec = t.received_amount != null ? Number(t.received_amount) : (t.payment_status === 'received' ? tf : 0);
      const bal = t.balance_amount != null ? Number(t.balance_amount) : Math.max(0, tf - rec);
      return s + bal;
    }, 0);
    const overdueAmount = overdueTrips.reduce((s, t) => {
      const tf = t.total_freight ?? 0;
      const rec = t.received_amount != null ? Number(t.received_amount) : 0;
      return s + Math.max(0, tf - rec);
    }, 0);
    const pendingAmountOnly = Math.max(0, pendingAmount - overdueAmount);
    const uniqueVehicles = new Set(trips.map(t => t.vehicle_no).filter(Boolean)).size;

    const totalSilik = trips.reduce((s, t) => s + (t.driver_silik ?? 0), 0);
    const totalDiesel = trips.reduce((s, t) => s + (t.diesel_cost ?? 0), 0);
    const totalToll = trips.reduce((s, t) => s + (t.toll ?? 0), 0);

    return {
      totalTrips,
      totalFreight,
      totalExpense,
      totalProfit,
      receivedAmount,
      pendingAmount,
      pendingAmountOnly,
      overdueAmount,
      pendingCount: pendingTrips.length,
      overdueCount: overdueTrips.length,
      activeVehicles: uniqueVehicles,
      totalSilik,
      totalDiesel,
      totalToll,
    };
  }, [trips]);

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 min-[481px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Total Trips"
          value={String(summary.totalTrips)}
          subtitle="This month"
          color="primary"
          icon={
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 10h14" /><path d="M13 6l4 4-4 4" />
              <circle cx="5" cy="4" r="2" /><circle cx="15" cy="16" r="2" />
            </svg>
          }
        />
        <StatCard
          title="Total Freight"
          value={formatCurrency(summary.totalFreight)}
          subtitle={`${summary.activeVehicles} active vehicles`}
          color="primary"
          icon={
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="6" width="18" height="8" rx="2" />
              <circle cx="5" cy="14" r="2" /><circle cx="15" cy="14" r="2" />
              <path d="M1 10h18" />
            </svg>
          }
        />
        <StatCard
          title="Pending Amount"
          value={formatCurrency(summary.pendingAmount)}
          subtitle={`${summary.pendingCount} pending, ${summary.overdueCount} overdue`}
          color="warning"
          icon={
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="10" cy="10" r="8" /><path d="M10 6v4l3 3" />
            </svg>
          }
        />
        <StatCard
          title="Net Profit"
          value={formatCurrency(summary.totalProfit)}
          subtitle="All trips combined"
          color={summary.totalProfit >= 0 ? 'positive' : 'negative'}
          icon={
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 16l4-4 3 3 4-6 5 5" /><path d="M15 8h3v3" />
            </svg>
          }
        />
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2.5 sm:gap-3">
        <Link
          href="/trips/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-[14px] font-semibold hover:bg-primary/90 shadow-xs transition-colors duration-150"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M8 3v10M3 8h10" />
          </svg>
          Add Trip
        </Link>
        <Link
          href="/diesel"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-panel text-ink border border-line text-[14px] font-medium hover:bg-paper transition-colors duration-150 shadow-xs"
        >
          ⛽ Diesel Slips
        </Link>
        <Link
          href="/payment"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-panel text-ink border border-line text-[14px] font-medium hover:bg-paper transition-colors duration-150 shadow-xs"
        >
          ₹ Payments
        </Link>
        <Link
          href="/trips"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-panel text-ink border border-line text-[14px] font-medium hover:bg-paper transition-colors duration-150 shadow-xs"
        >
          🚚 All Trips
        </Link>
        <Link
          href="/masters/vehicles"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-panel text-ink border border-line text-[14px] font-medium hover:bg-paper transition-colors duration-150 shadow-xs"
        >
          Vehicles
        </Link>
        <Link
          href="/masters/drivers"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-panel text-ink border border-line text-[14px] font-medium hover:bg-paper transition-colors duration-150 shadow-xs"
        >
          Drivers
        </Link>
      </div>

      {/* Recent Trips */}
      <Card padding="none">
        <div className="px-4 sm:px-6 py-4 border-b border-line flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">Recent Trips</h2>
          <Link href="/trips" className="text-[13px] font-medium text-primary hover:underline">
            View all →
          </Link>
        </div>

        <div className="overflow-x-auto table-scroll">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left text-[13px] font-medium text-muted px-6 py-3">SR No.</th>
                <th className="text-left text-[13px] font-medium text-muted px-4 py-3">Date</th>
                <th className="text-left text-[13px] font-medium text-muted px-4 py-3">Vehicle</th>
                <th className="text-left text-[13px] font-medium text-muted px-4 py-3">Route</th>
                <th className="text-right text-[13px] font-medium text-muted px-4 py-3">Freight</th>
                <th className="text-right text-[13px] font-medium text-muted px-4 py-3">Expense</th>
                <th className="text-right text-[13px] font-medium text-muted px-4 py-3">Profit</th>
                <th className="text-center text-[13px] font-medium text-muted px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {trips.slice(0, 6).map((trip) => (
                <tr key={trip.id} className="border-b border-line/50 hover:bg-paper/50 transition-colors duration-100">
                  <td className="px-6 py-3 whitespace-nowrap">
                    <Link href={`/trips`} className="text-[14px] font-semibold text-primary hover:underline">
                      {trip.is_return_leg ? (
                        <span className="text-amber-800 bg-amber-500/20 text-[11px] px-2 py-0.5 rounded font-bold border border-amber-300">
                          ↳ Return
                        </span>
                      ) : (
                        trip.sr_number
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[14px] whitespace-nowrap">{formatDate(trip.date)}</td>
                  <td className="px-4 py-3 text-[14px] font-medium whitespace-nowrap">{trip.vehicle_no || '—'}</td>
                  <td className="px-4 py-3 text-[14px]">
                    {trip.loading_from || '—'} → {trip.loading_to || '—'}
                  </td>
                  <td className="px-4 py-3 text-[14px] text-right">{formatCurrency(trip.total_freight)}</td>
                  <td className="px-4 py-3 text-[14px] text-right text-negative">{formatCurrency(trip.total_expense)}</td>
                  <td className={`px-4 py-3 text-[14px] text-right font-medium ${(trip.profit ?? 0) >= 0 ? 'text-positive' : 'text-negative'}`}>
                    {formatCurrency(trip.profit)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusPill status={trip.payment_status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Payment Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-[15px] font-semibold text-ink mb-4">Payment Overview</h3>
          <div className="space-y-3">
            <div className="flex items-start sm:items-center justify-between gap-3 py-2 border-b border-line/50">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-positive" />
                <span className="text-[14px] text-ink">Received</span>
              </div>
              <span className="text-[14px] font-medium text-positive">{formatCurrency(summary.receivedAmount)}</span>
            </div>
            <div className="flex items-start sm:items-center justify-between gap-3 py-2 border-b border-line/50">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-warning" />
                <span className="text-[14px] text-ink">Pending</span>
              </div>
              <span className="text-[14px] font-medium text-warning">{formatCurrency(summary.pendingAmountOnly)}</span>
            </div>
            <div className="flex items-start sm:items-center justify-between gap-3 py-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-negative" />
                <span className="text-[14px] text-ink">Overdue</span>
              </div>
              <span className="text-[14px] font-medium text-negative">{formatCurrency(summary.overdueAmount)}</span>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-[15px] font-semibold text-ink mb-4">Expense Breakdown</h3>
          <div className="space-y-3">
            <div className="flex items-start sm:items-center justify-between gap-3 py-2 border-b border-line/50">
              <span className="text-[14px] text-ink">Driver Silik / Advances</span>
              <span className="text-[14px] font-medium">{formatCurrency(summary.totalSilik)}</span>
            </div>
            <div className="flex items-start sm:items-center justify-between gap-3 py-2 border-b border-line/50">
              <span className="text-[14px] text-ink">Diesel</span>
              <span className="text-[14px] font-medium">{formatCurrency(summary.totalDiesel)}</span>
            </div>
            <div className="flex items-start sm:items-center justify-between gap-3 py-2 border-b border-line/50">
              <span className="text-[14px] text-ink">Toll / FASTag</span>
              <span className="text-[14px] font-medium">{formatCurrency(summary.totalToll)}</span>
            </div>
            <div className="flex items-start sm:items-center justify-between gap-3 py-2">
              <span className="text-[14px] text-ink font-medium">Total Expense</span>
              <span className="text-[14px] font-semibold text-negative">{formatCurrency(summary.totalExpense)}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
