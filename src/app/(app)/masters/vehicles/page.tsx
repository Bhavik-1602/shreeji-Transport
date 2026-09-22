'use client';

import { useState } from 'react';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { InputField } from '@/components/Input';
import StatusPill from '@/components/StatusPill';
import Modal from '@/components/Modal';
import EmptyState from '@/components/EmptyState';
import SearchInput from '@/components/SearchInput';
import { getVehicles, saveVehicle, toggleVehicleActive, syncVehiclesFromSupabase, deleteVehicle } from '@/lib/master-store';
import { generateUUID } from '@/lib/supabase-service';
import { formatDate } from '@/lib/format';
import type { Vehicle } from '@/types/database';
import { useEffect } from 'react';

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setVehicles(getVehicles());
    syncVehiclesFromSupabase().then(remote => {
      if (remote && remote.length > 0) {
        setVehicles(remote);
      }
    }).catch(() => {});
  }, []);

  // Form state
  const [vehicleNo, setVehicleNo] = useState('');
  const [model, setModel] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [formError, setFormError] = useState('');

  const filtered = vehicles.filter(v =>
    v.vehicle_no.toLowerCase().includes(search.toLowerCase()) ||
    (v.model?.toLowerCase().includes(search.toLowerCase()))
  );

  const openForm = (vehicle?: Vehicle) => {
    if (vehicle) {
      setEditing(vehicle);
      setVehicleNo(vehicle.vehicle_no);
      setModel(vehicle.model || '');
      setOwnerName(vehicle.owner_name || '');
      setPurchaseDate(vehicle.purchase_date || '');
    } else {
      setEditing(null);
      setVehicleNo('');
      setModel('');
      setOwnerName('');
      setPurchaseDate('');
    }
    setFormError('');
    setShowForm(true);
  };

  const handleSave = () => {
    if (!vehicleNo.trim()) { setFormError('Enter vehicle number'); return; }

    // Check duplicate within transport
    const duplicate = vehicles.find(v =>
      v.vehicle_no.toLowerCase() === vehicleNo.trim().toLowerCase() && v.id !== editing?.id
    );
    if (duplicate) { setFormError('This vehicle number already exists'); return; }

    const entry: Vehicle = {
      id: editing ? editing.id : generateUUID(),
      transport_id: 'a0000000-0000-0000-0000-000000000001',
      vehicle_no: vehicleNo.trim(),
      model: model || null,
      owner_name: ownerName || null,
      purchase_date: purchaseDate || null,
      is_active: editing ? editing.is_active : true,
    };

    const updated = saveVehicle(entry);
    setVehicles(updated);
    setShowForm(false);
  };

  const toggleActive = (id: string) => {
    const updated = toggleVehicleActive(id);
    setVehicles(updated);
  };

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SearchInput
          placeholder="Search vehicles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
          wrapperClassName="flex-1 max-w-xs"
        />
        <Button onClick={() => openForm()}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M8 3v10M3 8h10" />
          </svg>
          Add Vehicle
        </Button>
      </div>

      {/* Table */}
      <Card padding="none">
        {filtered.length === 0 ? (
          <EmptyState
            title="No vehicles found"
            description={search ? 'Try a different search term.' : 'Add your first vehicle to get started.'}
            actionLabel={!search ? 'Add Vehicle' : undefined}
            onAction={!search ? () => openForm() : undefined}
          />
        ) : (
          <div className="overflow-x-auto table-scroll">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left text-[13px] font-medium text-muted px-6 py-3">Vehicle No</th>
                  <th className="text-left text-[13px] font-medium text-muted px-4 py-3">Model</th>
                  <th className="text-left text-[13px] font-medium text-muted px-4 py-3">Owner</th>
                  <th className="text-left text-[13px] font-medium text-muted px-4 py-3">Purchase Date</th>
                  <th className="text-center text-[13px] font-medium text-muted px-4 py-3">Status</th>
                  <th className="text-right text-[13px] font-medium text-muted px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <tr key={v.id} className="border-b border-line/50 hover:bg-paper/50 transition-colors duration-100">
                    <td className="px-6 py-3 text-[14px] font-medium text-ink">{v.vehicle_no}</td>
                    <td className="px-4 py-3 text-[14px]">{v.model || '—'}</td>
                    <td className="px-4 py-3 text-[14px]">{v.owner_name || '—'}</td>
                    <td className="px-4 py-3 text-[14px]">{formatDate(v.purchase_date)}</td>
                    <td className="px-4 py-3 text-center">
                      <StatusPill status={v.is_active ? 'active' : 'inactive'} />
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openForm(v)} className="text-[13px] font-medium text-primary hover:underline">Edit</button>
                        <button onClick={() => toggleActive(v.id)} className="text-[13px] font-medium text-muted hover:text-ink">
                          {v.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit Vehicle' : 'Add Vehicle'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? 'Save Changes' : 'Add Vehicle'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <InputField
            label="Vehicle Number"
            placeholder="GJ-03-AB-1234"
            value={vehicleNo}
            onChange={(e) => setVehicleNo(e.target.value)}
            error={formError && !vehicleNo.trim() ? formError : formError.includes('exists') ? formError : undefined}
            autoFocus
          />
          <InputField
            label="Model"
            placeholder="Tata LPT 3521"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
          <InputField
            label="Owner Name"
            placeholder="Shreeji Transport"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
          />
          <InputField
            label="Purchase Date"
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
          />
          {formError && vehicleNo.trim() && !formError.includes('exists') && (
            <p className="text-[12px] text-negative">{formError}</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
