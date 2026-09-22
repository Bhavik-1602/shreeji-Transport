import { clsx } from 'clsx';

type PillStatus = 'received' | 'pending' | 'overdue' | 'partial' | 'active' | 'inactive' | 'cash' | 'online' | 'upi' | 'bank_transfer' | string;

interface StatusPillProps {
  status: PillStatus;
  className?: string;
}

const config: Record<string, { label: string; bg: string; text: string }> = {
  received:         { label: 'Received',         bg: 'bg-positive/10',    text: 'text-positive' },
  partial:          { label: 'Partial',          bg: 'bg-amber-500/15',   text: 'text-amber-700' },
  pending:          { label: 'Pending',          bg: 'bg-warning/10',     text: 'text-warning'  },
  overdue:          { label: 'Overdue',          bg: 'bg-negative/10',    text: 'text-negative' },
  active:           { label: 'Active',           bg: 'bg-positive/10',    text: 'text-positive' },
  inactive:         { label: 'Inactive',         bg: 'bg-muted/10',       text: 'text-muted'    },
  cash:             { label: 'Cash',             bg: 'bg-emerald-500/10', text: 'text-emerald-700' },
  Cash:             { label: 'Cash',             bg: 'bg-emerald-500/10', text: 'text-emerald-700' },
  online:           { label: 'Online',           bg: 'bg-online/10',      text: 'text-online'   },
  upi:              { label: 'UPI',              bg: 'bg-primary/10',     text: 'text-primary'  },
  'Online / UPI':   { label: 'Online / UPI',     bg: 'bg-purple-500/10',  text: 'text-purple-700' },
  bank_transfer:    { label: 'Bank Transfer',    bg: 'bg-blue-500/10',    text: 'text-blue-600' },
  'Jaymin - HDFC':   { label: 'Jaymin - HDFC',    bg: 'bg-blue-500/10',    text: 'text-blue-700' },
  'Shreeji - ICICI': { label: 'Shreeji - ICICI',  bg: 'bg-orange-500/10',  text: 'text-orange-700' },
  'Vijay - HDFC':    { label: 'Vijay - HDFC',     bg: 'bg-blue-500/10',    text: 'text-blue-700' },
  'Jaymin - IDFC':   { label: 'Jaymin - IDFC',    bg: 'bg-red-500/10',     text: 'text-red-700' },
  'Jaymin - Cash':   { label: 'Jaymin - Cash',    bg: 'bg-emerald-500/10', text: 'text-emerald-700' },
  'Jaymin - Online': { label: 'Jaymin - Online',  bg: 'bg-purple-500/10',  text: 'text-purple-700' },
  'Vijay - Cash':    { label: 'Vijay - Cash',     bg: 'bg-emerald-500/10', text: 'text-emerald-700' },
  'Vijay - Online':  { label: 'Vijay - Online',   bg: 'bg-purple-500/10',  text: 'text-purple-700' },
  'Shreeji - Cash':  { label: 'Shreeji - Cash',   bg: 'bg-emerald-500/10', text: 'text-emerald-700' },
  'Shreeji - Online':{ label: 'Shreeji - Online', bg: 'bg-purple-500/10',  text: 'text-purple-700' },
};

export default function StatusPill({ status, className }: StatusPillProps) {
  if (!status) return null;
  const lower = status.toLowerCase();
  const c = config[status] || {
    label: status,
    bg: lower.includes('cash') || lower.includes('case')
      ? 'bg-emerald-500/10'
      : lower.includes('online') || lower.includes('upi')
      ? 'bg-purple-500/10'
      : lower.includes('icici')
      ? 'bg-orange-500/10'
      : 'bg-blue-500/10',
    text: lower.includes('cash') || lower.includes('case')
      ? 'text-emerald-700'
      : lower.includes('online') || lower.includes('upi')
      ? 'text-purple-700'
      : lower.includes('icici')
      ? 'text-orange-700'
      : 'text-blue-700',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium whitespace-nowrap',
        c.bg, c.text,
        className,
      )}
    >
      {c.label}
    </span>
  );
}
