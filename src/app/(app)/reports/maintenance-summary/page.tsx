'use client';

import { useState, useMemo, useEffect } from 'react';
import Card from '@/components/Card';
import { formatCurrency } from '@/lib/format';
import { getStoredMaintenance, syncMaintenanceFromSupabase } from '@/lib/operations-store';
import type { Maintenance } from '@/types/database';

function getMonthKey(date: string) {
  return date.substring(0, 7); // "YYYY-MM"
}

function formatMonth(key: string) {
  const [year, month] = key.split('-');
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

const MONTH_COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-orange-500', 'bg-green-500',
  'bg-cyan-500', 'bg-pink-500', 'bg-yellow-500', 'bg-red-500',
];

export default function MaintenanceSummaryPage() {
  const [records, setRecords] = useState<Maintenance[]>([]);
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('2026');

  useEffect(() => {
    setRecords(getStoredMaintenance());
    syncMaintenanceFromSupabase().then(remote => {
      if (remote && remote.length > 0) setRecords(remote);
    }).catch(() => {});
  }, []);

  const vehicles = useMemo(() => [...new Set(records.map(r => r.vehicle_no))], [records]);

  const filtered = useMemo(() => records.filter(r => {
    if (vehicleFilter && r.vehicle_no !== vehicleFilter) return false;
    if (yearFilter && !r.date.startsWith(yearFilter)) return false;
    return true;
  }), [records, vehicleFilter, yearFilter]);

  // Group by month
  const byMonth = useMemo(() => {
    const map: Record<string, { records: Maintenance[]; total: number }> = {};
    filtered.forEach(r => {
      const key = getMonthKey(r.date);
      if (!map[key]) map[key] = { records: [], total: 0 };
      map[key].records.push(r);
      map[key].total += r.amount;
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  // Group by vehicle
  const byVehicle = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(r => { map[r.vehicle_no] = (map[r.vehicle_no] ?? 0) + r.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const grandTotal = filtered.reduce((s, r) => s + r.amount, 0);
  const maxMonthAmount = byMonth.length > 0 ? Math.max(...byMonth.map(([, v]) => v.total)) : 1;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="text-[13px]">
          <option value="2026">2026</option>
          <option value="2025">2025</option>
        </select>
        <select value={vehicleFilter} onChange={e => setVehicleFilter(e.target.value)} className="text-[13px]">
          <option value="">All Vehicles</option>
          {vehicles.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <span className="text-[13px] text-muted">
          Grand Total: <strong className="text-negative">{formatCurrency(grandTotal)}</strong>
        </span>
      </div>

      {/* Vehicle breakdown */}
      {byVehicle.length > 1 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {byVehicle.map(([vehicle, amt], i) => (
            <div key={vehicle} className="rounded-xl border border-line bg-panel p-4">
              <p className="text-[11px] text-muted uppercase tracking-wider truncate">{vehicle}</p>
              <p className="text-[18px] font-bold text-negative mt-1">{formatCurrency(amt)}</p>
              <div className="mt-2 h-1 rounded-full bg-line overflow-hidden">
                <div
                  className={`h-full rounded-full ${MONTH_COLORS[i % MONTH_COLORS.length]}`}
                  style={{ width: `${(amt / grandTotal) * 100}%` }}
                />
              </div>
              <p className="text-[11px] text-muted mt-1">{((amt / grandTotal) * 100).toFixed(1)}% of total</p>
            </div>
          ))}
        </div>
      )}

      {/* Month-wise table */}
      <div className="space-y-4">
        {byMonth.length === 0 ? (
          <Card padding="lg">
            <p className="text-muted text-center py-8">No maintenance records for selected filters.</p>
          </Card>
        ) : byMonth.map(([monthKey, { records, total }], mi) => (
          <Card key={monthKey} padding="none">
            {/* Month header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${MONTH_COLORS[mi % MONTH_COLORS.length]}`} />
                <h3 className="text-[15px] font-semibold text-ink">{formatMonth(monthKey)}</h3>
                <span className="text-[12px] text-muted">{records.length} record{records.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-4">
                {/* Mini bar */}
                <div className="w-32 h-2 rounded-full bg-line overflow-hidden">
                  <div
                    className={`h-full rounded-full ${MONTH_COLORS[mi % MONTH_COLORS.length]}`}
                    style={{ width: `${(total / maxMonthAmount) * 100}%` }}
                  />
                </div>
                <span className="text-[16px] font-bold text-negative">{formatCurrency(total)}</span>
              </div>
            </div>
            {/* Records table */}
            <table className="w-full">
              <thead>
                <tr className="border-b border-line/50">
                  <th className="text-left text-[12px] font-medium text-muted px-5 py-2">Date</th>
                  <th className="text-left text-[12px] font-medium text-muted px-4 py-2">Vehicle</th>
                  <th className="text-left text-[12px] font-medium text-muted px-4 py-2">Work / Part</th>
                  <th className="text-left text-[12px] font-medium text-muted px-4 py-2">Paid To</th>
                  <th className="text-right text-[12px] font-medium text-muted px-5 py-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id} className="border-b border-line/30 hover:bg-paper/50">
                    <td className="px-5 py-2.5 text-[13px] whitespace-nowrap">{r.date}</td>
                    <td className="px-4 py-2.5 text-[13px] font-medium whitespace-nowrap">{r.vehicle_no}</td>
                    <td className="px-4 py-2.5 text-[13px]">{r.work_part}</td>
                    <td className="px-4 py-2.5 text-[13px] text-muted">{r.paid_to ?? '—'}</td>
                    <td className="px-5 py-2.5 text-[13px] text-right font-medium text-negative">{formatCurrency(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="px-5 py-2.5 text-[13px] font-semibold text-ink">Month Total</td>
                  <td className="px-5 py-2.5 text-[13px] text-right font-bold text-negative">{formatCurrency(total)}</td>
                </tr>
              </tfoot>
            </table>
          </Card>
        ))}
      </div>
    </div>
  );
}
