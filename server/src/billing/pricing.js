/**
 * Pure pricing math (minor currency units, e.g. paisa for BDT).
 * The frontend NEVER decides the payable amount — every checkout and invoice
 * goes through quote() on the backend with trusted plan records.
 */
import { db } from '../db.js';

export function quote(plan, seats) {
  const qty = parseInt(seats);
  if (!Number.isInteger(qty) || qty < 1) {
    throw Object.assign(new Error('Seat quantity must be a positive integer'), { status: 400 });
  }
  if (plan.status !== 'active') {
    throw Object.assign(new Error('Plan is not available'), { status: 400 });
  }
  if (qty < (plan.min_seats || 1)) {
    throw Object.assign(new Error(`Minimum ${plan.min_seats} seats for this plan`), { status: 400 });
  }
  if (plan.max_seats && qty > plan.max_seats) {
    throw Object.assign(new Error(`Maximum ${plan.max_seats} seats for this plan`), { status: 400 });
  }

  const lines = [];
  let subtotal = 0;
  if (plan.pricing_model === 'base_plus_seat') {
    if (plan.base_fee > 0) {
      lines.push({ kind: 'base_fee', label: `${plan.name} — institutional base fee`, qty: 1, unit: plan.base_fee, amount: plan.base_fee });
      subtotal += plan.base_fee;
    }
    const seatAmount = qty * plan.per_seat_fee;
    lines.push({ kind: 'seats', label: `${plan.name} — ${qty} staff license(s)`, qty, unit: plan.per_seat_fee, amount: seatAmount });
    subtotal += seatAmount;
  } else if (plan.pricing_model === 'band') {
    const bands = JSON.parse(plan.bands_json || '[]');
    const band = bands.find((b) => qty >= b.min && (b.max == null || qty <= b.max));
    if (!band) throw Object.assign(new Error('No price band covers this quantity'), { status: 400 });
    const seatAmount = qty * band.per_seat;
    lines.push({ kind: 'band_seats', label: `${plan.name} — ${qty} staff license(s) (band ${band.min}${band.max ? `–${band.max}` : '+'})`, qty, unit: band.per_seat, amount: seatAmount });
    subtotal += seatAmount;
  } else {
    const seatAmount = qty * plan.per_seat_fee;
    lines.push({ kind: 'seats', label: `${plan.name} — ${qty} staff license(s)`, qty, unit: plan.per_seat_fee, amount: seatAmount });
    subtotal += seatAmount;
  }

  const vat = Math.round((subtotal * (plan.vat_percent || 0)) / 100);
  return {
    plan_id: plan.plan_id,
    plan_name: plan.name,
    billing_period: plan.billing_period,
    currency: plan.currency,
    seats: qty,
    pricing_model: plan.pricing_model,
    terms_version: plan.terms_version,
    lines,
    subtotal,
    vat_percent: plan.vat_percent || 0,
    vat,
    total: subtotal + vat
  };
}

export function fmtMoney(minor, currency = 'BDT') {
  const major = (minor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currency} ${major}`;
}

export function addMonths(dateStr, n) {
  const d = dateStr ? new Date(dateStr + 'Z') : new Date();
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

export function planMonths(period) {
  return period === 'monthly' ? 1 : 12;
}

/** Invoice numbers: INV-2026-00041 (year-scoped, gapless within a tx). */
export async function nextInvoiceNo(year) {
  const row = await dbGetCounter(`inv_${year}`);
  return `INV-${year}-${String(row + 1).padStart(5, '0')}`;
}

async function dbGetCounter(name) {
  await db.prepare('INSERT INTO billing_counters (name, value) VALUES (?, 0) ON CONFLICT (name) DO NOTHING').run(name);
  const row = await db.prepare('SELECT value FROM billing_counters WHERE name = ?').get(name);
  await db.prepare('UPDATE billing_counters SET value = value + 1 WHERE name = ?').run(name);
  return row.value;
}
