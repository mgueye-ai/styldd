# Salon booking rules & APIs

This document describes how **Your Salon Name** implements public booking and the admin scheduler. Run database migrations in `supabase/migrations/` (especially `20260505210000_booking_slots_and_status.sql`) before relying on new columns and RPC. If your project ever used the old Cal.com integration, apply `20260505230000_remove_cal_integration.sql` as well to drop `cal_bookings` and related columns.

## Business rules (public booking page)

### 48-hour rule

The earliest bookable **instant** on a calendar day is **9:00 AM** in the salon timezone (`America/New_York`). If that instant is **before** `now + 48 hours`, the **entire day** is disabled (no online booking that day).

### Sundays

**Sundays are closed** — all Sunday cells are disabled. (Adjust in `js/booking.js` / `calendarDayDisabledReason` if your policy changes.)

### Saturday hours

- No slot may **start at or after 2:00 PM** (salon local time).
- Any slot whose **end** (start + computed duration) would fall **after 2:00 PM** is treated as **fully booked** (disabled).

### Same-day lead time

On **today’s** date, slots starting sooner than **30 minutes** from now are disabled (`sameDayLeadMinutes` in `js/booking-config.js`).

### Duration

`totalDurationMinutes = ceil(baseDurationMinutes × hairLengthMultiplier + prewashMinutes)`

- Base duration is inferred from the selected catalog style (`inferBaseDurationMinutes` in `js/booking.js`).
- Hair length and pre-wash options adjust minutes per the same file.

### Slot colors (Available / Limited / Fully booked)

Busy intervals come from Supabase RPC `get_unavailable_times_for_day(date)`, which returns existing bookings’ `[start, end)` intervals (excluding `booking_status = cancelled`).

For each candidate slot, we count how many busy intervals **overlap** the new appointment window `[slotStart, slotEnd)` (standard interval overlap).

- **Fully booked (red):** overlap count ≥ `concurrentAppointmentCapacity` (default **2** in `booking-config.js`).
- **Limited (yellow):** overlap count equals **capacity − 1** (only when capacity &gt; 1 — with capacity **1**, you only see green vs red).
- **Available (green):** overlap count **0**.

Overlap definition: `slotStart < busyEnd && busyStart < slotEnd` (half-open intervals are treated consistently with the SQL `tstzrange` overlap).

### Unavailability API contract

The browser calls:

`supabase.rpc('get_unavailable_times_for_day', { p_date: 'YYYY-MM-DD' })`

Returned JSON array elements normalize to:

```json
{
  "unavailableTimes": [
    { "start": "<ISO timestamp>", "end": "<ISO timestamp>", "duration": 120 }
  ]
}
```

(Supabase returns the JSON array directly; each row uses keys `start`, `end`, `duration`.)

### Admin cancel

`POST /functions/v1/admin-cancel-booking` with JSON `{ "booking_id": "<uuid>", "admin_code": "<code>" }` and standard Supabase anon headers. Set `ADMIN_ACCESS_CODE` in Edge Function secrets (defaults to `0000` in code for development only).

Deploy the function after pulling:

`supabase/functions/admin-cancel-booking/`

The Stripe webhook sets `booking_status` to **`confirmed`** when a deposit payment completes (`payment_status` remains `deposit_paid`).
