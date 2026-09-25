import { jsPDF } from 'jspdf';
import type { UnifiedTrip } from './trip-store';
import { computeUnifiedCalculations } from './trip-store';

export type TripVoucherData = {
  voucherNo: string;
  date: string;
  vehicleNo: string;
  driverName: string;
  loadingFrom: string;
  unloadingTo: string;
  weightTon: number;
  freightRate: number;
  totalFreight: number;
  diesel: number;
  fastag: number;
  otherExpense: number;
  silik: number;
  totalExpense: number;
  netAmount: number;
  legLabel?: string;
};

function formatDate(iso: string): string {
  if (!iso) return '—';
  const parts = iso.slice(0, 10).split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatAmount(n: number): string {
  const value = Number.isFinite(n) ? Math.round(n) : 0;
  return value.toLocaleString('en-IN');
}

export function tripToVoucherData(trip: Partial<UnifiedTrip>, options?: { legLabel?: string }): TripVoucherData {
  const calcs = computeUnifiedCalculations(trip);
  return {
    voucherNo: trip.sr_number || '—',
    date: formatDate(trip.date || ''),
    vehicleNo: trip.vehicle_no || '—',
    driverName: trip.driver_name || '—',
    loadingFrom: trip.loading_from || '—',
    unloadingTo: trip.loading_to || '—',
    weightTon: Number(trip.ton) || 0,
    freightRate: Number(trip.rate_per_ton) || 0,
    totalFreight: calcs.total_freight,
    diesel: calcs.diesel_cost,
    fastag: Number(trip.toll) || 0,
    otherExpense: Number(trip.other_expense) || 0,
    silik: Number(trip.driver_silik) || 0,
    totalExpense: calcs.total_expense,
    netAmount: calcs.profit,
    legLabel: options?.legLabel,
  };
}

/** Draw one voucher page matching Shreeji_Transport_Voucher_Demo.pdf */
function drawVoucherPage(doc: jsPDF, data: TripVoucherData, pageWidth: number, margin: number) {
  const contentW = pageWidth - margin * 2;
  let y = 28;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(16, 26, 30);
  doc.text('SHREEJI TRANSPORT', pageWidth / 2, y, { align: 'center' });
  y += 10;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 50, 55);
  const subtitle = data.legLabel
    ? `TRANSPORT TRIP / PAYMENT VOUCHER (${data.legLabel})`
    : 'TRANSPORT TRIP / PAYMENT VOUCHER';
  doc.text(subtitle, pageWidth / 2, y, { align: 'center' });
  y += 14;

  // Trip details 2-col table
  const detailRows: [string, string, string, string][] = [
    ['Voucher No.', data.voucherNo, 'Date', data.date],
    ['Vehicle No.', data.vehicleNo, 'Driver Name', data.driverName],
    ['Loading From', data.loadingFrom, 'Unloading To', data.unloadingTo],
    [
      'Weight',
      data.weightTon > 0 ? `${data.weightTon} Ton` : '—',
      'Freight Rate',
      data.freightRate > 0 ? `${formatAmount(data.freightRate)} / Ton` : '—',
    ],
  ];

  const col1W = contentW * 0.22;
  const col2W = contentW * 0.28;
  const col3W = contentW * 0.22;
  const col4W = contentW * 0.28;
  const rowH = 11;
  const labelBg: [number, number, number] = [232, 236, 239];
  const line: [number, number, number] = [180, 188, 192];

  doc.setDrawColor(...line);
  doc.setLineWidth(0.4);

  for (const [l1, v1, l2, v2] of detailRows) {
    let x = margin;
    // label 1
    doc.setFillColor(...labelBg);
    doc.rect(x, y, col1W, rowH, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(40, 50, 55);
    doc.text(l1, x + 3, y + 7);
    x += col1W;
    // value 1
    doc.setFillColor(255, 255, 255);
    doc.rect(x, y, col2W, rowH, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.text(String(v1), x + 3, y + 7);
    x += col2W;
    // label 2
    doc.setFillColor(...labelBg);
    doc.rect(x, y, col3W, rowH, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.text(l2, x + 3, y + 7);
    x += col3W;
    // value 2
    doc.setFillColor(255, 255, 255);
    doc.rect(x, y, col4W, rowH, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.text(String(v2), x + 3, y + 7);
    y += rowH;
  }

  y += 14;

  // Section title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(16, 26, 30);
  doc.text('PAYMENT / EXPENSE DETAILS', margin, y);
  y += 6;

  // Expense table header
  const particW = contentW * 0.62;
  const amountW = contentW * 0.38;
  const headerH = 10;
  const headerBg: [number, number, number] = [30, 64, 110];

  doc.setFillColor(...headerBg);
  doc.setDrawColor(...line);
  doc.rect(margin, y, particW, headerH, 'FD');
  doc.rect(margin + particW, y, amountW, headerH, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('Particulars', margin + 4, y + 6.5);
  doc.text('Amount (Rs.)', margin + particW + amountW - 4, y + 6.5, { align: 'right' });
  y += headerH;

  const expenseRows: { label: string; amount: number; style?: 'normal' | 'total' | 'net' }[] = [
    { label: 'Total Freight', amount: data.totalFreight },
    { label: 'Diesel', amount: data.diesel },
    { label: 'Fastag', amount: data.fastag },
    { label: 'Other Expense', amount: data.otherExpense },
    { label: 'Silik', amount: data.silik },
    { label: 'Total Expense', amount: data.totalExpense, style: 'total' },
    { label: 'Net Amount / Balance', amount: data.netAmount, style: 'net' },
  ];

  const expRowH = 10;
  for (const row of expenseRows) {
    if (row.style === 'total') {
      doc.setFillColor(210, 228, 245);
    } else if (row.style === 'net') {
      doc.setFillColor(210, 235, 220);
    } else {
      doc.setFillColor(255, 255, 255);
    }
    doc.setDrawColor(...line);
    doc.rect(margin, y, particW, expRowH, 'FD');
    doc.rect(margin + particW, y, amountW, expRowH, 'FD');

    doc.setFont('helvetica', row.style ? 'bold' : 'normal');
    doc.setFontSize(9);
    doc.setTextColor(16, 26, 30);
    doc.text(row.label, margin + 4, y + 6.5);
    doc.text(formatAmount(row.amount), margin + particW + amountW - 4, y + 6.5, { align: 'right' });
    y += expRowH;
  }

  y += 28;

  // Signatures
  const sigW = (contentW - 20) / 2;
  const leftX = margin;
  const rightX = margin + sigW + 20;

  doc.setDrawColor(90, 100, 105);
  doc.setLineWidth(0.5);
  doc.line(leftX, y, leftX + sigW, y);
  doc.line(rightX, y, rightX + sigW, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(40, 50, 55);
  doc.text('Driver Signature', leftX + sigW / 2, y + 7, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.text('For SHREEJI TRANSPORT', rightX + sigW / 2, y - 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text('Authorized Signature', rightX + sigW / 2, y + 7, { align: 'center' });
}

export function buildTripVoucherPdf(
  trips: Array<Partial<UnifiedTrip> & { legLabel?: string }>,
): jsPDF {
  const list = trips.filter(Boolean);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;

  list.forEach((trip, index) => {
    if (index > 0) doc.addPage();
    const data = tripToVoucherData(trip, { legLabel: trip.legLabel });
    drawVoucherPage(doc, data, pageWidth, margin);
  });

  return doc;
}

export function getTripVoucherPdfBlob(
  trips: Array<Partial<UnifiedTrip> & { legLabel?: string }>,
): Blob {
  return buildTripVoucherPdf(trips).output('blob');
}

export function downloadTripVoucherPdf(
  trips: Array<Partial<UnifiedTrip> & { legLabel?: string }>,
  fileName?: string,
): void {
  if (typeof window === 'undefined') return;
  const list = trips.filter(Boolean);
  if (list.length === 0) return;

  const doc = buildTripVoucherPdf(list);
  const primary = list[0];
  const sr = (primary.sr_number || 'trip').replace(/[^\w-]+/g, '_');
  const name = fileName || `Shreeji_Transport_Voucher_${sr}.pdf`;
  doc.save(name);
}
