import { supabase } from './supabase';

export type BookingCancelResult = {
  ok: boolean;
  refundStatus?: string;
  refundAmountCents?: number;
  error?: string;
};

export async function cancelBookingViaEdge(
  bookingId: string,
  subdomain: string,
  cancelledBy: 'client' | 'stylist',
  contact?: string,
): Promise<BookingCancelResult> {
  const slug = subdomain.trim();
  if (!slug) {
    return { ok: false, error: 'Site subdomain is not configured.' };
  }

  const body: Record<string, string> = {
    bookingId,
    subdomain: slug,
    cancelledBy,
  };
  if (cancelledBy === 'client' && contact?.trim()) {
    body.contact = contact.trim();
  }

  const { data, error } = await supabase.functions.invoke<
    BookingCancelResult & { error?: string }
  >('booking-cancel', { body });

  if (error) {
    return { ok: false, error: error.message || 'Cancellation failed' };
  }
  if (!data?.ok) {
    return { ok: false, error: data?.error || 'Cancellation failed' };
  }
  return data;
}
