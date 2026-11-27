/**
 * OPHIREUM NETWORK — Atomic Asia/Manila Payment Reference Allocator
 *
 * Format: MMDDYYYYHHMMAMNNN or MMDDYYYYHHMMPMNNN
 * Example: 032520260215PM001
 *
 * Components (computed strictly in Asia/Manila timezone):
 * - MM: 2-digit month (01-12)
 * - DD: 2-digit day (01-31)
 * - YYYY: 4-digit year
 * - HH: 2-digit 12-hour clock hour (01-12)
 * - MM: 2-digit minute (00-59)
 * - AM/PM: uppercase meridiem
 * - NNN: 3-digit zero-padded atomic sequence per minute bucket (001-999; 4-digit zero-padded overflow beyond 999)
 */

const MANILA_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

export function formatManilaMinuteBucket(date: Date = new Date()): string {
  const parts = MANILA_FORMATTER.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  const month = get('month').padStart(2, '0');
  const day = get('day').padStart(2, '0');
  const year = get('year').padStart(4, '0');
  const hour = get('hour').padStart(2, '0');
  const minute = get('minute').padStart(2, '0');
  const dayPeriod = get('dayPeriod').toUpperCase() === 'PM' ? 'PM' : 'AM';
  return `${month}${day}${year}${hour}${minute}${dayPeriod}`;
}

export class AtomicPaymentReferenceAllocator {
  private readonly counters = new Map<string, number>();

  public allocate(date: Date = new Date()): string {
    const bucket = formatManilaMinuteBucket(date);
    const next = (this.counters.get(bucket) || 0) + 1;
    this.counters.set(bucket, next);

    // Keep memory bounded to recent buckets
    if (this.counters.size > 2048) {
      const oldestKey = this.counters.keys().next().value;
      if (oldestKey && oldestKey !== bucket) {
        this.counters.delete(oldestKey);
      }
    }

    const suffix = next <= 999 ? String(next).padStart(3, '0') : String(next).padStart(4, '0');
    return `${bucket}${suffix}`;
  }
}

export const PAYMENT_REFERENCE_REGEX = /^(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{4}(0[1-9]|1[0-2])[0-5]\d(AM|PM)\d{3,}$/;

export function isValidOphireumPaymentReference(ref: string): boolean {
  return PAYMENT_REFERENCE_REGEX.test(ref);
}
